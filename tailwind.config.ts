import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
// eslint-disable-next-line import/no-unresolved -- resolved by Tailwind's loader
import { hairlineWidth } from "nativewind/theme";

import {
  colorClassName,
  darkColors,
  radii,
  spacing,
  typography,
} from "./theme/tokens";

const px = (value: number) => `${value}px`;

const isWeb = process.env.NATIVEWIND_OS === "web";

// NativeWind's hairlineWidth() is resolved on iOS and Android only, so give the
// browser build (used for screenshots) a plain 1px line.
const hairline = isWeb ? "1px" : hairlineWidth();

// Colors point at CSS variables. ThemeProvider sets the variables for the
// active scheme, so `bg-canvas` follows the light and dark themes.
const colors = Object.fromEntries(
  Object.keys(darkColors).map((token) => {
    const name = colorClassName(token);
    return [name, `var(--color-${name})`];
  }),
);

// Tailwind's numeric scale (p-4 = 16px) in pixels, plus the named spacing
// tokens (p-lg = spacing.lg).
const numericSpacing = Object.fromEntries(
  [
    0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20,
    24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
  ].map((step) => [String(step), px(step * 4)]),
);

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // The scheme comes from the in-app setting (see ThemeProvider), not
  // straight from the OS.
  darkMode: "class",
  theme: {
    colors,
    spacing: {
      ...numericSpacing,
      px: "1px",
      hairline,
      ...Object.fromEntries(
        Object.entries(spacing).map(([name, value]) => [
          name.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`),
          px(value),
        ]),
      ),
    },
    borderRadius: {
      none: "0px",
      ...Object.fromEntries(
        Object.entries(radii).map(([name, value]) => [name, px(value)]),
      ),
    },
    extend: {
      borderWidth: { hairline },
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
        mono: ["JetBrainsMono_400Regular"],
        "mono-medium": ["JetBrainsMono_500Medium"],
      },
    },
  },
  // Replaced below: React Native has no font-variant-numeric.
  corePlugins: { fontVariantNumeric: false },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        ".tabular-nums": isWeb
          ? { fontVariantNumeric: "tabular-nums" }
          : { "-rn-font-variant": "tabular-nums" },
      });
    }),
    // One class per type style from the design system: `type-heading` sets
    // the family, size, line height and weight together. They are components,
    // so a utility like `text-[11px]` can still override the size.
    plugin(({ addComponents }) => {
      addComponents(
        Object.fromEntries(
          Object.entries(typography).map(([name, style]) => [
            `.type-${name.replace(/[A-Z]+/g, (l) => `-${l.toLowerCase()}`)}`,
            {
              fontFamily: style.fontFamily,
              fontSize: px(style.fontSize),
              lineHeight: px(style.lineHeight),
              fontWeight: style.fontWeight,
            },
          ]),
        ),
      );
    }),
  ],
} satisfies Config;
