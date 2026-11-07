// The e2e build must run the JS it was built with, so it never checks for OTA updates.
module.exports = ({ config }) => ({
  ...config,
  updates: { ...config.updates, enabled: process.env.EXPO_PUBLIC_E2E !== '1' },
});
