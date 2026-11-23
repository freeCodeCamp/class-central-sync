// Load .env for local runs, but ignore in production because
// DO's App Platform sets the env vars directly
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const env = process.env;

export const config = {
  classCentralAPIKey: env.CLASS_CENTRAL_API_KEY,
  englishHashnodeHost: env.ENGLISH_HASHNODE_HOST,
  doObjectStorageKeyId: env.DO_OBJECT_STORAGE_KEY_ID,
  doObjectStorageSecret: env.DO_OBJECT_STORAGE_SECRET,
};

// Prevent tests from needing a .env file,
// but fail fast if run() is called without required config
export const assertConfig = () => {
  const missing = Object.keys(config).filter((key) => !config[key]);

  if (missing.length) {
    throw new Error(
      `Missing required config: ${missing.join(', ')} (see sample.env)`
    );
  }
};
