const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// inlineRem keeps 1rem at 16px on iOS and Android, matching the web default.
module.exports = withNativeWind(config, {
  input: "./global.css",
  configPath: "./tailwind.config.ts",
  inlineRem: 16,
});
