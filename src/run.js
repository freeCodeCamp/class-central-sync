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

// Main entry point that accepts optional overrides for testing
export const run = async ({
  fetchPosts = hashnode.fetchPosts,
  loadCache = store.loadCache,
  saveCache = store.saveCache,
} = {}) => {
  const posts = await fetchPosts();
  const cache = await loadCache();

  // Drop entries for deleted posts
  const currentIds = new Set(posts.map((post) => post.id));
  Object.keys(cache.posts).forEach((id) => {
    if (!currentIds.has(id)) delete cache.posts[id];
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

      // Store the content hash to skip unchanged posts next run, a timestamp,
      // the slug/title for easier debugging of the raw cache, and a trimmed
      // list of courses/subjects (see course-fields.js)
      cache.posts[post.id] = {
        contentHash: post.contentHash,
        fetchedAt: new Date().toISOString(),
        slug: post.slug,
        title: post.title,
        courses: courses.slice(0, MAX_COURSES_PER_POST).map(pickCourseFields),
        subjects: subjects.map(pickSubjectFields),
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
