import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { useTheme } from "@/theme/ThemeProvider";

const SWEEP = 120; // degrees either side of 12 o'clock

function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.sin(radians), cy - radius * Math.cos(radians)];
}

function arc(
  cx: number,
  cy: number,
  radius: number,
  from: number,
  to: number,
): string {
  const [x1, y1] = polar(cx, cy, radius, from);
  const [x2, y2] = polar(cx, cy, radius, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * A 240° dial with a tick per year. The arc fills up to `value`; `reference`
 * (such as chronological age) gets its own tick so the gap reads at a glance.
 */
export function AgeDial({
  value,
  reference,
  min,
  max,
  size,
  color,
}: {
  value: number;
  reference: number | null;
  min: number;
  max: number;
  size: number;
  color: string;
}) {
  const { colors } = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 14;
  const angle = (age: number) =>
    -SWEEP +
    (Math.min(Math.max(age - min, 0), max - min) / (max - min)) * SWEEP * 2;
  const ticks = Array.from(
    { length: Math.floor(max) - Math.ceil(min) + 1 },
    (_, index) => Math.ceil(min) + index,
  );
  const [markerX, markerY] = polar(cx, cy, radius, angle(value));

  return (
    <View style={styles.frame}>
      <Svg width={size} height={size * 0.82}>
        <Path
          d={arc(cx, cy, radius, -SWEEP, SWEEP)}
          stroke={colors.track}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        {ticks.map((age) => {
          const long = age % 5 === 0;
          const [x1, y1] = polar(cx, cy, radius - 10, angle(age));
          const [x2, y2] = polar(cx, cy, radius - (long ? 20 : 15), angle(age));
          return (
            <Line
              key={age}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={long ? colors.textSubtle : colors.outlineGlass}
              strokeWidth={long ? 1.5 : 1}
            />
          );
        })}
        {reference !== null ? (
          <Line
            x1={polar(cx, cy, radius + 8, angle(reference))[0]}
            y1={polar(cx, cy, radius + 8, angle(reference))[1]}
            x2={polar(cx, cy, radius - 22, angle(reference))[0]}
            y2={polar(cx, cy, radius - 22, angle(reference))[1]}
            stroke={colors.text}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : null}
        <Path
          d={arc(cx, cy, radius, -SWEEP, angle(value))}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={markerX} cy={markerY} r={10} fill={color} opacity={0.2} />
        <Circle
          cx={markerX}
          cy={markerY}
          r={6}
          fill={colors.canvas}
          stroke={color}
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center" },
});
