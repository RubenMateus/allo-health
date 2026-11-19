import { Text, View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import type { EnergyPoint } from "@/services/metrics/energy";
import { useTheme } from "@/theme/ThemeProvider";

const INSET = 6;
const GRID = [0, 25, 50, 75, 100] as const;

/** The Energy Bank through the day (0–100), midnight to `end`, with sleep shaded. */
export function EnergyCurve({
  points,
  sleepBands,
  start,
  end,
  width,
  height = 160,
  endLabel = "24:00",
  accessibilityLabel,
}: {
  points: EnergyPoint[];
  sleepBands: { start: string; end: string }[];
  /** The day's midnight. */
  start: Date;
  /** The right edge of the axis: the next midnight. The line stops at its last point. */
  end: Date;
  width: number;
  height?: number;
  endLabel?: string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const from = start.getTime();
  const span = Math.max(end.getTime() - from, 1);
  const x = (time: number) =>
    INSET +
    (Math.min(Math.max(time - from, 0), span) / span) * (width - INSET * 2);
  const y = (value: number) =>
    height - INSET - (value / 100) * (height - INSET * 2);
  const path = points
    .map(
      (point, index) =>
        `${index ? "L" : "M"} ${x(new Date(point.timestamp).getTime())} ${y(point.value)}`,
    )
    .join(" ");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={width} height={height}>
        {sleepBands.map((band) => (
          <Rect
            key={band.start}
            x={x(new Date(band.start).getTime())}
            y={0}
            width={Math.max(
              x(new Date(band.end).getTime()) - x(new Date(band.start).getTime()),
              1,
            )}
            height={height}
            fill={colors.primary}
            opacity={0.1}
          />
        ))}
        {GRID.map((value) => (
          <Line
            key={value}
            x1={0}
            x2={width}
            y1={y(value)}
            y2={y(value)}
            stroke={colors.outlineSoft}
            strokeWidth={1}
            strokeDasharray={value === 0 ? undefined : "3 4"}
          />
        ))}
        <Path
          d={path}
          stroke={colors.primaryBright}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View className="flex-row justify-between mt-xs">
        {["00:00", "06:00", "12:00", "18:00", endLabel].map((label) => (
          <Text key={label} className="type-mono-small text-text-subtle">
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
