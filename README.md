# BrightTrail

An AI-assisted learning app for kids. The POC is an Expo app for phone and tablet (web later), plus Node scripts that generate the learning content offline with the Claude API. Specs live in [.docs/](.docs/).

## Layout

It's an npm workspaces monorepo:

- `app/` — Expo (React Native, TypeScript) app with Expo Router. Screens live in `app/src/app/`.
- `content/` — Node + TypeScript build scripts, run with `tsx`.
- `shared/` — TypeScript types both sides import as `@bright-trail/shared`.

## Getting started

Needs Node 22.13+ or 24.3+ (tested on 24.21). From the repo root:

```sh
npm install
```

## Scripts

Run these from the root:

- `npm run app:start` — start the Expo dev server. Scan the QR code with Expo Go on a phone or tablet.
- `npm run content:hello` — sample content script. Pass a name with `npm run content:hello -- Ana`.
- `npm test` — Vitest in `shared/` and `content/`, jest-expo in `app/`.
- `npm run typecheck` — `tsc` in every package.
- `npm run lint` — ESLint across the repo.
- `npm run format` — Prettier writes fixes. `npm run format:check` only reports.
