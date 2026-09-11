import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import { config } from '../config.js';

const SPACES_REGION = 'nyc3';
const SPACES_BUCKET = 'freecodecamp-news-class-central';
const CACHE_KEY = 'related-courses-cache.json';

const client = new S3Client({
  endpoint: `https://${SPACES_REGION}.digitaloceanspaces.com`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.doObjectStorageKeyId,
    secretAccessKey: config.doObjectStorageSecret,
  },
});

// Empty cache on the first run, before the object exists. `key` is overridable
// only so scripts/spaces-check.mjs can use a throwaway object.
export const loadCache = async (key = CACHE_KEY) => {
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: SPACES_BUCKET, Key: key })
    );
    return JSON.parse(await res.Body.transformToString());
  } catch (error) {
    if (error.name === 'NoSuchKey')
      return { posts: {}, courses: {}, subjects: {} };
    throw error;
  }
};

export const saveCache = async (cache, key = CACHE_KEY) => {
  // news reads `generatedAt` - stamp it on every write
  const document = { ...cache, generatedAt: new Date().toISOString() };

  await client.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: JSON.stringify(document),
      ContentType: 'application/json',
    })
  );
};
