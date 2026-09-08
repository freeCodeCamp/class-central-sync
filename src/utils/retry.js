import { setTimeout as sleep } from 'node:timers/promises';

// A network exception carries no HTTP status; 429 and 5xx are worth another try.
// Every other status (401, 404, GraphQL 400, ...) fails fast.
const isRetriable = (error) => {
  const status = error?.status ?? error?.response?.status ?? null;
  return status === null || status === 429 || status >= 500;
};

export const withRetry = async (
  operation,
  { label = 'request', attempts = 3, delayMs = 5000 } = {}
) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isRetriable(error)) throw error;
      console.warn(
        `${label} failed (${error.message}). Retry ${attempt}/${attempts - 1} in ${delayMs / 1000}s.`
      );
      await sleep(delayMs);
    }
  }
};
