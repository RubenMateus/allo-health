import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { BarChart } from "@/components/charts/BarChart";
import {
  DetailLayout,
  DetailSection,
  PrivacyNote,
  useDetailChartWidth,
} from "@/components/detail/DetailLayout";
import { LoadBalanceCard } from "@/components/loadBalance/LoadBalanceCard";
import { Card, EmptyState } from "@/components/ui/primitives";
import { usePeriodSummary } from "@/hooks/usePeriodSummary";
import { fromDayKey, tagLabels } from "@/services/journal";
import type { DailyScore } from "@/services/metrics/daily";
import { loadBalanceRules } from "@/services/metrics/loadBalance";
import {
  daysInPeriod,
  periodContaining,
  shiftPeriod,
  summaryRules,
  type Period,
  type PeriodKind,
} from "@/services/metrics/summary";
import { useDayStore, useTodayKey } from "@/stores/dayStore";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import { formatDay, formatDuration, formatMonthName } from "@/utils/formatters";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The period named by the route, falling back to the current week; never later than today. */
export function periodFromParams(
  params: { period?: string | string[]; start?: string | string[] },
  today: string,
): Period {
  const kind: PeriodKind = params.period === "month" ? "month" : "week";
  const start = typeof params.start === "string" ? params.start : "";
  const day = DAY_KEY.test(start) && start <= today ? start : today;
  return periodContaining(kind, day);
}

export function periodTitle(period: Period): string {
  if (period.kind === "month") return formatMonthName(fromDayKey(period.start), true);
  return `${formatDay(period.start)} – ${formatDay(period.end)}`;
}

/** "+4", "−2", or "±0" when the change rounds to nothing. */
export function formatDelta(value: number, decimals = 0): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  return `${sign}${Math.abs(rounded).toFixed(decimals)}`;
}

