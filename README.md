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

## Run It Locally

```sh
npm run dev                  # web, opens http://localhost:8081
npm run dev -- go            # QR code for Expo Go on a phone or tablet
npm run dev -- android       # Android emulator or USB device
npm run dev -- web --clear   # also wipe Metro's cache
```

It's safe to rerun: it stops whatever holds port 8081 first, so it doubles as a restart. It runs `npm install` when the lockfile changed since the last install. Other arguments go to `expo start`, e.g. `--port 8082`.

## Scripts

Run these from the root:

- `npm run dev` — start or restart the app. See above.
- `npm run app:start` — plain `expo start`, with no restart or install step.
- `npm run content:validate` — validate a content bundle. Checks the sample bundle by default. Pass a path with `npm run content:validate -- path/to/bundle.json`.
- `npm run content:graph` — build the skill graph from `content/sources/`. It calls Claude through the Claude Code CLI in headless mode, so it runs on your Claude Code login with no API key. Set `LLM_BACKEND=sdk` to call the API with `ANTHROPIC_API_KEY` instead. Writes `content/out/skills.json` and `content/out/skills-report.md`. Responses cache in `content/cache/llm/`, so a rerun only calls the API for prompts that changed.
- `npm run content:generate` — write a story and 15 items per skill through the same CLI and cache, check them, and build `content/out/bundle.json` and `content/out/content-report.md`. Failing skills regenerate with the reasons up to 2 times. It covers the targets in `content/bundle-scope.json` plus every skill they depend on. Pass `-- --all` for the whole graph. If the usage limit hits, it stops and keeps what's done: rerun to resume. Pass `-- --pilot` for the 6 pilot skills and `content/out/pilot-report.md`, or `-- --skills id,id` for a few.
- `npm test` — Vitest in `shared/` and `content/`, jest-expo in `app/`.
- `npm run typecheck` — `tsc` in every package.
- `npm run lint` — ESLint across the repo.
- `npm run format` — Prettier writes fixes. `npm run format:check` only reports.
- `npm run e2e:build:android` and `npm run e2e:android` — build the e2e APK and run the Maestro flows on a device. See [e2e/README.md](e2e/README.md).
