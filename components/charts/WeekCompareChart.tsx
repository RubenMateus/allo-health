import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useTheme } from "@/theme/ThemeProvider";

/** This week's running total against last week's, day by day. */
export function WeekCompareChart({
  current,
  previous,
  width,
  height,
  color,
  accessibilityLabel,
}: {
  current: number[];
  previous: number[];
  width: number;
  height: number;
  color: string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const inset = 8;
  const max = Math.max(...current, ...previous, 1);
  const points = (values: number[]) =>
    values.map(
      (value, index) =>
        [
          inset + (index / 6) * (width - inset * 2),
          height - inset - (value / max) * (height - inset * 2),
        ] as const,
    );
  const path = (coordinates: (readonly [number, number])[]) =>
    coordinates
      .map(([x, y], index) => {
        if (index === 0) return `M ${x} ${y}`;
        // Steps, since totals only change when a workout is logged.
        const previousY = coordinates[index - 1]![1];
        return `L ${x} ${previousY} L ${x} ${y}`;
      })
      .join(" ");
  const now = points(current);
  const before = points(previous);
  const last = now.at(-1);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={width} height={height}>
        {before.length > 1 ? (
          <Path
            d={path(before)}
            stroke={colors.textSubtle}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />
        ) : null}
        {now.length > 1 ? (
          <Path
            d={path(now)}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
          />
        ) : null}
        {last ? (
          <Circle
            cx={last[0]}
            cy={last[1]}
            r={5}
            fill={colors.canvas}
            stroke={color}
            strokeWidth={2.5}
          />
        ) : null}
      </Svg>
    </View>
  );
}
