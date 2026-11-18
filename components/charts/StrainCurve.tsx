import { Text, View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { MAX_STRAIN } from "@/services/coaching";
import { useTheme } from "@/theme/ThemeProvider";

const INSET = 6;

/** Strain building up from midnight to now, with the day's target band shaded. */
export function StrainCurve({
  points,
  band,
  now,
  width,
  height = 140,
  accessibilityLabel,
}: {
  points: { timestamp: string; strain: number }[];
  /** Omitted on past days, when the morning target no longer applies. */
  band: readonly [number, number] | null;
  /** When the points were read; the curve runs from that day's midnight to here. */
  now: Date;
  width: number;
  height?: number;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const span = Math.max(now.getTime() - midnight.getTime(), 1);
  const x = (time: number) =>
    INSET + ((time - midnight.getTime()) / span) * (width - INSET * 2);
  const y = (strain: number) =>
    height - INSET - (strain / MAX_STRAIN) * (height - INSET * 2);
  const path = [
    `M ${x(midnight.getTime())} ${y(0)}`,
    ...points.map(
      (point) =>
        `L ${x(new Date(point.timestamp).getTime())} ${y(point.strain)}`,
    ),
    `L ${x(now.getTime())} ${y(points.at(-1)?.strain ?? 0)}`,
  ].join(" ");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={width} height={height}>
        {band ? (
          <Rect
            x={0}
            y={y(band[1])}
            width={width}
            height={Math.max(y(band[0]) - y(band[1]), 1)}
            fill={colors.strainStart}
            opacity={0.12}
          />
        ) : null}
        <Line
          x1={0}
          x2={width}
          y1={y(0)}
          y2={y(0)}
          stroke={colors.outlineSoft}
          strokeWidth={1}
        />
        <Path
          d={path}
          stroke={colors.strainEnd}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View className="flex-row justify-between mt-xs">
        <Text className="type-mono-small text-text-subtle">00:00</Text>
        <Text className="type-mono-small text-text-subtle">NOW</Text>
      </View>
    </View>
  );
}
