# Setting Up the Feedback Worker

Testers' reports go to a Cloudflare Worker in [feedback-worker/](../feedback-worker/). It keeps reports in a D1 database and captures in a private R2 bucket. CI deploys it on every push to `main`, and needs these settings:

| Setting                   | Kind     | Where it comes from                        |
| ------------------------- | -------- | ------------------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID`   | Secret   | Your Cloudflare account ID                 |
| `CLOUDFLARE_API_TOKEN`    | Secret   | An API token that can deploy Workers       |
| `FEEDBACK_D1_DATABASE_ID` | Variable | The id of the D1 database you create below |

Until all three are set, CI skips the deploy with a warning. Setting only some fails the run.

The Worker also needs the `FEEDBACK_ADMIN_TOKEN` secret for its admin routes. You set that one on the Worker, not in GitHub. See step 6.

## 1. Create the D1 Database

In the [Cloudflare dashboard](https://dash.cloudflare.com), open **Storage & databases → D1 SQL database** and click **Create database**. Name it `bright-trail-feedback`, the name in `feedback-worker/wrangler.jsonc`.

Or from the repo folder, after `npx wrangler login`:

```sh
npx wrangler d1 create bright-trail-feedback
```

Copy the database id it shows. That's `FEEDBACK_D1_DATABASE_ID`. You don't need to create tables: the deploy applies `feedback-worker/migrations/` first.

## 2. Create the R2 Bucket

Open **R2 Object Storage** and click **Create bucket**. Name it `bright-trail-feedback-captures`, and leave location and storage class on their defaults.

**Keep public access off.** Captures are screenshots from testers' devices, and only the Worker reads them. This bucket is separate from the content packs bucket in [setup-r2.md](setup-r2.md).

Or from the CLI:

```sh
npx wrangler r2 bucket create bright-trail-feedback-captures
```

## 3. Find the Account ID

It's under **Account Details** on the Workers or R2 overview page, and it's the hex string in the dashboard URL. If you set up the content packs, it's the same value as `R2_ACCOUNT_ID`.

## 4. Create an API Token

Go to **My Profile → API Tokens → Create Token**, and start from the **Edit Cloudflare Workers** template. Then:

- **Permissions:** add **Account → D1 → Edit**, so the deploy can apply migrations.
- **Account Resources:** include only your account.
- **Zone Resources:** **All zones from an account**, your account. The Worker uses no zone, so it doesn't matter which.

Create it and copy the token. Cloudflare shows it only once. This is `CLOUDFLARE_API_TOKEN`.

The Worker serves from `workers.dev`, so the account needs a `workers.dev` subdomain. Open **Workers & Pages** once and accept the one it offers if it asks.

## 5. Add Them to GitHub

From the repo folder. Each `secret set` prompts for the value, so it doesn't land in your shell history:

```sh
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN
gh variable set FEEDBACK_D1_DATABASE_ID --body "<database id>"
```

Or add them under **Settings → Secrets and variables → Actions**.

## 6. Set the Admin Token

`/admin/*` answers only requests with `Authorization: Bearer <FEEDBACK_ADMIN_TOKEN>`. Without the secret, every admin request gets `401`, but the deploy and the intake still work.

After the first deploy, generate a token and store it on the Worker from `feedback-worker/`. It prompts for the value:

```sh
openssl rand -hex 32
cd feedback-worker
npx wrangler secret put FEEDBACK_ADMIN_TOKEN
```

Keep the same value in your `.env` as `FEEDBACK_ADMIN_TOKEN`, for the admin tools.

The token also signs capture links, so there's no second secret. The flip side: **rotating the token revokes every capture link** already posted in issues. To rotate, run `secret put` again with a new value and update `.env`.

## 7. Check It Works

The next push to `main` runs the `deploy-feedback` job. It applies migrations, then deploys, and the log ends with the Worker's URL, like `https://bright-trail-feedback.<subdomain>.workers.dev`. A `GET` on `/v1/reports` there answers `405`.

If it fails:

- `Missing feedback Worker settings: ...` means a secret or the variable is unset or misspelled.
- An authentication error means the token lacks a permission from step 4.
- `Couldn't find a D1 DB` means `FEEDBACK_D1_DATABASE_ID` doesn't match the database.
- A bucket error means the bucket name isn't exactly `bright-trail-feedback-captures`.

Once the token is set, this lists the newest reports:

```sh
curl -H "Authorization: Bearer $FEEDBACK_ADMIN_TOKEN" "$FEEDBACK_URL/admin/reports?limit=5"
```

A wrong token answers `401`.

## Admin Routes

| Route                       | Does                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/reports`        | Lists reports, newest first. Filters: `status`, `contentId`, `skillId`, `since`, `until`. Pages with `limit` and `cursor`. |
| `GET /admin/reports/:id`    | One report, or `404`.                                                                                                      |
| `PATCH /admin/reports`      | Sets `status`, `groupKey`, `issueNumber`, or `issueClosedAt` on up to 200 `ids`. Answers `{ updated }`.                    |
| `PATCH /admin/reports/:id`  | The same for one report, without `ids`.                                                                                    |
| `GET /admin/captures/:id`   | Streams the capture. With `?link=1` it answers `{ url, expiresAt }`, a link that works without the token for 7 days.       |
| `GET /captures/:id?exp&sig` | The signed link. A bad signature or an expired link answers `403`.                                                         |

`since` is inclusive and `until` exclusive, on the time the Worker received the report. Both take a date or an ISO time. Encode an offset's `+` as `%2B`, or use `Z` times. A list answers `{ reports, next }`. Pass `next` back as `cursor` until it's `null`.

## Retention

A Cron Trigger runs every day at 04:00 UTC. It deletes up to 1,000 reports and their captures per run, and the next run picks up the rest. A report goes:

- 90 days after `issueClosedAt`.
- 180 days after upload, if its status isn't `filed`.

A filed report whose issue is still open stays. Set `issueClosedAt` with `PATCH /admin/reports` when its issue closes. The cron also drops `daily_usage` rows older than 180 days. It runs on its own once deployed: Cloudflare lists it under the Worker's **Settings → Triggers**.

## Run It Locally

Wrangler keeps a local D1 and R2 in `feedback-worker/.wrangler/` (gitignored). For the admin routes, put a token in `feedback-worker/.dev.vars` (gitignored too):

```sh
FEEDBACK_ADMIN_TOKEN=dev-token
```

Then:

```sh
cd feedback-worker
npx wrangler d1 migrations apply DB --local
npx wrangler dev --test-scheduled
```

It listens on `http://localhost:8787`. `--test-scheduled` adds `/__scheduled`, which runs the cron once. `npm test -w @bright-trail/feedback-worker` needs none of this: the tests start their own in-memory D1 and R2 with Miniflare.
