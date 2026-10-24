import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon } from "react-native-svg";

import { colors, typography } from "@/theme/tokens";

export type RadarAxis = { label: string; value: number; display: string };

const LABEL_WIDTH = 84;
const LABEL_HEIGHT = 32;

/** Pentagon-style radar: axes start at 12 o'clock and run clockwise. */
export function RadarChart({
  axes,
  size,
  accessibilityLabel,
}: {
  axes: RadarAxis[];
  size: number;
  accessibilityLabel: string;
}) {
  const center = size / 2;
  // Leave room around the plot for the value + name labels.
  const radius = center - LABEL_HEIGHT - 14;
  const max = Math.max(...axes.map((axis) => axis.value), 1) * 1.12;
  const angle = (index: number) =>
    -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
  const pointAt = (index: number, distance: number) => ({
    x: center + Math.cos(angle(index)) * distance,
    y: center + Math.sin(angle(index)) * distance,
  });
  const vertices = axes.map((axis, index) =>
    // A small floor keeps an untrained group visible as a dent, not a collapse.
    pointAt(index, radius * Math.max(axis.value / max, 0.06)),
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <Circle
            key={ring}
            cx={center}
            cy={center}
            r={radius * ring}
            fill="none"
            stroke={colors.outlineSoft}
          />
        ))}
        {axes.map((axis, index) => {
          const end = pointAt(index, radius);
          return (
            <Line
              key={axis.label}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke={colors.outlineSoft}
            />
          );
        })}
        <Polygon
          points={vertices.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill={colors.primary}
          fillOpacity={0.16}
          stroke={colors.primary}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        {vertices.map(({ x, y }, index) => (
          <Circle
            key={axes[index]!.label}
            cx={x}
            cy={y}
            r={4.5}
            fill={colors.primaryBright}
          />
        ))}
      </Svg>
      {axes.map((axis, index) => {
        // Push side labels outward horizontally so they clear their vertex.
        const base = pointAt(index, radius + LABEL_HEIGHT / 2 + 6);
        const anchor = {
          x: base.x + Math.cos(angle(index)) * (LABEL_WIDTH / 2 - 16),
          y: base.y,
        };
        return (
          <View
            key={axis.label}
            style={[
              styles.label,
              {
                left: Math.min(
                  Math.max(anchor.x - LABEL_WIDTH / 2, 0),
                  size - LABEL_WIDTH,
                ),
                top: anchor.y - LABEL_HEIGHT / 2,
              },
            ]}
          >
            <Text style={styles.labelValue}>{axis.display}</Text>
            <Text style={styles.labelName}>{axis.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  labelValue: {
    ...typography.mono,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  labelName: {
    ...typography.badge,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
});
