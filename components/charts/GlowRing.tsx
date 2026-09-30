import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { colors, glow, radii, typography } from "@/theme/tokens";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type RingMetric = {
  label: string;
  value: number | null;
  max: number;
  colors: readonly [string, string];
  status: string;
  glowStyle?: "recovery" | "strain" | "sleep";
};

export function GlowRing({
  metric,
  size = 104,
  strokeWidth = 8,
}: {
  metric: RingMetric;
  size?: number;
  strokeWidth?: number;
}) {
  const progress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction =
    metric.value === null
      ? 0
      : Math.min(Math.max(metric.value / metric.max, 0), 1);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  useEffect(() => {
    progress.value = withTiming(fraction, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [fraction, progress]);

  const accessibilityValue =
    metric.value === null
      ? "data unavailable"
      : metric.max === 100
        ? `${metric.value} percent`
        : `${metric.value} of ${metric.max}`;
  const beadProps = useAnimatedProps(() => {
    const angle = -Math.PI / 2 + progress.value * Math.PI * 2;
    return {
      cx: size / 2 + radius * Math.cos(angle),
      cy: size / 2 + radius * Math.sin(angle),
    };
  });
  const glowStyle = metric.glowStyle ? glow[metric.glowStyle] : null;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${metric.label} ${accessibilityValue}, ${metric.status.toLowerCase()}`}
      style={[styles.wrap, { width: size }]}
    >
      <View style={[styles.ring, { width: size, height: size }, glowStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient
              id={`ring-${metric.label}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor={metric.colors[0]} />
              <Stop offset="100%" stopColor={metric.colors[1]} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.track}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#ring-${metric.label})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
            fill="none"
          />
          <AnimatedCircle
            r={strokeWidth / 2 + 1}
            fill={metric.colors[1]}
            animatedProps={beadProps}
          />
        </Svg>
        <View style={styles.center}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
            {metric.value === null ? "--" : metric.value}
          </Text>
          <Text numberOfLines={1} style={styles.label}>
            {metric.label}
          </Text>
        </View>
      </View>
      <Text style={styles.status}>{metric.status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  ring: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  value: {
    ...typography.metricLG,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  label: { ...typography.caption, color: colors.textMuted },
  status: {
    ...typography.badge,
    color: colors.textSubtle,
    textTransform: "uppercase",
  },
});
