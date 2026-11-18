import type { ConfigContext, ExpoConfig } from "expo/config";

function gitShortSha(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execSync } = require("child_process") as {
    execSync: (command: string, options: object) => { toString(): string };
  };
  return execSync("git rev-parse --short HEAD", {
    stdio: ["ignore", "pipe", "ignore"],
  }).toString();
}

/** Short commit id of the build, or "dev" when git is unavailable. */
export function resolveCommit(run: () => string = gitShortSha): string {
  try {
    return run().trim() || "dev";
  } catch {
    return "dev";
  }
}

// app.json stays the base config so release-please can bump expo.version.
// This only adds the build's commit, shown next to the version in Settings.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    commit: resolveCommit(),
  },
});
