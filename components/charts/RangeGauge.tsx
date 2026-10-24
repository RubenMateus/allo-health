import Svg, { Circle, Line, Path } from "react-native-svg";

import { useTheme } from "@/theme/ThemeProvider";

const SWEEP = 120; // degrees either side of 12 o'clock

function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.sin(radians), cy - radius * Math.cos(radians)];
}

function arc(cx: number, cy: number, radius: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, radius, from);
  const [x2, y2] = polar(cx, cy, radius, to);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/**
 * A 240° gauge from 0 to `max` with tick marks, the target `band` drawn on the
 * outer ring and a marker at `value`.
 */
export function RangeGauge({
  value,
  max,
  band,
  size,
  color,
  markerColor,
}: {
  value: number;
  max: number;
  band: readonly [number, number] | null;
  size: number;
  color: string;
  markerColor: string;
}) {
  const { colors } = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 6;
  const tickOuter = outer - 9;
  const angle = (amount: number) =>
    -SWEEP +
    (Math.min(Math.max(amount, 0), max) / Math.max(max, 1)) * SWEEP * 2;
  const ticks = Array.from({ length: 41 }, (_, index) => -SWEEP + index * 6);
  const [markerX, markerY] = polar(cx, cy, tickOuter - 4, angle(value));

  return (
    <Svg width={size} height={size * 0.84}>
      <Path
        d={arc(cx, cy, outer, -SWEEP, SWEEP)}
        stroke={colors.track}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      {band ? (
        <Path
          d={arc(
            cx,
            cy,
            outer,
            angle(band[0]),
            Math.max(angle(band[1]), angle(band[0]) + 2),
          )}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
      {ticks.map((degrees) => {
        const filled = degrees <= angle(value);
        const [x1, y1] = polar(cx, cy, tickOuter, degrees);
        const [x2, y2] = polar(cx, cy, tickOuter - 10, degrees);
        return (
          <Line
            key={degrees}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={filled ? colors.textMuted : colors.outlineGlass}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
      <Circle
        cx={markerX}
        cy={markerY}
        r={7}
        fill={colors.canvas}
        stroke={markerColor}
        strokeWidth={3}
      />
    </Svg>
  );
}