const weekday = (key: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(fromDayKey(key));

/** A week or month at a glance: how it went against the one before, and what to try next. */
export function SummaryScreen() {
  const params = useLocalSearchParams<{ period?: string; start?: string }>();
  const today = useTodayKey();
  const period = periodFromParams(params, today);
  const summary = usePeriodSummary(period);
  const chartWidth = useDetailChartWidth();
  const { colors } = useTheme();
  const selectDay = useDayStore((s) => s.selectDay);

  const noun = period.kind;
  const isCurrent = period.start === periodContaining(period.kind, today).start;
  const enoughData = summary.scores.scoredDays >= loadBalanceRules.minDays;
  const { averages, deltas } = summary.scores;
  const versus = `vs last ${noun}`;

  const go = (steps: number) => {
    void Haptics.selectionAsync();
    router.setParams({ period: period.kind, start: shiftPeriod(period, steps).start });
  };

  const openDay = (day: DailyScore) => {
    void Haptics.selectionAsync();
    selectDay(day.date);
    router.dismissTo("/");
  };

  return (
    <DetailLayout
      title={noun === "week" ? "Week summary" : "Month summary"}
      value={
        !enoughData || averages.recovery === null ? null : `${Math.round(averages.recovery)}`
      }
      unit="%"
      status="Average recovery"
      caption={
        !enoughData || deltas.recovery === null
          ? null
          : `${formatDelta(deltas.recovery)} ${versus.toUpperCase()}`
      }
    >
      <View className="flex-row items-center justify-between -mt-lg">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Previous ${noun}`}
          onPress={() => go(-1)}
          className="w-10 h-10 items-center justify-center rounded-full bg-surface-high active:opacity-70"
        >
          <ChevronLeft color={colors.textMuted} size={18} />
        </Pressable>
        <View className="items-center">
          <Text className="type-subheading text-text">{periodTitle(period)}</Text>
          {isCurrent ? (
            <Text className="type-mono-small text-text-subtle">SO FAR</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next ${noun}`}
          accessibilityState={{ disabled: isCurrent }}
          disabled={isCurrent}
          onPress={() => go(1)}
          className={cn(
            "w-10 h-10 items-center justify-center rounded-full bg-surface-high active:opacity-70",
            isCurrent && "opacity-40",
          )}
        >
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
      </View>

      {!enoughData ? (
        summary.loading ? (
          <Card>
            <Text className="type-caption text-text-subtle">Reading your days…</Text>
          </Card>
        ) : (
          <EmptyState
            title="Not enough data yet"
            detail={`A summary needs at least ${loadBalanceRules.minDays} days with a recovery score. ${summary.scores.scoredDays} so far this ${noun}.`}
          />
        )
      ) : (
        <>
          <DetailSection title="Averages">
            <Card className="flex-row justify-between">
              <Stat label="Recovery" value={averages.recovery} unit="%" delta={deltas.recovery} />
              <Stat label="Strain" value={averages.strain} delta={deltas.strain} decimals={1} />
              <Stat label="Sleep" value={averages.sleep} delta={deltas.sleep} />
            </Card>
            <Text className="type-caption text-text-subtle -mt-xs">
              Changes are against last {noun}. {summary.scores.scoredDays} of{" "}
              {summary.days.length} days scored.
            </Text>
          </DetailSection>

          <DetailSection title="Day by day">
            <Card>
              <BarChart
                bars={summary.days.map((day, index) => ({
                  value: summary.scoresByDay[day]?.recovery ?? 0,
                  label:
                    index === 0 || index === summary.days.length - 1
                      ? formatDay(day)
                      : undefined,
                }))}
                width={chartWidth}
                color={colors.primary}
                max={100}
                accessibilityLabel={`Recovery for each day, average ${Math.round(averages.recovery ?? 0)}`}
              />
            </Card>
          </DetailSection>

          {period.kind === "week" ? (
            <DetailSection title="Load balance">
              <LoadBalanceCard
                // The whole week, days still to come left empty, so the chart starts on Monday.
                days={daysInPeriod(period, period.end).map((day) => ({
                  date: day,
                  strain: summary.scoresByDay[day]?.strain ?? null,
                  recovery: summary.scoresByDay[day]?.recovery ?? null,
                }))}
                width={chartWidth}
                count={7}
              />
            </DetailSection>
          ) : null}

          <DetailSection title="Highs and lows">
            <Card className="gap-md">
              {summary.scores.best ? (
                <DayRow label="Best day" day={summary.scores.best} onPress={openDay} />
              ) : null}
              {summary.scores.toughest &&
              summary.scores.toughest.date !== summary.scores.best?.date ? (
                <DayRow label="Toughest day" day={summary.scores.toughest} onPress={openDay} />
              ) : null}
            </Card>
          </DetailSection>
        </>
      )}

      {summary.workouts && summary.workouts.count > 0 ? (
        <DetailSection title="Workouts">
          <Card className="gap-xs">
            <Text className="type-body text-text">
              {summary.workouts.count} {summary.workouts.count === 1 ? "workout" : "workouts"} ·{" "}
              {formatDuration(summary.workouts.minutes)} · {summary.workouts.activeEnergyKcal} kcal
            </Text>
            <Text className="type-caption text-text-subtle">
              {(["cardio", "strength", "mixed"] as const)
                .filter((c) => summary.workouts!.byCategory[c] > 0)
                .map((c) => `${summary.workouts!.byCategory[c]} ${c}`)
                .join(" · ")}
            </Text>
          </Card>
        </DetailSection>
      ) : null}

      {summary.journal.loggedDays > 0 ? (
        <DetailSection title="Journal">
          <Card className="gap-xs">
            <Text className="type-body text-text">
              {summary.journal.loggedDays} {summary.journal.loggedDays === 1 ? "day" : "days"} logged
              {summary.journal.averageMood !== null
                ? ` · mood ${summary.journal.averageMood.toFixed(1)} · energy ${summary.journal.averageEnergy?.toFixed(1)}`
                : ""}
            </Text>
            {summary.journal.topTags.length ? (
              <Text className="type-caption text-text-subtle">
                {summary.journal.topTags
                  .map((t) => `${tagLabels[t.tag]} ×${t.days}`)
                  .join(" · ")}
              </Text>
            ) : null}
          </Card>
        </DetailSection>
      ) : null}

      {summary.suggestions && summary.suggestions.length > 0 ? (
        <DetailSection title={noun === "week" ? "Next week" : "Next month"}>
          <Card className="gap-md">
            {summary.suggestions.map((s) => (
              <Text key={s.id} className="type-body-small text-text">
                {s.text}
              </Text>
            ))}
          </Card>
          <Text className="type-caption text-text-subtle -mt-xs">
            How this works: suggestions come from this {noun}&apos;s load balance, sleep
            (average under {summaryRules.sleepAverageBelow} or {summaryRules.poorNightsForSuggestion}+ nights under{" "}
            {summaryRules.poorNightBelow}), journal tags followed by recovery{" "}
            {summaryRules.tagDifferenceAtLeast}+ lower, and a recovery drop of{" "}
            {summaryRules.recoveryDropAtLeast}+ against last {noun}.
          </Text>
        </DetailSection>
      ) : null}

      <PrivacyNote />
    </DetailLayout>
  );
}

function Stat({
  label,
  value,
  unit,
  delta,
  decimals = 0,
}: {
  label: string;
  value: number | null;
  unit?: string;
  delta: number | null;
  decimals?: number;
}) {
  return (
    <View className="items-center gap-2xs flex-1">
      <Text className="type-caption text-text-muted">{label}</Text>
      <Text className="type-heading text-text tabular-nums">
        {value === null ? "—" : `${value.toFixed(decimals)}${unit ?? ""}`}
      </Text>
      {delta !== null ? (
        <Text className="type-mono-small text-text-subtle tabular-nums">
          {formatDelta(delta, decimals)}
        </Text>
      ) : null}
    </View>
  );
}

function DayRow({
  label,
  day,
  onPress,
}: {
  label: string;
  day: DailyScore;
  onPress: (day: DailyScore) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${weekday(day.date)} ${formatDay(day.date)}, recovery ${day.recovery}`}
      onPress={() => onPress(day)}
      className="flex-row items-center justify-between active:opacity-70"
    >
      <View>
        <Text className="type-caption text-text-muted">{label}</Text>
        <Text className="type-body text-text">
          {weekday(day.date)}, {formatDay(day.date)}
        </Text>
      </View>
      <View className="flex-row items-center gap-xs">
        <Text className="type-mono text-text tabular-nums">{day.recovery}%</Text>
        <ChevronRight color={colors.textMuted} size={16} />
      </View>
    </Pressable>
  );
}
