import { Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";

import type { SleepSegment, SleepStage } from "@/services/health/types";
import { useTheme } from "@/theme/ThemeProvider";
import { formatClock } from "@/utils/formatters";

type Row = SleepStage;

export const stageLabels: Record<SleepStage, string> = {
  awake: "Awake",
  rem: "REM",
  light: "Light",
  deep: "Deep",
  asleep: "Asleep",
};

const LABEL_WIDTH = 48;
const ROW_HEIGHT = 30;
const BAR_HEIGHT = 14;
const minute = 60_000;

/**
 * The night as a stepped timeline: one row per stage, top to bottom from awake
 * to deep, with a bar wherever that stage held. Nights a source recorded without
 * stages only have an awake row and an asleep row.
 */
export function Hypnogram({
  stages,
  width,
}: {
  stages: SleepSegment[];
  width: number;
}) {
  const { colors } = useTheme();
  const staged = stages.some((segment) =>
    ["rem", "light", "deep"].includes(segment.stage),
  );
  const rows: Row[] = staged
    ? ["awake", "rem", "light", "deep"]
    : ["awake", "asleep"];
  // Unstaged stretches inside a staged night sit with light sleep.
  const rowOf = (stage: SleepStage): Row =>
    staged && stage === "asleep" ? "light" : stage;
  const colorOf: Record<Row, string> = {
    awake: colors.stageAwake,
    rem: colors.stageRem,
    light: colors.stageLight,
    deep: colors.stageDeep,
    asleep: colors.stageDeep,
  };

  const start = new Date(stages[0]!.start).getTime();
  const end = new Date(stages.at(-1)!.end).getTime();
  const plotWidth = Math.max(width - LABEL_WIDTH, 1);
  const height = rows.length * ROW_HEIGHT;
  const x = (time: number) =>
    ((time - start) / Math.max(end - start, 1)) * plotWidth;
  const rowCenter = (row: Row) =>
    rows.indexOf(row) * ROW_HEIGHT + ROW_HEIGHT / 2;

  const bars = stages.map((segment) => {
    const row = rowOf(segment.stage);
    const left = x(new Date(segment.start).getTime());
    const right = x(new Date(segment.end).getTime());
    return { row, left, width: Math.max(right - left, 2) };
  });

  // Whole hours between bedtime and wake time, kept clear of the end labels.
  const ticks: number[] = [];
  const firstHour = new Date(start);
  firstHour.setMinutes(0, 0, 0);
  for (
    let tick = firstHour.getTime() + 60 * minute;
    tick < end;
    tick += 60 * minute
  )
    if (tick - start > 50 * minute && end - tick > 50 * minute)
      ticks.push(tick);
  // Every other hour on long nights, and none that would crowd the end labels.
  const labelled = (
    ticks.length > 4 ? ticks.filter((_, i) => i % 2 === 1) : ticks
  ).filter((tick) => x(tick) > 64 && plotWidth - x(tick) > 64);

  const summary = rows
    .map((row) => {
      const minutes = stages
        .filter((segment) => rowOf(segment.stage) === row)
        .reduce(
          (sum, segment) =>
            sum +
            (new Date(segment.end).getTime() -
              new Date(segment.start).getTime()) /
              minute,
          0,
        );
      return `${stageLabels[row]} ${Math.round(minutes)} minutes`;
    })
    .join(", ");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Sleep stages from ${formatClock(stages[0]!.start)} to ${formatClock(stages.at(-1)!.end)}: ${summary}`}
      className="gap-sm"
    >
      <View className="flex-row">
        <View style={{ width: LABEL_WIDTH }}>
          {rows.map((row) => (
            <View
              key={row}
              className="justify-center"
              style={{ height: ROW_HEIGHT }}
            >
              <Text className="type-mono-small text-text-subtle">
                {stageLabels[row]}
              </Text>
            </View>
          ))}
        </View>
        <Svg width={plotWidth} height={height}>
          {rows.map((row) => (
            <Line
              key={row}
              x1={0}
              x2={plotWidth}
              y1={rowCenter(row)}
              y2={rowCenter(row)}
              stroke={colors.track}
              strokeWidth={1}
            />
          ))}
          {ticks.map((tick) => (
            <Line
              key={tick}
              x1={x(tick)}
              x2={x(tick)}
              y1={0}
              y2={height}
              stroke={colors.track}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}
          {bars.slice(1).map((bar, index) => {
            const previous = bars[index]!;
            const top = Math.min(rowCenter(previous.row), rowCenter(bar.row));
            const bottom = Math.max(
              rowCenter(previous.row),
              rowCenter(bar.row),
            );
            return (
              <Line
                key={`step-${index}`}
                x1={bar.left}
                x2={bar.left}
                y1={top}
                y2={bottom}
                stroke={colors.outline}
                strokeWidth={1}
              />
            );
          })}
          {bars.map((bar, index) => (
            <Rect
              key={index}
              x={bar.left}
              y={rowCenter(bar.row) - BAR_HEIGHT / 2}
              width={bar.width}
              height={BAR_HEIGHT}
              rx={Math.min(4, bar.width / 2)}
              fill={colorOf[bar.row]}
            />
          ))}
        </Svg>
      </View>
      <View className="h-4" style={{ marginLeft: LABEL_WIDTH }}>
        <Text className="type-mono-small text-text-subtle absolute left-0">
          {formatClock(stages[0]!.start)}
        </Text>
        {labelled.map((tick) => (
          <Text
            key={tick}
            className="type-mono-small text-text-subtle absolute text-center w-12"
            style={{ left: x(tick) - 24 }}
          >
            {formatClock(new Date(tick).toISOString())}
          </Text>
        ))}
        <Text className="type-mono-small text-text-subtle absolute right-0">
          {formatClock(stages.at(-1)!.end)}
        </Text>
      </View>
    </View>
  );
}
