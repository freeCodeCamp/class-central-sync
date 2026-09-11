import { assertValidCache } from './validate-cache.js';

const entry = () => ({
  contentHash: 'abc123',
  fetchedAt: new Date().toISOString(),
  slug: 'what-is-recursion',
  title: 'How Does Recursion Work?',
  courseIds: [1],
  subjectSlugs: ['recursion'],
});

const cache = () => ({
  posts: { abc: entry() },
  courses: { 1: { name: 'A course' } },
  subjects: { recursion: { name: 'A subject' } },
});

describe('assertValidCache:', () => {
  test('passes a well-formed cache', () => {
    expect(() => assertValidCache(cache())).not.toThrow();
  });

  test('throws on a cache with no posts object', () => {
    expect(() => assertValidCache({ courses: {}, subjects: {} })).toThrow(
      /posts/
    );
  });

  test('throws on a cache with no courses object', () => {
    expect(() => assertValidCache({ posts: {}, subjects: {} })).toThrow(
      /courses/
    );
  });

  test('throws on a cache with no subjects object', () => {
    expect(() => assertValidCache({ posts: {}, courses: {} })).toThrow(
      /subjects/
    );
  });

  test('throws on an entry missing a required field', () => {
    const bad = cache();
    delete bad.posts.abc.courseIds;
    expect(() => assertValidCache(bad)).toThrow(/abc/);
  });

  test('throws when an entry references a course missing from the lookup table', () => {
    const bad = cache();
    bad.posts.abc.courseIds = [999];
    expect(() => assertValidCache(bad)).toThrow(/999/);
  });

  test('throws when an entry references a subject missing from the lookup table', () => {
    const bad = cache();
    bad.posts.abc.subjectSlugs = ['unknown-subject'];
    expect(() => assertValidCache(bad)).toThrow(/unknown-subject/);
  });
});
