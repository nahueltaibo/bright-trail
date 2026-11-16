// Versions change on every release and the scripts change during prebuild. Neither touches the
// native app, so neither should demand a new APK.
// The APK embeds the update signing certificate, so a new one needs a new APK.
module.exports = {
  platforms: ['android'],
  sourceSkips: ['ExpoConfigVersions', 'ExpoConfigRuntimeVersionIfString', 'PackageJsonScriptsAll'],
  extraSources: [
    { type: 'file', filePath: 'certs/certificate.pem', reasons: ['updatesCodeSigningCertificate'] },
  ],
};
