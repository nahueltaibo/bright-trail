// Metro loads its config as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build loads SQLite as a .wasm asset.
config.resolver.assetExts.push('wasm');

module.exports = config;
