# Setting Up Cloudflare R2 for Content Packs

CI uploads the content packs to a Cloudflare R2 bucket on every push to `main`. It needs four repo secrets, and this guide shows where each one comes from:

| Secret                 | Where it comes from        |
| ---------------------- | -------------------------- |
| `R2_ACCOUNT_ID`        | Your Cloudflare account ID |
| `R2_BUCKET`            | The bucket name you pick   |
| `R2_ACCESS_KEY_ID`     | An R2 API token            |
| `R2_SECRET_ACCESS_KEY` | The same R2 API token      |

Until all four are set, CI skips the upload with a warning. Setting only some fails the run.

## 1. Turn On R2

Sign up or log in at [dash.cloudflare.com](https://dash.cloudflare.com). Open **R2 Object Storage** in the sidebar and follow the prompt to enable it.

R2 asks for a payment method even on the free tier. The free tier covers 10 GB of storage and has no download fees, and the packs are well under 1 MB, so you shouldn't get billed.

## 2. Create the Bucket

On the R2 page, click **Create bucket**:

- **Name:** something like `bright-trail-content`. This is `R2_BUCKET`.
- **Location:** leave it on **Automatic**.
- **Storage class:** **Standard**.

Leave public access off. The app doesn't download packs from the bucket yet.

## 3. Find the Account ID

The R2 overview page shows **Account ID** under **Account Details** on the right. Copy it. This is `R2_ACCOUNT_ID`.

It's also the long hex string in the dashboard URL: `dash.cloudflare.com/<account-id>/r2/overview`.

## 4. Create an API Token

From the R2 overview page, click **Manage API tokens** (under **Account Details**, or the **{} API** button), then **Create Account API token**:

- **Token name:** `bright-trail-ci`.
- **Permissions:** **Object Read & Write**.
- **Specify bucket(s):** **Apply to specific buckets only**, then pick the bucket from step 2. CI can then touch nothing else.
- **TTL:** **Forever**, or a date if you'd rather rotate it.

Click **Create API Token**. The next page shows several values. You need two of them:

- **Access Key ID** → `R2_ACCESS_KEY_ID`.
- **Secret Access Key** → `R2_SECRET_ACCESS_KEY`.

**Copy the secret now.** Cloudflare shows it only once. If you lose it, delete the token and make a new one. Ignore the **Token value** field, which is for the Cloudflare API, not the S3 API the publish script uses.

## 5. Add the Secrets to GitHub

In the repo on GitHub, go to **Settings → Secrets and variables → Actions → New repository secret** and add each of the four.

Or use the GitHub CLI from the repo folder. Each command prompts for the value, so it doesn't land in your shell history:

```sh
gh secret set R2_ACCOUNT_ID
gh secret set R2_BUCKET
gh secret set R2_ACCESS_KEY_ID
gh secret set R2_SECRET_ACCESS_KEY
```

## 6. Check It Works

The next push to `main` runs `npm run content:publish`. Open the run in the **Actions** tab. The publish step should end with `Published N files to R2 bucket <name>.`, and the files show up in the bucket on the Cloudflare dashboard.

If it fails:

- `Missing R2 settings: ...` means one of the secrets is unset or misspelled.
- `AccessDenied` means the token lacks **Object Read & Write**, or it's scoped to a different bucket.
- `NoSuchBucket` means `R2_BUCKET` doesn't match the bucket name exactly.

To publish from your own machine, install the [AWS CLI](https://aws.amazon.com/cli/), set the same four variables in your shell, and run `npm run content:publish`. GitHub's runners already have the AWS CLI.
