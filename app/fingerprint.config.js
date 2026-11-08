// Versions change on every release and the scripts change during prebuild. Neither touches the
// native app, so neither should demand a new APK.
module.exports = {
  platforms: ['android'],
  sourceSkips: ['ExpoConfigVersions', 'ExpoConfigRuntimeVersionIfString', 'PackageJsonScriptsAll'],
};
