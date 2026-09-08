// Verifies the DO Spaces round-trip: writes a synthetic object with the real
// store.js functions, reads it back, and checks it matches. Confirms the
// credentials and store.js config before deploying. Self-contained - no other
// script or local file is involved.
import { deepStrictEqual } from 'node:assert';

import { config } from '../src/config.js';
import { loadCache, saveCache } from '../src/class-central/store.js';

const TEST_KEY = 'related-courses-cache.spaces-check.json';

if (!config.doObjectStorageKeyId || !config.doObjectStorageSecret) {
  throw new Error(
    'Set DO_OBJECT_STORAGE_KEY_ID and DO_OBJECT_STORAGE_SECRET in .env'
  );
}

const doc = {
  posts: {
    'spaces-check-post': {
      contentHash: 'abc',
      fetchedAt: new Date().toISOString(),
      slug: 'spaces-check',
      title: 'Spaces check',
      courses: [],
      subjects: [],
    },
  },
};

console.log(`Writing ${TEST_KEY}...`);
await saveCache(doc, TEST_KEY);

console.log('Reading it back...');
const roundTripped = await loadCache(TEST_KEY);

deepStrictEqual(roundTripped.posts, doc.posts);

console.log(
  `\nSpaces round-trip works (generatedAt ${roundTripped.generatedAt}).\n` +
    `The test object ${TEST_KEY} was left in the bucket and is safe to delete.`
);
