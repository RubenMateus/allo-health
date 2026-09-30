import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

import { colors } from "@/theme/tokens";

export function Sparkline({
  values,
  color = colors.primary,
  width = 260,
  height = 76,
  targetRange,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  targetRange?: readonly [number, number];
}) {
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
        .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
        .join(" "),
      lastX: points.at(-1)?.[0] ?? 0,
      lastY: points.at(-1)?.[1] ?? 0,
      min,
      max,
    };
  }, [height, targetRange, values, width]);

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
      accessibilityLabel="Intraday health data sparkline"
      style={styles.frame}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.22" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {targetRange ? (
          <Rect
            x={0}
            y={targetY}
            width={width}
            height={targetHeight}
            fill={colors.primary}
            opacity={0.07}
          />
        ) : null}
        <Path
          d={`${chart.path} L ${chart.lastX} ${height} L 0 ${height} Z`}
          fill="url(#sparkline-fill)"
        />
        <Path
          d={chart.path}
          stroke={color}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={chart.lastX} cy={chart.lastY} r={4} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", overflow: "hidden" },
});
