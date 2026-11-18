import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { settingsStorage } from "@/services/settings/storage";
import type { ColorScheme } from "@/theme/tokens";

export type ThemePreference = ColorScheme | "system";

type SettingsStore = {
  themePreference: ThemePreference;
  lastSyncedAt: string | null;
  /** When the first-launch intro was finished; null shows it on next launch. */
  onboardingCompletedAt: string | null;
  completeOnboarding: (at?: Date) => void;
  resetOnboarding: () => void;
  setThemePreference: (preference: ThemePreference) => void;
  markSynced: (at?: Date) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Dark is the app's original look, so it stays the default.
      themePreference: "dark",
      lastSyncedAt: null,
      onboardingCompletedAt: null,
      completeOnboarding: (at = new Date()) =>
        set({ onboardingCompletedAt: at.toISOString() }),
      resetOnboarding: () => set({ onboardingCompletedAt: null }),
      setThemePreference: (themePreference) => set({ themePreference }),
      markSynced: (at = new Date()) => set({ lastSyncedAt: at.toISOString() }),
    }),
    {
      name: "allo-settings",
      version: 2,
      storage: createJSONStorage(() => settingsStorage),
      // Installs from before the intro existed see it once after updating.
      migrate: (state) => ({
        ...(state as object),
        onboardingCompletedAt: null,
      }),
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
