import { useId, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

import { useTheme } from "@/theme/ThemeProvider";

export function Sparkline({
  values,
  color,
  width = 260,
  height = 76,
  targetRange,
  targetColor,
  step = false,
  fill = true,
  accessibilityLabel = "Intraday health data sparkline",
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  targetRange?: readonly [number, number];
  targetColor?: string;
  /** Draw horizontal-then-vertical steps between points instead of diagonals. */
  step?: boolean;
  fill?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const lineColor = color ?? colors.primary;
  const targetFill = targetColor ?? colors.primary;
  const fillId = `sparkline-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const chart = useMemo(() => {
    if (values.length < 2)
      return { path: "", lastX: 0, lastY: 0, min: 0, max: 1 };
    const min = Math.min(...values, targetRange?.[0] ?? Infinity);
    const max = Math.max(...values, targetRange?.[1] ?? -Infinity);
    const range = Math.max(max - min, 1);
    const inset = 6;
    const points = values.map((value, index) => {
      const x = inset + (index / (values.length - 1)) * (width - inset * 2);
      const y = height - inset - ((value - min) / range) * (height - inset * 2);
      return [x, y] as const;
    });
    return {
      path: points
        .map(([x, y], index) => {
          if (index === 0) return `M ${x} ${y}`;
          const previous = points[index - 1]!;
          const middle = (previous[0] + x) / 2;
          return step
            ? `L ${middle} ${previous[1]} L ${middle} ${y} L ${x} ${y}`
            : `L ${x} ${y}`;
        })
        .join(" "),
      lastX: points.at(-1)?.[0] ?? 0,
      lastY: points.at(-1)?.[1] ?? 0,
      min,
      max,
    };
  }, [height, step, targetRange, values, width]);

  const rangeY = (value: number) =>
    height -
    6 -
    ((value - chart.min) / Math.max(chart.max - chart.min, 1)) * (height - 12);
  const targetY = targetRange ? rangeY(targetRange[1]) : 0;
  const targetHeight = targetRange ? rangeY(targetRange[0]) - targetY : 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.frame}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.22" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {targetRange ? (
          <Rect
            x={0}
            y={targetY}
            width={width}
            height={targetHeight}
            fill={targetFill}
            opacity={0.07}
          />
        ) : null}
        {fill ? (
          <Path
            d={`${chart.path} L ${chart.lastX} ${height} L 0 ${height} Z`}
            fill={`url(#${fillId})`}
          />
        ) : null}
        <Path
          d={chart.path}
          stroke={lineColor}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={chart.lastX} cy={chart.lastY} r={4} fill={lineColor} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", overflow: "hidden" },
});
