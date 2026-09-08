# class-central-sync

Hourly job that fetches [Class Central](https://www.classcentral.com) course
recommendations for every English [freeCodeCamp News](https://www.freecodecamp.org/news)
post and writes them as one JSON document in DigitalOcean Spaces. The News build
reads that document to render sponsored-course ads, and falls back to Google ads
if it's missing.

This is the **producer**; the **consumer** is the
[`news`](https://github.com/freeCodeCamp/news) repo, which reads the object and
renders the ads.

## How it works

Each run (a scheduled job on DigitalOcean App Platform, `15 * * * *`):

1. Fetch all English posts from Hashnode.
2. Load the cache from Spaces; drop entries for deleted posts.
3. Queue posts that are new, edited, or last fetched over 24h ago (max 3,000/run).
4. Call Class Central `/related` one post at a time (~1/sec); failed posts retry
   next run.
5. Checkpoint every 25 posts, then validate and write the object with a fresh
   `generatedAt`.

The publication has ~13,000 posts, so a cold start takes ~5 hourly runs to fully
populate the cache. In steady state each run only refreshes the few hundred posts
that are new or past the 24h window.

## Output

A single private object, `related-courses-cache.json`, in the
`freecodecamp-news-class-central` Spaces bucket. The `news` build reads it from
Spaces with its own read credentials before each build.

```json
{
  "generatedAt": "2026-09-08T12:15:03.000Z",
  "posts": {
    "<hashnode post id>": {
      "contentHash": "…",
      "fetchedAt": "2026-09-08T12:14:03.000Z",
      "slug": "what-is-recursion",
      "title": "How Does Recursion Work?",
      "courses": [/* raw Class Central objects */],
      "subjects": [/* raw Class Central objects */]
    }
  }
}
```

`courses` and `subjects` are whatever Class Central returns, stored untouched;
`news` does all display formatting. A post absent from `posts`, or with an empty
`courses` array, shows Google ads instead.

## Local development

```bash
nvm use
pnpm install
cp sample.env .env   # fill in the four values below
pnpm test
pnpm run lint
```

A husky pre-commit hook runs Prettier over staged files (`pnpm install` sets it
up).

`pnpm start` is the real production run: the full Hashnode post list, a Class
Central call per stale post (~1/sec, up to an hour on a cold cache), written to
the production object. Two scripts exercise the pieces without that:

| Command             | What it does                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dry-run`      | Mock Hashnode fixture → real Class Central → `related-courses-cache.local.json` (gitignored). No Spaces. Use it to eyeball live Class Central response shape. |
| `pnpm spaces-check` | Round-trips a synthetic object through DO Spaces to verify the credentials and `store.js` config before deploying.                                            |

`spaces-check` leaves a `related-courses-cache.spaces-check.json` object in the
bucket (a separate key from production); delete it when you're done.

## Deployment

The sync runs as a `SCHEDULED` job on [DigitalOcean App
Platform](https://cloud.digitalocean.com/apps), in the fCC Team's account,
connected to this repo through the dashboard.

**First time:** in the DO dashboard, "Create App" → connect this repo (authorizes
App Platform on GitHub) → "Edit Your App Spec" → paste [`app.yaml`](app.yaml).
Then set the four secrets on the job: Environment Variables → "Bulk Editor" →
paste the `KEY=value` lines from your `.env`.

After that, `deploy_on_push` means **merging to `main` redeploys the job
automatically** — no other step. Config changes (cron, instance size, secrets)
are made in the dashboard; keep [`app.yaml`](app.yaml) in sync by hand as the
readable record.

## Environment

All required. In production they're set on the App Platform job in the dashboard;
locally they come from `.env`.

| Variable                   | Purpose                               |
| -------------------------- | ------------------------------------- |
| `CLASS_CENTRAL_API_KEY`    | Class Central `/related` bearer token |
| `ENGLISH_HASHNODE_HOST`    | English News publication host         |
| `DO_OBJECT_STORAGE_KEY_ID` | Spaces write key                      |
| `DO_OBJECT_STORAGE_SECRET` | Spaces write secret                   |

The Hashnode URL and Spaces bucket/region/key are hardcoded in `src/`. The
object is written with no ACL, so it stays private; `news` reads it with its own
Spaces credentials.
