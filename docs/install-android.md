# Installing BrightTrail on a Phone or Tablet

BrightTrail isn't on the Play Store, so you install it once from a file (an APK). After that it updates itself: open the app with internet and it downloads the new version in the background, then the next time you open it, it runs the new one. No computer and no Play Store needed. Lessons work offline.

Each device keeps its own data. If the kids use different tablets, check progress on each one.

## 1. Get the APK onto the Device

The file looks like `bright-trail-1.0.0-2026.11.07-53.apk`. Upload it to Google Drive on the computer. On the device, open the Drive app, tap the file, and tap **Install**.

Email works too: attach the APK, open the email on the device, and tap the attachment. If the mail app won't open it, use Drive.

## 2. Allow the Install

The first time, Android asks for permission to install apps from wherever the file came from (Drive or Gmail):

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
- Now and then a bigger change needs a new APK. You'll get a new file. Install it from Drive right over the old one. Android says **Update** instead of Install, and children, progress, flags, and the PIN all stay.
- **Never uninstall.** Uninstalling deletes everything the app saved on that device.
- If Android says **App not installed** or **package conflicts with an existing package**, the file was signed with a different key. Stop, export the data (below), and ask whoever built it.

## Exporting the Log

Open the parent area (🔒 and your PIN), scroll to **Export**, and tap **Export all data**. The share sheet opens with a file like `bright-trail-export-2026-11-07T15-30-00.json`. Save it to Drive or email it to yourself. It holds every answer, with the children and their mastery.

## For the Maintainer

You need the Android setup from [e2e/README.md](../e2e/README.md#setup) (SDK, JDK 17, and CMake 3.31+ on Windows), and an Expo login for publishing (`npx -y eas-cli@latest login`). The app is the `@nahueltaibo/bright-trail` project on [expo.dev](https://expo.dev/accounts/nahueltaibo/projects/bright-trail).

### The Release Key

Family APKs are signed with a release key that lives outside the repo:

- `%USERPROFILE%\.bright-trail\release.keystore` — the key itself.
- `%USERPROFILE%\.bright-trail\release.properties` — its path, alias, and passwords. Set `BRIGHT_TRAIL_SIGNING` to use another location.

**Back up both files** somewhere safe and private (a password manager or an encrypted drive, not the repo). Android only upgrades an app with an APK signed by the same key. Lose it, and the next APK can't install over the old one, so every device has to uninstall and lose its data. OTA updates keep working without the key, but only until a new APK is needed.

The family build fails if the key is missing. The e2e build keeps Expo's debug key, so an e2e build and a family build can't upgrade each other. On a test device, uninstall one before installing the other.

### Publishing an Update

From the repo root:

```sh
npm run ota:publish -- --message "Add fractions stories"
```

It checks the Expo login, runs lint, typecheck, and tests, then publishes the JS and content to the `production` channel for Android. Devices download it on their next launch and run it on the launch after that. Updates are off in the e2e build, so Maestro always tests the code it was built with.

### When to Build a New APK

The runtime version is a fingerprint of the native side: native modules and their versions, `app.json`/`app.config.js`, and config plugins. An update only reaches devices whose APK has the same fingerprint, so a JS-only change ships as an update. Adding or upgrading a native package (anything installed with `npx expo install` that has native code), upgrading the Expo SDK, or changing app config needs a new APK:

```sh
npm run android:build:family
```

It writes `dist/bright-trail-<appVersion>-<bundleVersion>.apk`. Share it by Drive. Publishing an update after a native change does nothing for older APKs: they keep running their last compatible update. Check the runtime version in **About this app** against the one `ota:publish` prints if an update doesn't show up.

To install over USB instead:

```sh
npm run android:install -- --device <serial>
```

That runs `adb install -r`, which keeps the child's data. Find the serial with `adb devices`. If the installed app was signed with another key, the script explains why it can't upgrade and asks before uninstalling, since that wipes the device's data.
