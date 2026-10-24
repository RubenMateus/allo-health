import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { settingsStorage } from "@/services/settings/storage";
import type { ColorScheme } from "@/theme/tokens";

export type ThemePreference = ColorScheme | "system";

type SettingsStore = {
  themePreference: ThemePreference;
  lastSyncedAt: string | null;
  setThemePreference: (preference: ThemePreference) => void;
  markSynced: (at?: Date) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Dark is the app's original look, so it stays the default.
      themePreference: "dark",
      lastSyncedAt: null,
      setThemePreference: (themePreference) => set({ themePreference }),
      markSynced: (at = new Date()) => set({ lastSyncedAt: at.toISOString() }),
    }),
    {
      name: "allo-settings",
      version: 1,
      storage: createJSONStorage(() => settingsStorage),
    },
  ),
);

/** The scheme to render, given the user's choice and the OS appearance. */
export function resolveColorScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference !== "system") return preference;
  return system === "light" ? "light" : "dark";
}
