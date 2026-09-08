import { setTimeout as sleep } from 'node:timers/promises';

import { withRetry } from '../utils/retry.js';
import { config } from '../config.js';

const { classCentralAPIKey } = config;

const CLASS_CENTRAL_API_URL = 'https://www.classcentral.com/api/v3/related';

// Class Central allows 60 requests / minute, so throttle slightly
const CLASS_CENTRAL_THROTTLE_MS = 1100;

export const fetchRelatedCourses = async (content) => {
  const { data } = await withRetry(
    async () => {
      const response = await fetch(CLASS_CENTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${classCentralAPIKey}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = new Error(
          `Class Central /related responded with ${response.status} ${response.statusText}`
        );
        error.status = response.status;
        throw error;
      }

      return response.json();
    },
    { label: 'Class Central /related' }
  );

  return {
    courses: data?.courses ?? [],
    subjects: data?.subjects ?? [],
  };
};

// One throttled post at a time, and failed posts are left for the next run
export async function* fetchRelatedCoursesForPosts(postsToFetch) {
  for (const post of postsToFetch) {
    try {
      const courseData = await fetchRelatedCourses(post.content);
      yield { post, courseData };
    } catch (error) {
      yield { post, error };
    }

    await sleep(CLASS_CENTRAL_THROTTLE_MS);
  }
}
