/** Dev-only screens also ship in the e2e APK, a release build made with `EXPO_PUBLIC_E2E=1`. */
export const SHOW_DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_E2E === '1';
