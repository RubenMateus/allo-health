import type { StateStorage } from "zustand/middleware";

// Web is a development-only target. There, each store keeps its data in the
// browser's localStorage under its own prefix instead of a SQLite file.
// expo-sqlite's web build can't open the app's three databases side by side:
// its worker races when they open at once, and its storage pool only holds six
// files. localStorage stays in the browser and nothing here talks to the network.
//
// `asyncReads` matches the native storage for stores whose rehydrate callback
// reads the store itself, so it must run after `create` returns.
export function createBrowserStorage(
  name: string,
  { asyncReads = false }: { asyncReads?: boolean } = {},
): StateStorage {
  const prefix = `allo-health/${name}/`;
  const store = (): Storage | null => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null;
    }
  };

  const read = (key: string) => store()?.getItem(prefix + key) ?? null;

  return {
    getItem: (key) => (asyncReads ? Promise.resolve(read(key)) : read(key)),
    setItem: (key, value) => store()?.setItem(prefix + key, value),
    removeItem: (key) => store()?.removeItem(prefix + key),
  };
}
