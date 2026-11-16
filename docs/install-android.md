# Installing BrightTrail on a Phone or Tablet

BrightTrail isn't on the Play Store, so you install it once from a file (an APK). After that it updates itself: open the app with internet and it downloads the new version in the background, then the next time you open it, it runs the new one. No computer and no Play Store needed. Lessons work offline.

Each device keeps its own data. If the kids use different tablets, check progress on each one.

## 1. Get the APK onto the Device

On the device, open the browser and sign in to GitHub with an account that can see the repo. Go to the [Releases page](https://github.com/nahueltaibo/bright-trail/releases), open the latest release, and tap the file under **Assets** that looks like `bright-trail-1.0.0-2026.11.07-53.apk`. Open it from the download notification.

Drive works too: download the APK on the computer, upload it to Google Drive, then open it from the Drive app on the device.

## 2. Allow the Install

The first time, Android asks for permission to install apps from wherever the file came from (the browser or Drive):

- Tap **Settings** on the prompt, turn on **Allow from this source**, then go back.
- If you missed the prompt: **Settings → Apps → ⋮ → Special access → Install unknown apps**, pick the app, and turn it on.
- Play Protect may warn that it doesn't recognize the app. Tap **More details → Install anyway**. It's expected for apps that aren't from the Play Store.

You can turn the permission back off after installing.

## 3. Install and Set Up

Tap **Install**, then **Open**. On the kids' screen:

- Tap the 🔒 in the top-right corner. The first time, it asks you to **Set a parent PIN**. Enter it twice.
- **Write the PIN down.** There's no "forgot PIN" yet, and getting back in means reinstalling, which wipes everything.
- In the parent area, tap **Add a child** for each kid using this device.

## Updates

Most updates (new lessons, fixes) arrive by themselves. Open the app, close it, and open it again to get the newest version. The kids never see a prompt.

- To check right away, open the parent area and scroll to **About this app**. Tap **Check for updates**, then **Restart now**.
- **About this app** also shows the app version, the update the device is running, and the content version. Handy when something looks off.
- Now and then a bigger change needs a new APK. It shows up as a new release whose first number went up, like `2.0.0`. Install it the same way, right over the old one. Android says **Update** instead of Install, and children, progress, flags, and the PIN all stay.
- **Never uninstall.** Uninstalling deletes everything the app saved on that device.
- If Android says **App not installed** or **package conflicts with an existing package**, the file was signed with a different key. Stop, export the data (below), and ask whoever built it.

## Exporting the Log

Open the parent area (🔒 and your PIN), scroll to **Export**, and tap **Export all data**. The share sheet opens with a file like `bright-trail-export-2026-11-07T15-30-00.json`. Save it to Drive or email it to yourself. It holds every answer, with the children and their mastery.

## For the Maintainer

CI ships every change on `main`. A major version bump builds a new APK as a GitHub release, and anything else goes out as an OTA update. [AGENTS.md](../AGENTS.md#versions-and-releases) has the rules for bumping the version. The app is the `@nahueltaibo/bright-trail` project on [expo.dev](https://expo.dev/accounts/nahueltaibo/projects/bright-trail).

The steps below are for doing it by hand. You need the Android setup from [e2e/README.md](../e2e/README.md#setup) (SDK, JDK 17, and CMake 3.31+ on Windows), an Expo login (`npx -y eas-cli@latest login`), and `gh` logged in.

### The Release Key

Family APKs are signed with a release key that lives outside the repo:

- `%USERPROFILE%\.bright-trail\release.keystore` — the key itself.
- `%USERPROFILE%\.bright-trail\release.properties` — its path, alias, and passwords. Set `BRIGHT_TRAIL_SIGNING` to use another location.

CI gets the same key from repo secrets. **Back up both files** somewhere safe and private (a password manager or an encrypted drive, not the repo). Android only upgrades an app with an APK signed by the same key. Lose it, and the next APK can't install over the old one, so every device has to uninstall and lose its data. OTA updates keep working without the key, but only until a new APK is needed.

The family build fails if the key is missing. The e2e build keeps Expo's debug key, so an e2e build and a family build can't upgrade each other. On a test device, uninstall one before installing the other.

### The Update Signing Key

From 3.0.0 on, every OTA update is signed, and the APK only runs updates signed with the matching key. The pieces:

- `app/certs/certificate.pem` — the public certificate, committed. The APK embeds it. It expires in November 2036.
- `%USERPROFILE%\.bright-trail\updates\private-key.pem` — the private key. Never commit it. Set `EXPO_UPDATES_PRIVATE_KEY_PATH` to use another location.
- `EXPO_UPDATES_PRIVATE_KEY` — the same key as a repo secret, for CI.

`npm run ota:publish` and the CI step both refuse to run without the key, so nothing goes out unsigned. **Back up the private key** with the release key. Lose it, and devices can't get OTA updates until they install an APK with a new certificate.

To rotate the key, for a leak, a loss, or before the certificate expires:

1. Generate a new pair from `app/`: `npx expo-updates codesigning:generate --key-output-directory "$HOME/.bright-trail/updates" --certificate-output-directory certs --certificate-validity-duration-years 10 --certificate-common-name "BrightTrail"`. It overwrites the old files, so back them up first if you still need them.
2. Store the new key in CI: `gh secret set EXPO_UPDATES_PRIVATE_KEY < "$HOME/.bright-trail/updates/private-key.pem"`.
3. Bump the major version in the same PR as the new certificate. The certificate is part of the native fingerprint, so CI fails the PR without the bump.
4. After it merges, every device installs the new APK. Old APKs only accept the old key, so they get no more updates.

### Publishing an Update

From the repo root:

```sh
npm run ota:publish -- --message "Add fractions stories"
```

It checks the Expo login and the native fingerprint, runs lint, typecheck, and tests, then publishes the JS and content to the `production` channel for Android. Devices download it on their next launch and run it on the launch after that. Updates are off in the e2e build, so Maestro always tests the code it was built with.

### When to Build a New APK

Whenever the major version goes up. An update only reaches APKs with the same major version, so after a native change older APKs keep running their last compatible update. To build one by hand:

```sh
npm run android:build:family
```

It writes `dist/bright-trail-<appVersion>-<bundleVersion>.apk`. If an update doesn't show up on a device, compare the runtime version in **About this app** with the major version in `app/app.json`.

To install over USB instead:

```sh
npm run android:install -- --device <serial>
```

That runs `adb install -r`, which keeps the child's data. Find the serial with `adb devices`. If the installed app was signed with another key, the script explains why it can't upgrade and asks before uninstalling, since that wipes the device's data.
