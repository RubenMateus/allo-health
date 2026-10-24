import { useId, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { colors, typography } from "@/theme/tokens";

const AXIS_WIDTH = 34;
const INSET = 8;
const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100];

/** Running total of minutes, drawn with an hour axis and a strain-to-recovery stroke. */
export function CumulativeChart({
  minutes,
  width,
  height = 140,
  accessibilityLabel,
}: {
  minutes: number[];
  width: number;
  height?: number;
  accessibilityLabel: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const plotWidth = Math.max(width - AXIS_WIDTH, 1);
  const chart = useMemo(() => {
    const maxHours = Math.max(...minutes, 0) / 60;
    // Two gridline steps above zero, like "0 / 10h / 20h".
    const step =
      NICE_STEPS.find((candidate) => candidate * 2 >= maxHours) ??
      Math.ceil(maxHours / 2);
    const max = step * 2 * 60;
    const y = (value: number) =>
      height - INSET - (value / max) * (height - INSET * 2);
    const points = minutes.map((value, index) => ({
      x:
        INSET +
        (index / Math.max(minutes.length - 1, 1)) * (plotWidth - INSET * 2),
      y: y(value),
    }));
    return {
      step,
      y,
      points,
      path: points
        .map(({ x, y: py }, index) => `${index === 0 ? "M" : "L"} ${x} ${py}`)
        .join(" "),
    };
  }, [height, minutes, plotWidth]);
  const last = chart.points.at(-1);
  // Mark roughly every fifth day, always ending on today.
  const markers = chart.points.filter(
    (_, index) =>
      index !== chart.points.length - 1 &&
      (chart.points.length - 1 - index) % 5 === 0,
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.frame}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient
            id={`${id}-stroke`}
            x1="0"
            y1="0"
            x2={plotWidth}
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={colors.salmon} />
            <Stop offset="0.35" stopColor={colors.strainStart} />
            <Stop offset="0.6" stopColor={colors.strainEnd} />
            <Stop offset="0.8" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.primaryBright} />
          </LinearGradient>
          <LinearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {[0, 1, 2].map((tick) => (
          <Line
            key={tick}
            x1={0}
            x2={plotWidth}
            y1={chart.y(tick * chart.step * 60)}
            y2={chart.y(tick * chart.step * 60)}
            stroke={colors.outlineSoft}
            strokeDasharray="3 4"
          />
        ))}
        {last ? (
          <>
            <Path
              d={`${chart.path} L ${last.x} ${height} L ${INSET} ${height} Z`}
              fill={`url(#${id}-fill)`}
            />
            <Line
              x1={last.x}
              x2={last.x}
              y1={last.y}
              y2={height}
              stroke={colors.primaryBorder}
            />
          </>
        ) : null}
        <Path
          d={chart.path}
          stroke={`url(#${id}-stroke)`}
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {markers.map((point) => (
          <Circle
            key={point.x}
            cx={point.x}
            cy={point.y}
            r={3}
            fill={colors.surfaceProse}
            stroke={colors.text}
            strokeOpacity={0.6}
          />
        ))}
        {last ? (
          <>
            <Circle
              cx={last.x}
              cy={last.y}
              r={9}
              fill={colors.primary}
              opacity={0.2}
            />
            <Circle
              cx={last.x}
              cy={last.y}
              r={4.5}
              fill={colors.primaryBright}
              stroke={colors.canvas}
              strokeWidth={1.5}
            />
          </>
        ) : null}
      </Svg>
      {[2, 1, 0].map((tick) => (
        <Text
          key={tick}
          style={[
            styles.axisLabel,
            { top: chart.y(tick * chart.step * 60) - 7 },
          ]}
        >
          {tick === 0 ? "0" : `${tick * chart.step}h`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%" },
  axisLabel: {
    ...typography.monoSmall,
    color: colors.textSubtle,
    position: "absolute",
    right: 0,
    width: AXIS_WIDTH - 6,
    textAlign: "right",
  },
});
