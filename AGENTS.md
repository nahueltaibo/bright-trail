# Agent Notes

Context for coding agents working in this repo. Read [README.md](README.md) for layout and scripts first. Expo-specific rules live in [app/AGENTS.md](app/AGENTS.md).

## Where Things Stand

- Specs are HTML under [.docs/](.docs/): product requirements, POC requirements, and the POC task plan. Task IDs (T1, C2, A6, I1, …) come from [.docs/poc-tasks.html](.docs/poc-tasks.html), and branches are named after them (`a6-session-flow`).
- The design system lives in [.docs/design/](.docs/design/). Each component has a `README.md` and a `preview.html`. Tokens are in `tokens.json`.
- `content/out/skills.json` holds the generated K–6 skill graph. `content/out/bundle.json` holds the generated stories and items, scoped to the targets in `content/bundle-scope.json` plus their prerequisites. Generation and its checks live in `content/src/generate/`.
- The app still plays the 3-skill sample bundle from `shared/fixtures/sample-bundle.json`. Swapping in `content/out/bundle.json` is task I1, through `loadBundle()` in `app/src/content/loadBundle.ts`.

## Code Map

- `shared/src/engine/` — learner engine: mastery, unlocks, next step. Pure TypeScript.
- `shared/src/placement/` — adaptive placement probe.
- `shared/src/speech/` — `toSpeech` reads math formatting aloud.
- `app/src/session/` — the kid session controller: placement, then reviews, probes, and lessons.
- `app/src/storage/` — expo-sqlite with migrations and a Zod-validated repository. Tests run it on Node's SQLite (`storage/testing/`).
- `app/src/parent/` — PIN-gated parent area. `*.native.ts` files hold the phone versions. On web the PIN hash goes in the `settings` table, since expo-secure-store has no web support.
- `app/src/learning/` and `app/src/narration/` — item screens and expo-speech narration.
- `/dev/learning` is a preview of every item type. It shows when `__DEV__` is true or the build sets `EXPO_PUBLIC_E2E=1`.

## Checking Your Work

Run what CI runs, in this order, before calling a task done:

```sh
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

To see the app, run `npm run dev` and open `http://localhost:8081`. Drive it with Playwright MCP and save screenshots under `.playwright-mcp/` (gitignored). The web build keeps its SQLite data in the browser, so clear site data for `localhost:8081` to start from a fresh install.

## Gotchas

- **Stale `node_modules`.** Work often happens in `.claude/worktrees/`, which install their own deps. The main checkout can then miss packages a merged branch added, and Metro fails with `Unable to resolve "expo-crypto"`. `npm run dev` reinstalls when `package-lock.json` is newer than `node_modules/.package-lock.json`. Otherwise run `npm install`.
- **Port 8081 on Windows.** `Get-NetTCPConnection` can report Metro's listener with state `Closed`, and `netstat` may not list it at all. Find the owner by port, not by state.
- **Adding app deps.** Use `npx expo install <pkg>` from `app/`, never plain `npm install`, so versions match Expo SDK 58.
- **ESLint 10.** `eslint-plugin-react` can't auto-detect the React version, so `eslint.config.mjs` pins it. Bump it there when React changes.
- **Curriculum text.** `content/sources/` stays byte-for-byte as fetched. Prettier ignores it. Don't reformat it.
- **LLM calls.** `npm run content:graph` and `npm run content:generate` use the Claude Code CLI in headless mode by default. Responses cache in `content/cache/llm/`, which is committed, so reruns are free unless a prompt changed.
- **Android e2e.** Windows builds need CMake 3.31+ and long paths on. See [e2e/README.md](e2e/README.md).
