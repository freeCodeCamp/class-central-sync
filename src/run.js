import * as hashnode from './hashnode/fetch-posts.js';
import {
  prepareContentForClassCentral,
  hashContent,
} from './class-central/content.js';
import { fetchRelatedCoursesForPosts } from './class-central/api.js';
import {
  pickCourseFields,
  pickSubjectFields,
} from './class-central/course-fields.js';
import * as store from './class-central/store.js';
import { isFresh } from './class-central/freshness.js';
import { assertValidCache } from './class-central/validate-cache.js';
import { assertConfig } from './config.js';

// Persist progress every N posts so a killed run keeps its rate-limited work
const CHECKPOINT_EVERY = 25;

// Cap calls to Class Central - the rest roll to the next run
const MAX_POSTS_PER_RUN = 3000;

// News shows at most this many courses per post
const MAX_COURSES_PER_POST = 4;

// News uses only the first subject to link back to Class Central
const MAX_SUBJECTS_PER_POST = 1;

// Courses/subjects can fall out of every post's reference list (a post's
// content changes, or the post itself is deleted) - drop them from the
// lookup tables too so the cache doesn't grow unbounded over time
const pruneUnreferencedLookups = (cache) => {
  const referencedCourseIds = new Set();
  const referencedSubjectSlugs = new Set();

  Object.values(cache.posts).forEach((entry) => {
    entry.courseIds.forEach((id) => referencedCourseIds.add(id));
    entry.subjectSlugs.forEach((slug) => referencedSubjectSlugs.add(slug));
  });

  Object.keys(cache.courses).forEach((id) => {
    if (!referencedCourseIds.has(Number(id))) delete cache.courses[id];
  });
  Object.keys(cache.subjects).forEach((slug) => {
    if (!referencedSubjectSlugs.has(slug)) delete cache.subjects[slug];
  });
};

// Main entry point that accepts optional overrides for testing
export const run = async ({
  fetchPosts = hashnode.fetchPosts,
  loadCache = store.loadCache,
  saveCache = store.saveCache,
} = {}) => {
  const posts = await fetchPosts();
  const cache = await loadCache();
  cache.courses ??= {};
  cache.subjects ??= {};

  // Drop entries for deleted posts
  const currentIds = new Set(posts.map((post) => post.id));
  let deletedAny = false;
  Object.keys(cache.posts).forEach((id) => {
    if (!currentIds.has(id)) {
      delete cache.posts[id];
      deletedAny = true;
    }
  });

  const postsToSync = posts
    .map((post) => {
      const content = prepareContentForClassCentral(post);
      if (!content) return null;

      const contentHash = hashContent(content);
      const cached = cache.posts[post.id];
      if (cached?.contentHash === contentHash && isFresh(cached)) return null;

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        content,
        contentHash,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_POSTS_PER_RUN);

  if (!postsToSync.length) {
    // Even with nothing to fetch, a deletion above still needs persisting -
    // otherwise it (and any lookup entries only it referenced) never gets
    // saved
    if (deletedAny) {
      pruneUnreferencedLookups(cache);
      assertValidCache(cache);
      await saveCache(cache);
    }

    console.log(
      'Every post already has up-to-date course data. Nothing to do.'
    );
    return;
  }

  const total = postsToSync.length;
  console.log(
    `Fetching Class Central data for ${total} post(s) (of ${posts.length} total)...`
  );

  const startedAt = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for await (const { post, courseData, error } of fetchRelatedCoursesForPosts(
    postsToSync
  )) {
    processed++;

    if (error) {
      failed++;
      console.warn(
        `  [${processed}/${total}] "${post.slug}" failed, will retry next run: ${error.message}`
      );
    } else {
      const { courses, subjects } = courseData;

      // Trim courses/subjects (see course-fields.js), then store each one
      // once in the lookup tables so repeats across posts aren't duplicated
      const postCourses = courses
        .slice(0, MAX_COURSES_PER_POST)
        .map(pickCourseFields);
      const postSubjects = subjects
        .slice(0, MAX_SUBJECTS_PER_POST)
        .map(pickSubjectFields);

      postCourses.forEach((course) => {
        cache.courses[course.id] = course;
      });
      postSubjects.forEach((subject) => {
        cache.subjects[subject.slug] = subject;
      });

      // Store the content hash to skip unchanged posts next run, a
      // timestamp, the slug/title for easier debugging of the raw cache,
      // and references into the lookup tables above
      cache.posts[post.id] = {
        contentHash: post.contentHash,
        fetchedAt: new Date().toISOString(),
        slug: post.slug,
        title: post.title,
        courseIds: postCourses.map((course) => course.id),
        subjectSlugs: postSubjects.map((subject) => subject.slug),
      };
      succeeded++;
    }

    if (processed % CHECKPOINT_EVERY === 0) {
      console.log(
        `  [${processed}/${total}] ${succeeded} fetched, ${failed} failed - saving checkpoint`
      );
      await saveCache(cache);
    }
  }

  pruneUnreferencedLookups(cache);

  assertValidCache(cache);
  await saveCache(cache);

  const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `Done in ${minutes} min. Fetched ${succeeded} post(s), ${failed} failed and will be retried next run.`
  );
};

// Entry point when run directly, ignored when imported by tests
if (import.meta.main) {
  assertConfig();
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
