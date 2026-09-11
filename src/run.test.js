import { readFileSync } from 'fs';

import { run } from './run.js';

const mockPosts = JSON.parse(
  readFileSync(
    new URL('../test/fixtures/mock-hashnode-posts.json', import.meta.url)
  )
);

const MOCK_POST_IDS = mockPosts.map((post) => post.id);
const RECURSION_POST_ID = '66d4608b230dff016690584b';

const coursesFor = (post) => ({
  courses: [
    {
      id: 1,
      name: `Course for ${post.slug}`,
      slug: `c-${post.slug}`,
      description: 'Discarded during trimming',
      url: { go: `https://example.com/go/${post.slug}` },
    },
  ],
  subjects: [
    { name: 'Subject', slug: 'subject', url: 'https://example.com/subject' },
  ],
});

const yieldSuccessForAll = async function* (posts) {
  for (const post of posts) yield { post, courseData: coursesFor(post) };
};

const { fetchPosts, fetchRelatedCoursesForPosts, loadCache, saveCache } =
  vi.hoisted(() => ({
    fetchPosts: vi.fn(),
    fetchRelatedCoursesForPosts: vi.fn(),
    loadCache: vi.fn(),
    saveCache: vi.fn(),
  }));

vi.mock('./hashnode/fetch-posts.js', () => ({ fetchPosts }));
vi.mock('./class-central/api.js', () => ({ fetchRelatedCoursesForPosts }));
vi.mock('./class-central/store.js', () => ({ loadCache, saveCache }));

// In-memory stand-in for the object-storage cache
let stored;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  stored = { posts: {}, courses: {}, subjects: {} };

  fetchPosts.mockResolvedValue(mockPosts);
  loadCache.mockImplementation(async () => structuredClone(stored));
  saveCache.mockImplementation(async (cache) => {
    stored = structuredClone(cache);
  });
  fetchRelatedCoursesForPosts.mockImplementation(yieldSuccessForAll);
});

afterEach(() => vi.restoreAllMocks());

