# Setting Up the Feedback Worker

Testers' reports go to a Cloudflare Worker in [feedback-worker/](../feedback-worker/). It keeps reports in a D1 database and captures in a private R2 bucket. CI deploys it on every push to `main`, and needs these settings:

| Setting                   | Kind     | Where it comes from                        |
| ------------------------- | -------- | ------------------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID`   | Secret   | Your Cloudflare account ID                 |
| `CLOUDFLARE_API_TOKEN`    | Secret   | An API token that can deploy Workers       |
| `FEEDBACK_D1_DATABASE_ID` | Variable | The id of the D1 database you create below |

Until all three are set, CI skips the deploy with a warning. Setting only some fails the run.

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

## 6. Check It Works

The next push to `main` runs the `deploy-feedback` job. It applies migrations, then deploys, and the log ends with the Worker's URL, like `https://bright-trail-feedback.<subdomain>.workers.dev`. A `GET` on `/v1/reports` there answers `405`.

If it fails:

- `Missing feedback Worker settings: ...` means a secret or the variable is unset or misspelled.
- An authentication error means the token lacks a permission from step 4.
- `Couldn't find a D1 DB` means `FEEDBACK_D1_DATABASE_ID` doesn't match the database.
- A bucket error means the bucket name isn't exactly `bright-trail-feedback-captures`.

## 7. Point the App at It

Save the Worker's URL from step 6 as a repo variable, with no trailing path:

```sh
gh variable set EXPO_PUBLIC_FEEDBACK_URL --body "https://bright-trail-feedback.<subdomain>.workers.dev"
```

The next APK and OTA update bake it in. It's optional: without it, the app keeps flagged reports queued on the device and uploads them once a build has the URL. For a local run, set it in the shell before `npm run dev`, such as `http://localhost:8787` for the local Worker below.

## Run It Locally

Wrangler keeps a local D1 and R2 in `feedback-worker/.wrangler/` (gitignored):

```sh
cd feedback-worker
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

It listens on `http://localhost:8787`. `npm test -w @bright-trail/feedback-worker` needs none of this: the tests start their own in-memory D1 and R2 with Miniflare.
