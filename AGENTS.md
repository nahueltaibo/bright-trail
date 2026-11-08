# Agent Notes

Context for coding agents working in this repo. Read [README.md](README.md) for layout and scripts first. Expo-specific rules live in [app/AGENTS.md](app/AGENTS.md).

## Where Things Stand

- Specs are HTML under [.docs/](.docs/): product requirements, POC requirements, and the POC task plan. Task IDs (T1, C2, A6, I1, …) come from [.docs/poc-tasks.html](.docs/poc-tasks.html), and branches are named after them (`a6-session-flow`).
- The design system lives in [.docs/design/](.docs/design/). Each component has a `README.md` and a `preview.html`. Tokens are in `tokens.json`.
- `content/out/skills.json` holds the generated K–6 skill graph. `content/out/bundle.json` holds the generated stories and items, scoped to the targets in `content/bundle-scope.json` plus their prerequisites. Generation and its checks live in `content/src/generate/`.
- `content/scenes.json` maps item ids to sharing scenes. `npm run content:scenes` writes it with one cached LLM call per sharing skill, then adds the scenes to the bundle. Code keeps a scene only when its answer matches the item's, so a regenerated item loses a stale scene.
- The app plays `content/out/bundle.json` through `loadBundle()` in `app/src/content/loadBundle.ts`.
- Family devices run a release-signed APK from `npm run android:build:family` and get JS and content changes over the air from `npm run ota:publish`. See [docs/install-android.md](docs/install-android.md).

## Code Map

- `shared/src/engine/` — learner engine: mastery, unlocks, next step. Pure TypeScript.
- `shared/src/placement/` — adaptive placement probe.
- `shared/src/speech/` — `toSpeech` reads math formatting aloud.
- `shared/src/scene.ts` — sharing scenes: what an item asks, its things and containers, and `sceneProblems`, which checks a scene against its item.
- `app/src/session/` — the kid session controller: placement, then reviews, probes, and lessons.
- `app/src/storage/` — expo-sqlite with migrations and a Zod-validated repository. Tests run it on Node's SQLite (`storage/testing/`).
- `app/src/parent/` — PIN-gated parent area. `*.native.ts` files hold the phone versions. On web the PIN hash goes in the `settings` table, since expo-secure-store has no web support.
- `app/src/learning/` and `app/src/narration/` — item screens and expo-speech narration.
- `app/src/learning/minigames/` — the sharing minigame. Any item with a `scene` plays there instead of its usual screen. It allows retries during a lesson's check, and plays out the first answer then moves on when `measuring`.
- `/dev/learning` is a preview of every item type. `/dev/share` plays one sharing item per kind of question. Both show when `__DEV__` is true or the build sets `EXPO_PUBLIC_E2E=1`.

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
- **OTA updates.** `runtimeVersion` uses the `fingerprint` policy, so native or app-config changes need a new family APK. `app.config.js` turns updates off when `EXPO_PUBLIC_E2E=1`.
- **Android e2e.** Windows builds need CMake 3.31+ and long paths on. See [e2e/README.md](e2e/README.md).
