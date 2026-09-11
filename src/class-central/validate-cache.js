const isNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0;

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Throws if the cache is structurally broken. Only its own shape is checked;
// course/subject objects in the lookup tables are opaque
export const assertValidCache = (cache) => {
  const fail = (reason) => {
    throw new Error(`Refusing to save malformed cache: ${reason}`);
  };

  if (!isPlainObject(cache?.posts)) fail('no "posts" object');
  if (!isPlainObject(cache?.courses)) fail('no "courses" object');
  if (!isPlainObject(cache?.subjects)) fail('no "subjects" object');

  for (const [id, entry] of Object.entries(cache.posts)) {
    if (
      !isNonEmptyString(entry?.contentHash) ||
      !isNonEmptyString(entry?.slug) ||
      !isNonEmptyString(entry?.title) ||
      Number.isNaN(Date.parse(entry?.fetchedAt)) ||
      !Array.isArray(entry?.courseIds) ||
      !Array.isArray(entry?.subjectSlugs)
    ) {
      fail(`entry "${id}" is missing required fields`);
    }

    entry.courseIds.forEach((courseId) => {
      if (!(courseId in cache.courses)) {
        fail(`entry "${id}" references unknown course "${courseId}"`);
      }
    });
    entry.subjectSlugs.forEach((subjectSlug) => {
      if (!(subjectSlug in cache.subjects)) {
        fail(`entry "${id}" references unknown subject "${subjectSlug}"`);
      }
    });
  }
};
