import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { DetailSection } from "@/components/detail/DetailLayout";
import { Card, Pill } from "@/components/ui/primitives";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import { MAX_STRAIN } from "@/services/coaching";
import {
  dayFit,
  lastDays,
  loadBalance,
  loadBalanceSummary,
  type LoadDay,
  type LoadVerdict,
} from "@/services/metrics/loadBalance";
import { useTheme } from "@/theme/ThemeProvider";
import { formatDay, formatNumber } from "@/utils/formatters";

const verdicts: Record<
  LoadVerdict,
  { label: string; tone: "warning" | "positive" | "neutral" }
> = {
  "over-reaching": { label: "Over-reaching", tone: "warning" },
  balanced: { label: "Balanced", tone: "positive" },
  "room-to-push": { label: "Room to push", tone: "neutral" },
};

/**
 * Strain against recovery, day by day: strain as bars (0–21), recovery as a
 * line (0–100) on the same height, so a tall bar under a low point stands out.
 * Bars for hard days on low recovery are drawn in the deeper strain color.
 */
export function LoadBalanceChart({
  days,
  width,
  height = 120,
}: {
  days: readonly LoadDay[];
  width: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const count = Math.max(days.length, 1);
  const gap = 6;
  const barWidth = Math.max((width - gap * (count - 1)) / count, 1);
  const centre = (index: number) => index * (barWidth + gap) + barWidth / 2;
  const inset = 4;
  const recoveryY = (value: number) =>
    inset + (1 - value / 100) * (height - inset * 2);

  const points = days
    .map((day, index) =>
      day.recovery === null
        ? null
        : ([centre(index), recoveryY(day.recovery)] as const),
    )
    .filter((point) => point !== null);
  // Break the line where a day has no recovery, rather than bridging it.
  const path = days
    .map((day, index) => {
      if (day.recovery === null) return "";
      const continues = index > 0 && days[index - 1]!.recovery !== null;
      return `${continues ? "L" : "M"} ${centre(index)} ${recoveryY(day.recovery)}`;
    })
    .join(" ");

  const labelled = [0, Math.floor((days.length - 1) / 2), days.length - 1];
  const described = days
    .map(
      (day) =>
        `${formatDay(day.date)}: strain ${day.strain === null ? "none" : formatNumber(day.strain, 1)}, recovery ${day.recovery ?? "none"}`,
    )
    .join("; ");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Strain and recovery by day. ${described}`}
    >
      <Svg width={width} height={height}>
        {[25, 50, 75].map((value) => (
          <Line
            key={value}
            x1={0}
            x2={width}
            y1={recoveryY(value)}
            y2={recoveryY(value)}
            stroke={colors.track}
            strokeWidth={1}
          />
        ))}
        {days.map((day, index) => {
          const barHeight =
            day.strain !== null && day.strain > 0
              ? Math.max((day.strain / MAX_STRAIN) * height, 2)
              : 2;
          const over = dayFit(day) === "over";
          return (
            <Rect
              key={day.date}
              x={index * (barWidth + gap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(3, barWidth / 2)}
              fill={
                day.strain === null
                  ? colors.track
                  : over
                    ? colors.strainEnd
                    : colors.strainStart
              }
              opacity={day.strain === null || over ? 1 : 0.55}
            />
          );
        })}
        <Path
          d={path}
          stroke={colors.primary}
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map(([x, y]) => (
          <Circle
            key={`${x}`}
            cx={x}
            cy={y}
            r={3}
            fill={colors.canvas}
            stroke={colors.primary}
            strokeWidth={2}
          />
        ))}
      </Svg>
      {days.length ? (
        <View className="h-4 mt-sm" style={{ width }}>
          {[...new Set(labelled)].map((index) => (
            <Text
              key={index}
              className="type-mono-small text-text-subtle absolute text-center"
              style={{
                width: 48,
                left: Math.min(Math.max(centre(index) - 24, 0), width - 48),
              }}
            >
              {formatDay(days[index]!.date)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LegendDot({
  color,
  label,
  opacity = 1,
}: {
  color: string;
  label: string;
  opacity?: number;
}) {
  return (
    <View className="flex-row items-center gap-xs">
      <View
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color, opacity }}
      />
      <Text className="type-caption text-text-muted">{label}</Text>
    </View>
  );
}

/**
 * "Load balance": the last 14 days of strain against recovery, with a verdict
 * on the last 7. `days` is oldest first, one entry per local day.
 */
export function LoadBalanceCard({
  days,
  width,
}: {
  days: readonly LoadDay[];
  /** Width of the chart, i.e. the card's inner width. */
  width: number;
}) {
  const { colors } = useTheme();
  const shown = lastDays(days, 14);
  const balance = loadBalance(shown);

  return (
    <Card className="gap-lg">
      <Text className="type-body-small text-text-muted">
        {loadBalanceSummary(balance)}
      </Text>

      <LoadBalanceChart days={shown} width={width} />

      <View className="flex-row flex-wrap gap-md">
        <LegendDot color={colors.strainStart} label="Strain" opacity={0.55} />
        <LegendDot color={colors.strainEnd} label="Hard day, low recovery" />
        <LegendDot color={colors.primary} label="Recovery" />
      </View>

      {balance.scoredDays ? (
        <View className="flex-row gap-sm">
          <Stat
            label="Avg strain · 7d"
            value={formatNumber(balance.averageStrain ?? 0, 1)}
          />
          <Stat
            label="Avg recovery · 7d"
            value={`${Math.round(balance.averageRecovery ?? 0)}%`}
          />
        </View>
      ) : null}
    </Card>
  );
}

/** The Load balance section for the Strain and Recovery pages, fed by the cached day history. */
export function LoadBalanceSection({ width }: { width: number }) {
  const { data: days } = useScoreHistory();
  const verdict = days ? loadBalance(lastDays(days, 14)).verdict : null;
  const pill = verdict ? verdicts[verdict] : null;
  return (
    <DetailSection
      title="Load balance"
      trailing={
        !days ? null : pill ? (
          <Pill tone={pill.tone}>{pill.label}</Pill>
        ) : (
          <Pill>Not enough data</Pill>
        )
      }
    >
      {days ? (
        <LoadBalanceCard days={days} width={width} />
      ) : (
        <Card>
          <Text className="type-caption text-text-subtle">
            Reading the last two weeks…
          </Text>
        </Card>
      )}
    </DetailSection>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-2xs rounded-md bg-surface p-sm">
      <Text className="type-caption text-text-muted" numberOfLines={1}>
        {label}
      </Text>
      <Text className="type-mono text-text tabular-nums">{value}</Text>
    </View>
  );
}
