const { transformIgnorePatterns } = require("jest-expo/jest-preset");

module.exports = {
  preset: "jest-expo",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  // nativewind ships untranspiled JSX in its test helpers.
  transformIgnorePatterns: [
    transformIgnorePatterns[0].replace("(?!(", "(?!(nativewind|"),
    ...transformIgnorePatterns.slice(1),
  ],
};
