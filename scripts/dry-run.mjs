// Dry run: uses the mock fixture to fetch related courses and writes to a
// local file, not Spaces
import { readFileSync, writeFileSync } from 'node:fs';

import { run } from '../src/run.js';

const fixture = new URL(
  '../test/fixtures/mock-hashnode-posts.json',
  import.meta.url
);
const dest = new URL('../related-courses-cache.local.json', import.meta.url);

await run({
  fetchPosts: async () => JSON.parse(readFileSync(fixture)),
  loadCache: async () => ({ posts: {}, courses: {}, subjects: {} }),
  saveCache: async (cache) => {
    const document = { generatedAt: new Date().toISOString(), ...cache };
    writeFileSync(dest, JSON.stringify(document, null, 2) + '\n');
  },
});

const written = JSON.parse(readFileSync(dest));
for (const post of Object.values(written.posts)) {
  console.log(
    `  ${post.slug}: ${post.courseIds.length} courses, ${post.subjectSlugs.length} subjects`
  );
}
console.log(
  `\n${Object.keys(written.courses).length} unique courses, ` +
    `${Object.keys(written.subjects).length} unique subjects`
);
console.log(`\nWrote ${dest.pathname}`);
