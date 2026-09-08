import { assertValidCache } from './validate-cache.js';

const entry = () => ({
  contentHash: 'abc123',
  fetchedAt: new Date().toISOString(),
  slug: 'what-is-recursion',
  title: 'How Does Recursion Work?',
  courses: [{ name: 'A course' }],
  subjects: [{ name: 'A subject' }],
});

describe('assertValidCache:', () => {
  test('passes a well-formed cache', () => {
    expect(() => assertValidCache({ posts: { abc: entry() } })).not.toThrow();
  });

  test('throws on a cache with no posts object', () => {
    expect(() => assertValidCache({})).toThrow(/posts/);
  });

  test('throws on an entry missing a required field', () => {
    const bad = entry();
    delete bad.courses;
    expect(() => assertValidCache({ posts: { abc: bad } })).toThrow(/abc/);
  });
});