describe('run():', () => {
  test('fetches courses for every post and saves them on a cold cache', async () => {
    await run();

    expect(fetchRelatedCoursesForPosts).toHaveBeenCalledTimes(1);
    const [postsToSync] = fetchRelatedCoursesForPosts.mock.calls[0];
    expect(postsToSync.map((post) => post.id).sort()).toEqual(
      [...MOCK_POST_IDS].sort()
    );

    expect(saveCache).toHaveBeenCalled();
    expect(Object.keys(stored.posts).sort()).toEqual([...MOCK_POST_IDS].sort());

    const entry = stored.posts[RECURSION_POST_ID];
    expect(entry).toMatchObject({
      slug: 'what-is-recursion',
      title: 'How Does Recursion Work? Explained with Code Examples',
      courseIds: [1],
      subjectSlugs: ['subject'],
    });
    expect(typeof entry.contentHash).toBe('string');
    expect(Number.isNaN(Date.parse(entry.fetchedAt))).toBe(false);

    // The course/subject data lives once in the lookup tables, not
    // duplicated on the post entry
    expect(stored.courses[1]).toMatchObject({
      id: 1,
      name: expect.stringContaining('what-is-recursion'),
      url: { go: expect.stringContaining('what-is-recursion') },
      rating: { provider: null },
    });
    expect(stored.subjects.subject).toEqual({
      slug: 'subject',
      name: 'Subject',
      url: 'https://example.com/subject',
    });

    // Fields Class Central returns but News never renders are dropped
    expect(stored.courses[1]).not.toHaveProperty('slug');
    expect(stored.courses[1]).not.toHaveProperty('description');
  });

  test('shares one lookup-table entry across posts with the same course', async () => {
    await run();

    // Every mock post resolves to the same course id via coursesFor(), just
    // with a different name - only the last write survives, and every post
    // still points at the one shared entry
    expect(Object.keys(stored.courses)).toEqual(['1']);
    for (const id of MOCK_POST_IDS) {
      expect(stored.posts[id].courseIds).toEqual([1]);
    }
  });

  test('caps stored courses at 4, News never shows more than that', async () => {
    fetchRelatedCoursesForPosts.mockImplementation(async function* (posts) {
      for (const post of posts) {
        yield {
          post,
          courseData: {
            courses: Array.from({ length: 10 }, (_, i) => ({
              id: i,
              name: `Course ${i} for ${post.slug}`,
            })),
            subjects: [],
          },
        };
      }
    });

    await run();

    const entry = stored.posts[RECURSION_POST_ID];
    expect(entry.courseIds).toEqual([0, 1, 2, 3]);
    expect(Object.keys(stored.courses).sort()).toEqual(['0', '1', '2', '3']);
  });

  test('caps stored subjects at 1, News only links to the first', async () => {
    fetchRelatedCoursesForPosts.mockImplementation(async function* (posts) {
      for (const post of posts) {
        yield {
          post,
          courseData: {
            courses: [],
            subjects: [
              {
                name: 'First subject',
                slug: 'first',
                url: 'https://example.com/subject/first',
              },
              {
                name: 'Second subject',
                slug: 'second',
                url: 'https://example.com/subject/second',
              },
            ],
          },
        };
      }
    });

    await run();

    const entry = stored.posts[RECURSION_POST_ID];
    expect(entry.subjectSlugs).toEqual(['first']);
    expect(stored.subjects).toEqual({
      first: {
        slug: 'first',
        name: 'First subject',
        url: 'https://example.com/subject/first',
      },
    });
  });

  test('does nothing on a warm cache with fresh, unchanged entries', async () => {
    await run();
    fetchRelatedCoursesForPosts.mockClear();
    saveCache.mockClear();

    await run();

    expect(fetchRelatedCoursesForPosts).not.toHaveBeenCalled();
    expect(saveCache).not.toHaveBeenCalled();
  });

  test('refetches every post once cached entries age past the freshness window', async () => {
    await run();

    const dayAndAnHourAgo = new Date(
      Date.now() - 25 * 60 * 60 * 1000
    ).toISOString();
    for (const id of Object.keys(stored.posts)) {
      stored.posts[id].fetchedAt = dayAndAnHourAgo;
    }
    fetchRelatedCoursesForPosts.mockClear();

    await run();

    expect(fetchRelatedCoursesForPosts).toHaveBeenCalledTimes(1);
    expect(fetchRelatedCoursesForPosts.mock.calls[0][0]).toHaveLength(
      MOCK_POST_IDS.length
    );
  });

  test('refetches only the post whose content changed', async () => {
    await run();
    fetchRelatedCoursesForPosts.mockClear();

    const editedPosts = structuredClone(mockPosts);
    editedPosts.find((post) => post.id === RECURSION_POST_ID).content.html +=
      '<p>A new paragraph that changes the content hash.</p>';
    fetchPosts.mockResolvedValue(editedPosts);

    await run();

    expect(fetchRelatedCoursesForPosts).toHaveBeenCalledTimes(1);
    const [postsToSync] = fetchRelatedCoursesForPosts.mock.calls[0];
    expect(postsToSync).toHaveLength(1);
    expect(postsToSync[0].id).toBe(RECURSION_POST_ID);
  });

  test('drops cache entries for posts that no longer exist', async () => {
    stored.posts.deadbeefdeadbeefdeadbeef = {
      contentHash: 'stale',
      fetchedAt: new Date().toISOString(),
      slug: 'deleted-post',
      title: 'Deleted post',
      courseIds: [],
      subjectSlugs: [],
    };

    await run();

    expect(stored.posts.deadbeefdeadbeefdeadbeef).toBeUndefined();
    expect(Object.keys(stored.posts).sort()).toEqual([...MOCK_POST_IDS].sort());
  });

  test('prunes lookup-table entries no post references anymore', async () => {
    // Left over from a course/subject that no post points to anymore
    stored.courses[999] = { id: 999, name: 'Orphaned course' };
    stored.subjects.orphaned = { slug: 'orphaned', name: 'Orphaned subject' };

    await run();

    expect(stored.courses[999]).toBeUndefined();
    expect(stored.subjects.orphaned).toBeUndefined();
  });

  test('warns and skips a post whose fetch fails, still saving the rest', async () => {
    fetchRelatedCoursesForPosts.mockImplementation(async function* (posts) {
      for (const post of posts) {
        yield post.id === RECURSION_POST_ID
          ? {
              post,
              error: new Error('Class Central /related responded with 500'),
            }
          : { post, courseData: coursesFor(post) };
      }
    });

    await run();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('what-is-recursion')
    );
    expect(stored.posts[RECURSION_POST_ID]).toBeUndefined();
    expect(Object.keys(stored.posts)).toHaveLength(MOCK_POST_IDS.length - 1);
  });
});
