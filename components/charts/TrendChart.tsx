import { useId, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

import { useTheme } from "@/theme/ThemeProvider";

export type TrendPoint = { time: number; value: number };

const AXIS_WIDTH = 40;
const INSET = 8;

/**
 * A dated line chart with min/max gridlines and an optional shaded band, such as a
 * personal baseline. Points are placed by time, so gaps between readings show.
 */
export function TrendChart({
  points,
  color,
  width,
  height = 180,
  band,
  formatValue,
  accessibilityLabel,
}: {
  points: TrendPoint[];
  color: string;
  width: number;
  height?: number;
  band?: readonly [number, number] | null;
  formatValue: (value: number) => string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const fillId = `trend-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const plotWidth = Math.max(width - AXIS_WIDTH, 1);

  const chart = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((point) => point.value);
    let min = Math.min(...values, band?.[0] ?? Infinity);
    let max = Math.max(...values, band?.[1] ?? -Infinity);
    // Pad so a flat series doesn't sit on the edge of the plot.
    const pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.01, 0.5);
    min -= pad;
    max += pad;
    const start = points[0]!.time;
    const span = Math.max(points.at(-1)!.time - start, 1);
    const x = (time: number) =>
      points.length === 1
        ? plotWidth / 2
        : INSET + ((time - start) / span) * (plotWidth - INSET * 2);
    const y = (value: number) =>
      INSET + (1 - (value - min) / (max - min)) * (height - INSET * 2);
    const coordinates = points.map(
      (point) => [x(point.time), y(point.value)] as const,
    );
    const path = coordinates
      .map(([px, py], index) => `${index === 0 ? "M" : "L"} ${px} ${py}`)
      .join(" ");
    const first = coordinates[0]!;
    const last = coordinates.at(-1)!;
    return {
      min,
      max,
      y,
      path,
      area: `${path} L ${last[0]} ${height} L ${first[0]} ${height} Z`,
      coordinates,
      last,
    };
  }, [band, height, plotWidth, points]);

  if (!chart) return null;
  const top = chart.max;
  const bottom = chart.min;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      className="flex-row"
    >
      <Svg width={plotWidth} height={height}>
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.2" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {[INSET, height / 2, height - INSET].map((gridY) => (
          <Line
            key={gridY}
            x1={0}
            x2={plotWidth}
            y1={gridY}
            y2={gridY}
            stroke={colors.outlineSoft}
            strokeDasharray="2 4"
          />
        ))}
        {band ? (
          <Rect
            x={0}
            y={chart.y(band[1])}
            width={plotWidth}
            height={Math.max(chart.y(band[0]) - chart.y(band[1]), 1)}
            fill={color}
            opacity={0.1}
          />
        ) : null}
        {chart.coordinates.length > 1 ? (
          <>
            <Path d={chart.area} fill={`url(#${fillId})`} />
            <Path
              d={chart.path}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {chart.coordinates.length <= 40
          ? chart.coordinates.map(([cx, cy], index) => (
              <Circle key={index} cx={cx} cy={cy} r={2.5} fill={color} />
            ))
          : null}
        <Circle
          cx={chart.last[0]}
          cy={chart.last[1]}
          r={5}
          fill={colors.canvas}
          stroke={color}
          strokeWidth={2.5}
        />
      </Svg>
      <View
        className="justify-between items-end"
        style={[styles.axis, { height }]}
      >
        <Text className="type-mono-small text-text-subtle">
          {formatValue(top)}
        </Text>
        <Text className="type-mono-small text-text-subtle">
          {formatValue((top + bottom) / 2)}
        </Text>
        <Text className="type-mono-small text-text-subtle">
          {formatValue(bottom)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { width: AXIS_WIDTH, paddingVertical: INSET - 7 },
});
