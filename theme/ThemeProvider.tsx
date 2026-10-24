import {
  createContext,
  useContext,
  useEffect,
  type PropsWithChildren,
} from "react";
import { Appearance, useColorScheme, View } from "react-native";
import { colorScheme as nativewindColorScheme } from "nativewind";

import { resolveColorScheme, useSettingsStore } from "@/stores/settingsStore";
import { themes, type Theme } from "@/theme/tokens";
import { themeVariables } from "@/theme/variables";

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

  const scheme = resolveColorScheme(preference, system);

  // Lets `dark:` variants follow the in-app choice too.
  useEffect(() => {
    nativewindColorScheme.set(scheme);
  }, [scheme]);

  return (
    <ThemeContext.Provider value={themes[scheme]}>
      <View style={[{ flex: 1 }, themeVariables[scheme]]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
