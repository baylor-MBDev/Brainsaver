// app.json holds the config; this only lets CI stamp the Android
// versionCode. Play rejects any upload whose versionCode isn't higher than
// the last one, so CI derives it from the run number instead of relying on
// hand-edited bumps. Local builds fall back to the value in app.json.
module.exports = ({ config }) => {
  const fromCI = Number(process.env.ANDROID_VERSION_CODE);
  if (!Number.isInteger(fromCI) || fromCI <= 0) return config;
  return { ...config, android: { ...config.android, versionCode: fromCI } };
};
