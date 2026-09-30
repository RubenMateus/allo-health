import type { TextStyle, ViewStyle } from "react-native";

export const colors = {
  canvas: "#101319",
  canvasDeep: "#0b0e14",
  surfaceDim: "#101319",
  surfaceBright: "#363940",
  surfaceLow: "#191c22",
  surface: "#1d2026",
  surfaceHigh: "#272a30",
  surfaceHighest: "#32353b",
  surfaceProse: "#14171D",
  surfaceElevatedProse: "#1C2029",
  text: "#e1e2eb",
  textMuted: "#bacbbf",
  textSubtle: "#84958a",
  outline: "#3b4a42",
  outlineSoft: "rgba(255,255,255,0.07)",
  outlineGlass: "rgba(255,255,255,0.12)",
  track: "rgba(255,255,255,0.08)",
  scrim: "rgba(0,0,0,0.64)",
  glassFill: "rgba(20,23,29,0.84)",
  primaryWash: "rgba(0,229,163,0.08)",
  primaryWashStrong: "rgba(0,229,163,0.1)",
  primaryBorder: "rgba(0,229,163,0.24)",
  stressWash: "rgba(255,159,67,0.08)",
  stressBorder: "rgba(255,159,67,0.24)",
  sleepWash: "rgba(124,92,255,0.09)",
  sleepBorder: "rgba(124,92,255,0.28)",
  protein: "#74D8B1",
  carbohydrate: "#FFB454",
  fat: "#B59AFF",
  primary: "#00E5A3",
  primaryBright: "#6effc3",
  strainStart: "#FF8A00",
  strainEnd: "#FF2E54",
  sleep: "#7C5CFF",
  stress: "#FF9F43",
  vo2: "#F59E0B",
  blue: "#67C9FF",
  error: "#ffb4ab",
  transparent: "transparent",
} as const;

export const gradients = {
  strain: [colors.strainStart, colors.strainEnd] as const,
  recovery: [colors.primaryBright, colors.primary] as const,
  sleep: ["#A896FF", colors.sleep] as const,
  stress: ["#FFD166", colors.stress] as const,
  energy: [colors.primary, colors.blue] as const,
  glassEdge: [colors.outlineGlass, "rgba(255,255,255,0.01)"] as const,
};

export const spacing = {
  "2xs": 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  gutter: 12,
  margin: 16,
  section: 28,
  navClearance: 132,
} as const;

export const radii = {
  sm: 4,
  DEFAULT: 8,
  md: 12,
  lg: 16,
  card: 20,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  display: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600",
  },
  heading: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
  },
  subheading: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  metricXL: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
  },
  metricLG: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "600",
  },
  metricMD: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
  },
  bodySmall: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
  caption: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
  },
  badge: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
  },
  mono: {
    fontFamily: "JetBrainsMono_500Medium",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  monoSmall: {
    fontFamily: "JetBrainsMono_400Regular",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400",
  },
} satisfies Record<string, TextStyle>;

export const glow = {
  recovery: {
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  } satisfies ViewStyle,
  strain: {
    shadowColor: colors.strainStart,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  } satisfies ViewStyle,
  sleep: {
    shadowColor: colors.sleep,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  } satisfies ViewStyle,
};

export const theme = {
  colors,
  gradients,
  spacing,
  radii,
  typography,
  glow,
} as const;
