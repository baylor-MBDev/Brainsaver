const { withAppBuildGradle } = require('@expo/config-plugins');

// Adds a release signingConfig that reads from Gradle properties
// (RELEASE_STORE_FILE / RELEASE_STORE_PASSWORD / RELEASE_KEY_ALIAS /
// RELEASE_KEY_PASSWORD) when they're supplied, and falls back to the
// debug keystore otherwise -- so local builds and CI runs before the
// signing secrets are configured keep working unchanged.
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const debugBlock = `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

    const withRelease = `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(RELEASE_STORE_FILE)
                storePassword RELEASE_STORE_PASSWORD
                keyAlias RELEASE_KEY_ALIAS
                keyPassword RELEASE_KEY_PASSWORD
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }`;

    if (contents.includes(debugBlock)) {
      contents = contents.replace(debugBlock, withRelease);
    }

    const debugSigned = `release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
    const releaseSigned = `release {
            signingConfig signingConfigs.release`;

    if (contents.includes(debugSigned)) {
      contents = contents.replace(debugSigned, releaseSigned);
    }

    config.modResults.contents = contents;
    return config;
  });
};
