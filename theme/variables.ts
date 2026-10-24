import { vars } from "nativewind";

import {
  colorClassName,
  themes,
  type ColorScheme,
  type ColorTokens,
} from "@/theme/tokens";

function colorVariables(colors: ColorTokens) {
  return vars(
    Object.fromEntries(
      Object.entries(colors).map(([token, value]) => [
        `--color-${colorClassName(token)}`,
        value,
      ]),
    ),
  );
}

/**
 * The CSS variables behind every Tailwind color class, per scheme.
 * ThemeProvider applies the active set at the root of the app.
 */
export const themeVariables: Record<ColorScheme, ReturnType<typeof vars>> = {
  dark: colorVariables(themes.dark.colors),
  light: colorVariables(themes.light.colors),
};
