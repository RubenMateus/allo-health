import {
  createContext,
  useContext,
  useEffect,
  type PropsWithChildren,
} from "react";
import { Appearance, useColorScheme } from "react-native";

import { resolveColorScheme, useSettingsStore } from "@/stores/settingsStore";
import { themes, type Theme } from "@/theme/tokens";

const ThemeContext = createContext<Theme>(themes.dark);

export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useSettingsStore((state) => state.themePreference);
  const system = useColorScheme();

  // Keep native UI (keyboard, alerts, blur "default" tint) in step with the
  // in-app choice. "unspecified" hands control back to the OS.
  useEffect(() => {
    // Not every platform implements this (react-native-web doesn't).
    Appearance.setColorScheme?.(
      preference === "system" ? "unspecified" : preference,
    );
  }, [preference]);

  const theme = themes[resolveColorScheme(preference, system)];
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Builds a style hook from a factory of the active theme. Styles are created
 * once per theme and reused, like a module-level `StyleSheet.create`.
 */
export function makeStyles<T>(factory: (theme: Theme) => T) {
  const cache = new Map<Theme, T>();
  return function useStyles() {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = factory(theme);
      cache.set(theme, styles);
    }
    return styles;
  };
}
