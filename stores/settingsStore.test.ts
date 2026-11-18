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

import {
  migrateSettings,
  resolveColorScheme,
  useSettingsStore,
} from "./settingsStore";

describe("settings store", () => {
  beforeEach(() => {
    mockMemory.clear();
    useSettingsStore.setState({
      themePreference: "dark",
      lastSyncedAt: null,
      onboardingCompletedAt: null,
    });
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
      onboardingCompletedAt: null,
    });
  });

  it("starts with onboarding not done", () => {
    expect(useSettingsStore.getState().onboardingCompletedAt).toBeNull();
  });

  it("persists finishing onboarding", () => {
    useSettingsStore
      .getState()
      .completeOnboarding(new Date("2026-11-18T09:00:00.000Z"));
    const persisted = JSON.parse(mockMemory.get("allo-settings") ?? "{}");
    expect(persisted.state.onboardingCompletedAt).toBe(
      "2026-11-18T09:00:00.000Z",
    );
  });

  it("resets onboarding for replay", () => {
    useSettingsStore.getState().completeOnboarding();
    useSettingsStore.getState().resetOnboarding();
    expect(useSettingsStore.getState().onboardingCompletedAt).toBeNull();
  });

  it("shows onboarding once to existing installs", () => {
    useSettingsStore.setState({ onboardingCompletedAt: "x" });
    mockMemory.set(
      "allo-settings",
      JSON.stringify({
        version: 1,
        state: { themePreference: "light", lastSyncedAt: null },
      }),
    );
    void useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().themePreference).toBe("light");
    expect(useSettingsStore.getState().onboardingCompletedAt).toBeNull();
  });

  it("keeps a finished intro when a later version migrates", () => {
    // A future version bump migrates v2 data, which already has the flag.
    const v2 = {
      themePreference: "dark",
      lastSyncedAt: null,
      onboardingCompletedAt: "2026-11-18T09:00:00.000Z",
    };
    expect(migrateSettings(v2, 2)).toEqual(v2);
    expect(migrateSettings({ themePreference: "light" }, 1)).toEqual({
      themePreference: "light",
      onboardingCompletedAt: null,
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
