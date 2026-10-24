import { Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { useTheme } from "@/theme/ThemeProvider";

export type Bar = { value: number; color?: string; label?: string };

/**
 * Vertical bars scaled to the tallest one, with an optional shaded `band`
 * (in the same units) and labels under the first, middle and last bars.
 */
export function BarChart({
  bars,
  width,
  height = 120,
  color,
  band,
  accessibilityLabel,
}: {
  bars: Bar[];
  width: number;
  height?: number;
  color: string;
  band?: readonly [number, number] | null;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const max = Math.max(...bars.map((bar) => bar.value), band?.[1] ?? 0, 1);
  const gap = bars.length > 14 ? 2 : 6;
  const barWidth = Math.max((width - gap * (bars.length - 1)) / bars.length, 1);
  const y = (value: number) => height - (value / max) * height;
  const labelled = bars
    .map((bar, index) => ({ ...bar, index }))
    .filter((bar) => bar.label);

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
            fill={color}
            opacity={0.1}
          />
        ) : null}
        {bars.map((bar, index) => {
          const barHeight =
            bar.value > 0 ? Math.max(height - y(bar.value), 2) : 2;
          return (
            <Rect
              key={index}
              x={index * (barWidth + gap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(3, barWidth / 2)}
              fill={bar.value > 0 ? (bar.color ?? color) : colors.track}
            />
          );
        })}
      </Svg>
      {labelled.length ? (
        <View className="h-4 mt-sm" style={{ width }}>
          {labelled.map((bar) => (
            <Text
              key={bar.index}
              className="type-mono-small text-text-subtle absolute text-center"
              style={{
                width: Math.max(barWidth, 40),
                left: Math.min(
                  Math.max(
                    bar.index * (barWidth + gap) +
                      barWidth / 2 -
                      Math.max(barWidth, 40) / 2,
                    0,
                  ),
                  width - Math.max(barWidth, 40),
                ),
              }}
            >
              {bar.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
