const mockMemory = new Map<string, string>();

jest.mock("@/services/settings/storage", () => ({
  settingsStorage: {
    getItem: (key: string) => mockMemory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mockMemory.set(key, value);
    },
    removeItem: (key: string) => {
      mockMemory.delete(key);
    },
  },
}));

import { resolveColorScheme, useSettingsStore } from "./settingsStore";

describe("settings store", () => {
  beforeEach(() => {
    mockMemory.clear();
    useSettingsStore.setState({ themePreference: "dark", lastSyncedAt: null });
  });

  it("keeps the original dark look by default", () => {
    expect(useSettingsStore.getState().themePreference).toBe("dark");
  });

  it("persists the theme choice and last sync on the device", () => {
    useSettingsStore.getState().setThemePreference("light");
    useSettingsStore
      .getState()
      .markSynced(new Date("2026-10-24T17:00:00.000Z"));

    const persisted = JSON.parse(mockMemory.get("allo-settings") ?? "{}");
    expect(persisted.state).toEqual({
      themePreference: "light",
      lastSyncedAt: "2026-10-24T17:00:00.000Z",
    });
  });

  it("restores a saved choice synchronously", () => {
    mockMemory.set(
      "allo-settings",
      JSON.stringify({
        version: 1,
        state: { themePreference: "system", lastSyncedAt: null },
      }),
    );
    void useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().themePreference).toBe("system");
  });
});

describe("resolveColorScheme", () => {
  it("uses an explicit choice regardless of the OS", () => {
    expect(resolveColorScheme("light", "dark")).toBe("light");
    expect(resolveColorScheme("dark", "light")).toBe("dark");
  });

  it("follows the OS for system, falling back to dark", () => {
    expect(resolveColorScheme("system", "light")).toBe("light");
    expect(resolveColorScheme("system", "dark")).toBe("dark");
    expect(resolveColorScheme("system", null)).toBe("dark");
  });
});
