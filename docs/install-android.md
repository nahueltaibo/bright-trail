# Installing BrightTrail on a Phone or Tablet

BrightTrail isn't on the Play Store yet, so you install it from a file (an APK). Once it's installed, it runs on its own: no computer, no internet, no Wi-Fi needed.

Each device keeps its own data. If the kids use different tablets, check progress on each one.

## 1. Get the APK onto the Device

The file looks like `bright-trail-1.0.0-2026.11.07-53.apk`. Pick whichever way is easiest:

- **Google Drive.** Upload the APK to Drive on the computer. On the device, open the Drive app, tap the file, and tap **Install**.
- **Email.** Attach the APK and send it to an account on the device. Open the email there and tap the attachment. If the mail app won't open it, use Drive instead.
- **USB cable.** Plug the device in, pick **File transfer** on its screen, and copy the APK into its `Download` folder. Unplug, open **My Files** (Samsung) or **Files**, go to **Downloads**, and tap the APK.

## 2. Allow the Install

The first time, Android asks for permission to install apps from wherever the file came from (Drive, Gmail, or My Files):

- Tap **Settings** on the prompt, turn on **Allow from this source**, then go back.
- If you missed the prompt: **Settings → Apps → ⋮ → Special access → Install unknown apps**, pick the app, and turn it on.
- Play Protect may warn that it doesn't recognize the app. Tap **More details → Install anyway**. It's signed with a test key, not a store key, so that's expected.

You can turn the permission back off after installing.

## 3. Install and Set Up

Tap **Install**, then **Open**. On the kids' screen:

- Tap the 🔒 in the top-right corner. The first time, it asks you to **Set a parent PIN**. Enter it twice.
- **Write the PIN down.** There's no "forgot PIN" yet, and getting back in means reinstalling, which wipes everything.
- In the parent area, tap **Add a child** for each kid using this device.

## Upgrading Without Losing Progress

Install the new APK the same way, right over the old one. Android says **Update** instead of Install. Children, progress, flags, and the PIN all stay.

- **Never uninstall first.** Uninstalling deletes everything the app saved on that device.
- If Android says **App not installed** or **package conflicts with an existing package**, the new file was built with a different key. Stop there, export the data (below), and ask whoever built it.

## Exporting the Log

Open the parent area (🔒 and your PIN), scroll to **Export**, and tap **Export all data**. The share sheet opens with a file like `bright-trail-export-2026-11-07T15-30-00.json`. Save it to Drive or email it to yourself. It holds every answer, with the children and their mastery.

## Where the APK Comes From

CI builds it on every change merged to `main`. Open the repo's **Actions** tab, pick the latest **CI** run on `main`, and download **family-apk** under **Artifacts**. It's a zip with the APK inside, kept for 30 days. To build one without a merge, use **Run workflow** on the CI page.

## Building It Yourself

You need the Android setup from [e2e/README.md](../e2e/README.md#setup) (SDK, JDK 17, and CMake 3.31+ on Windows). From the repo root:

```sh
npm run android:build:family
```

It writes `dist/bright-trail-<appVersion>-<bundleVersion>.apk`, with the content bundled and dev screens hidden. The bundle version comes from `content/out/bundle.json`, so rebuild after regenerating content. Then share the file as above, or install it over USB:

```sh
npm run android:install -- --device <serial>
```

That runs `adb install -r`, which keeps the child's data. Find the serial with `adb devices`. If the installed app was signed with another key, the script explains why it can't upgrade and asks before uninstalling, since that wipes the device's data.

The APK is signed with the debug keystore from Expo's template, which is fine for sideloading during the POC. Every build made from this repo uses that same key, so any of them can upgrade any other, including the e2e build. A Play Store release needs a real upload key.
