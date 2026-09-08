const isNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0;

// Throws if the cache is structurally broken. Only its own shape is checked;
// course/subject objects are opaque
export const assertValidCache = (cache) => {
  const fail = (reason) => {
    throw new Error(`Refusing to save malformed cache: ${reason}`);
  };

  if (!cache || typeof cache.posts !== 'object' || cache.posts === null) {
    fail('no "posts" object');
  }

  for (const [id, entry] of Object.entries(cache.posts)) {
    if (
      !isNonEmptyString(entry?.contentHash) ||
      !isNonEmptyString(entry?.slug) ||
      !isNonEmptyString(entry?.title) ||
      Number.isNaN(Date.parse(entry?.fetchedAt)) ||
      !Array.isArray(entry?.courses) ||
      !Array.isArray(entry?.subjects)
    ) {
      fail(`entry "${id}" is missing required fields`);
    }
  }
};
