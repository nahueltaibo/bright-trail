// OTA updates only reach APKs with the same runtime version, so a major bump means a new APK.
// The e2e build must run the JS it was built with, so it never checks for OTA updates.
module.exports = ({ config }) => {
  const major = Number(config.version.split('.')[0]);
  return {
    ...config,
    runtimeVersion: String(major),
    android: { ...config.android, versionCode: major },
    updates: { ...config.updates, enabled: process.env.EXPO_PUBLIC_E2E !== '1' },
  };
};
