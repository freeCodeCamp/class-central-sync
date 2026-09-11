import { setTimeout as sleep } from 'node:timers/promises';

import { gql, request } from 'graphql-request';

import { withRetry } from '../utils/retry.js';
import { config } from '../config.js';

const { englishHashnodeHost } = config;

const HASHNODE_API_URL = 'https://gql-beta.hashnode.com';

const query = gql`
  query PostsFromPublication($host: String!, $first: Int!, $after: String) {
    publication(host: $host) {
      posts(first: $first, after: $after) {
        totalDocuments
        edges {
          node {
            id
            slug
            title
            content {
              html
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

const PAGE_SIZE = 100;
// Log progress every N pages during pagination.
const LOG_EVERY_PAGES = 5;

export const fetchPosts = async () => {
  if (!englishHashnodeHost) return [];

  const startedAt = Date.now();
  const posts = [];
  let after = null;
  let page = 0;
  let total = null; // every post in the publication, from the API

  for (;;) {
    const res = await withRetry(
      () =>
        request(HASHNODE_API_URL, query, {
          host: englishHashnodeHost,
          first: PAGE_SIZE,
          after,
        }),
      { label: 'Hashnode posts fetch' }
    );

    const connection = res.publication?.posts;
    if (!connection?.pageInfo) {
      throw new Error(
        'Hashnode posts fetch returned no "posts" connection. Check the publication host and that the API schema is unchanged.'
      );
    }

    if (page === 0) {
      total = connection.totalDocuments ?? null;
      console.log(`Fetching ${total ?? 'all'} posts from Hashnode...`);
    }

    posts.push(...connection.edges.map(({ node }) => node));
    page++;

    if (page % LOG_EVERY_PAGES === 0) {
      const pct = total
        ? ` (${Math.round((posts.length / total) * 100)}%)`
        : '';
      console.log(`  ${posts.length} of ${total ?? '?'} fetched${pct}`);
    }

    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor;
    await sleep(200);
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`Fetched ${posts.length} posts from Hashnode in ${seconds}s.`);
  return posts;
};
