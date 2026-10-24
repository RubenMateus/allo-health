import { useId } from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useTheme } from "@/theme/ThemeProvider";

/** The Allo Health logo mark: an "A" whose crossbar is a heartbeat blip. */
export function AlloMark({ size = 24 }: { size?: number }) {
  const { colors } = useTheme();
  const id = useId();

  return (
    <Svg
      width={size}
      height={size}
      viewBox="20 14 216 216"
      accessibilityRole="image"
      accessibilityLabel="Allo Health"
    >
      <Defs>
        <LinearGradient
          id={id}
          x1="36"
          y1="48"
          x2="220"
          y2="196"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.blue} />
        </LinearGradient>
      </Defs>
      <Path
        d="M36 196H64L128 48L192 196H220"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={22}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M92 148H112L122 126L136 166L146 148H164"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
