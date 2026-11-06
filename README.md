# BrightTrail

An AI-assisted learning app for kids. The POC is an Expo app for phone and tablet (web later), plus Node scripts that generate the learning content offline with the Claude API. Specs live in [.docs/](.docs/).

## Layout

It's an npm workspaces monorepo:

- `app/` — Expo (React Native, TypeScript) app with Expo Router. Screens live in `app/src/app/`.
- `content/` — Node + TypeScript build scripts, run with `tsx`.
- `shared/` — Zod schemas and inferred types for the content bundle, mastery, attempts, and child profiles. Both sides import it as `@bright-trail/shared`. A sample bundle lives at `shared/fixtures/sample-bundle.json`.

## Getting started

Needs Node 22.13+ or 24.3+ (tested on 24.21). From the repo root:

```sh
npm install
```

## Scripts

Run these from the root:

- `npm run app:start` — start the Expo dev server. Scan the QR code with Expo Go on a phone or tablet.
- `npm run content:validate` — validate a content bundle. Checks the sample bundle by default. Pass a path with `npm run content:validate -- path/to/bundle.json`.
- `npm test` — Vitest in `shared/` and `content/`, jest-expo in `app/`.
- `npm run typecheck` — `tsc` in every package.
- `npm run lint` — ESLint across the repo.
- `npm run format` — Prettier writes fixes. `npm run format:check` only reports.
