# E2E tests (Maestro, Android)

[Maestro](https://maestro.dev) flows for the core app, run against a standalone release APK on an emulator or a USB phone. They're not in CI, since that needs an emulator.

## What the flows cover

- `01-first-launch` — kid home shows the empty state and the parent lock.
- `02-parent-pin` — set a PIN (a mismatch starts over), leave, wrong PIN rejected, deleted digit ignored, right PIN accepted.
- `03-add-child` — name, avatar, birthdate, derived grade, override and back to Auto, save, edit the override, add a second child.
- `04-kid-home` — both avatars show, each opens a child home that greets them by name.
- `05-learning-preview` — one skill of the real bundle: story cards, a right and a wrong tap item, keypad, number line, flagging a card and an item. Answers come from the preview's dev bar.
- `06-parent-screens` — skill tree, placement review, flags list, export, reset and delete with confirmation.
- `07-session` — a fresh child's session: placement from Grade 1 down to Kindergarten, quit and resume on the same item, a flag, the first story and check, then the parent's placement review and flags list. Its wrong answers are pinned to the current bundle.

Each flow starts from a cleared app. Shared steps live in `subflows/`.

Not covered:

- **Narration.** Maestro can't hear audio. The preview's caption line shows what would be said, but the flows don't assert it.
- **Export contents.** The flow opens the share sheet, dismisses it, and checks the status line.
- **The caps.** The 10-minute cap needs a clock, and the 14-item placement split needs 15+ placement answers. Unit tests in `app/src/session/` cover them.

## Setup

- Android SDK with `ANDROID_HOME` set, and JDK 17. On Windows, also CMake 3.31+ (see Build).
- Maestro on `PATH`.
- An emulator running, or a phone with USB debugging on and the RSA prompt accepted. `adb devices` should list it as `device`.

## Build

```sh
npm run e2e:build:android
```

This runs `expo prebuild` (the generated `app/android/` is gitignored), then Gradle `assembleRelease`. The JS is bundled, so no Metro is needed and the same APK works on any device. It's built with `EXPO_PUBLIC_E2E=1`, which turns on the dev-only learning preview and turns off OTA updates. The family build (`npm run android:build:family`, see [docs/install-android.md](../docs/install-android.md)) hides the preview and gets updates. It's signed with the debug keystore from Expo's template, while the family build uses the release key, so uninstall one before installing the other on the same device.

The APK lands at `e2e/output/bright-trail-e2e.apk`. It holds `arm64-v8a` (phones) and `x86_64` (emulators). Set `E2E_ABIS` to change that, e.g. `E2E_ABIS=armeabi-v7a` for an old 32-bit phone.

On Windows, codegen's object folders run past 250 characters even from `C:\bt`. The SDK's default CMake 3.22 ships ninja 1.10, which fails there with `ninja: error: mkdir(...): No such file or directory`. So the script needs CMake 3.31 or newer and points Gradle at it through `app/android/local.properties`. Install it once, and make sure Windows long paths are on (`LongPathsEnabled` = 1):

```sh
sdkmanager "cmake;3.31.6"
```

## Run

```sh
npm run e2e:android                          # the only connected device
npm run e2e:android -- --device emulator-5554
```

It installs the APK, then runs `maestro test e2e/`. Extra arguments go to `maestro test`. Reports, logs, and screenshots go to `e2e/output/`, which is gitignored.

One flow on its own:

```sh
maestro --device <serial> test e2e/05-learning-preview.yaml
```
