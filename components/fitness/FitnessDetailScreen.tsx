import { Text, useWindowDimensions, View } from "react-native";

import { BarChart } from "@/components/charts/BarChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { WeekCompareChart } from "@/components/charts/WeekCompareChart";
import {
  DetailLayout,
  DetailSection,
  StatGrid,
} from "@/components/detail/DetailLayout";
import {
  fitnessMetricTitles,
  gaugeStatus,
  zoneColors,
  zoneNames,
  type FitnessMetric,
} from "@/components/fitness/fitnessMetrics";
import { Card, EmptyState } from "@/components/ui/primitives";
import { useFitnessDashboard } from "@/hooks/useFitnessDashboard";
import type { FitnessData } from "@/services/health/fitness";
import type { Workout } from "@/services/health/types";
import {
  dayKey,
  heartRateRecoveryRating,
  workoutMinutes,
  workoutZoneMinutes,
  ZONE_FLOORS,
  type WeekComparison,
} from "@/services/metrics";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import {
  formatDay,
  formatDayLabel,
  formatDuration,
  formatEnergy,
  formatNumber,
} from "@/utils/formatters";

export function FitnessDetailScreen({ metric }: { metric: FitnessMetric }) {
  const { data } = useFitnessDashboard();
  const title = fitnessMetricTitles[metric];
  if (!data) return <DetailLayout title={title} value={null} />;
  switch (metric) {
    case "cardio-load":
    case "muscular-load":
      return <LoadDetail metric={metric} data={data} />;
    case "active-duration":
    case "active-energy":
      return <WeekDetail metric={metric} data={data} />;
    case "heart-rate-recovery":
      return <RecoveryDetail data={data} />;
    case "cardio-focus":
      return <FocusDetail data={data} />;
    case "heart-rate-zones":
      return <ZonesDetail data={data} />;
  }
}

function useChartWidth() {
  const { width } = useWindowDimensions();
  // Screen margins plus card padding on both sides.
  return width - 64;
}

function LoadDetail({
  metric,
  data,
}: {
  metric: "cardio-load" | "muscular-load";
  data: FitnessData;
}) {
  const { colors } = useTheme();
  const width = useChartWidth();
  const cardio = metric === "cardio-load";
  const gauge = cardio ? data.cardioGauge : data.muscularGauge;
  const loads = cardio ? data.cardioLoads : data.muscularLoads;
  const status = gaugeStatus(gauge, colors);
  const previousWeek = loads.slice(-14, -7).reduce((a, b) => a + b, 0);
  // Anchor on the data's last day rather than the clock, so the page is stable.
  const end = new Date(`${data.rangeEnd}T00:00:00`);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  const workouts = data.workouts.filter(
    (workout) =>
      (workout.category === "strength") !== cardio &&
      new Date(workout.startedAt) >= start,
  );
  const dayLabels = loads.map((_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (loads.length - 1 - index));
    return index === 0 || index === loads.length - 1 || index === 13
      ? formatDay(dayKey(date))
      : undefined;
  });

  return (
    <DetailLayout
      title={fitnessMetricTitles[metric]}
      value={formatNumber(gauge.value)}
      unit="load"
      status={status.label}
      statusColor={status.color}
      caption="Last 7 days"
    >
      <DetailSection title="Daily load, last 4 weeks">
        <Card>
          <BarChart
            bars={loads.map((load, index) => ({
              value: load,
              label: dayLabels[index],
              color: index >= loads.length - 7 ? undefined : colors.textSubtle,
            }))}
            width={width}
            height={140}
            color={cardio ? colors.primary : colors.fat}
            accessibilityLabel={`Daily ${cardio ? "cardio" : "strength"} load over 28 days`}
          />
          <Text className="type-caption text-text-subtle mt-md">
            The last 7 days are highlighted.
          </Text>
        </Card>
      </DetailSection>

      <Card>
        <StatGrid
          stats={[
            { label: "Last 7 days", value: formatNumber(gauge.value) },
            {
              label: "Optimal",
              value: gauge.optimal
                ? `${formatNumber(gauge.optimal[0])}–${formatNumber(gauge.optimal[1])}`
                : "—",
            },
            {
              label: "4-week average",
              value: formatNumber(gauge.chronicWeekly),
              unit: "/ wk",
            },
            { label: "Week before", value: formatNumber(previousWeek) },
          ]}
        />
      </Card>

      <DetailSection title="What this means">
        <Card>
          <Text className="type-body-small text-text-muted">
            {cardio
              ? "Cardio load adds up every cardio and mixed session, weighting each minute by how hard your heart was working (heart rate reserve, Banister TRIMP)."
              : "Muscular load estimates strain from strength sessions, from their duration and heart rate. Health apps don't record sets, reps or weight lifted, so this tracks how much and how hard you train rather than volume."}
          </Text>
          <Text className="type-body-small mt-md text-text-subtle">
            The optimal range is 0.8 to 1.3 times your average week over the
            last 4 weeks. Staying inside it builds fitness steadily; a jump
            above it raises injury and overtraining risk.
          </Text>
        </Card>
      </DetailSection>

      <WorkoutList
        title="Sessions this week"
        workouts={workouts}
        empty={`No ${cardio ? "cardio" : "strength"} sessions in the last 7 days.`}
        detail={(workout) =>
          workout.heartRate.average === null
            ? formatDuration(workoutMinutes(workout))
            : `${formatDuration(workoutMinutes(workout))} · ${workout.heartRate.average} bpm avg`
        }
      />
    </DetailLayout>
  );
}

function WeekDetail({
  metric,
  data,
}: {
  metric: "active-duration" | "active-energy";
  data: FitnessData;
}) {
  const { colors } = useTheme();
  const width = useChartWidth();
  const energy = metric === "active-energy";
  const week: WeekComparison = energy ? data.activeEnergy : data.activeMinutes;
  const format = (value: number) => {
    if (!energy) return { value: formatDuration(value), unit: undefined };
    const formatted = formatEnergy(value);
    return { value: formatted.value, unit: formatted.unit };
  };
  const change = week.total - week.previousTotal;
  const accent = energy ? colors.stress : colors.blue;
  const weeks = [3, 2, 1, 0].map((weeksAgo) => {
    const slice = data.days.slice(
      data.days.length - 7 * (weeksAgo + 1),
      data.days.length - 7 * weeksAgo,
    );
    return {
      value: slice.reduce(
        (total, day) => total + (energy ? day.energyKcal : day.minutes),
        0,
      ),
      label:
        weeksAgo === 0
          ? "This wk"
          : weeksAgo === 1
            ? "Last wk"
            : `${weeksAgo}w ago`,
    };
  });
  const total = format(week.total);

  return (
    <DetailLayout
      title={fitnessMetricTitles[metric]}
      value={total.value}
      unit={total.unit}
      status={
        week.previousTotal
          ? `${change >= 0 ? "+" : "−"}${format(Math.abs(change)).value} vs last week`
          : null
      }
      statusColor={change >= 0 ? colors.primary : colors.textMuted}
      caption="Workouts in the last 7 days"
    >
      <DetailSection title="This week vs last week">
        <Card>
          <WeekCompareChart
            current={week.current}
            previous={week.previous}
            width={width}
            height={150}
            color={accent}
            accessibilityLabel={`${fitnessMetricTitles[metric]} this week against last week`}
          />
          <View className="flex-row items-center gap-sm mt-md">
            <View
              className="w-3 h-[3px] rounded-full"
              style={{ backgroundColor: accent }}
            />
            <Text className="type-caption text-text-muted mr-md">
              This week
            </Text>
            <View className="w-3 h-[3px] rounded-full bg-text-subtle" />
            <Text className="type-caption text-text-muted mr-md">
              Last week
            </Text>
          </View>
        </Card>
      </DetailSection>

      <DetailSection title="Last 4 weeks">
        <Card>
          <BarChart
            bars={weeks.map((entry, index) => ({
              value: entry.value,
              label: entry.label,
              color: index === 3 ? accent : colors.textSubtle,
            }))}
            width={width}
            height={110}
            color={accent}
            accessibilityLabel={`${fitnessMetricTitles[metric]} per week for 4 weeks`}
          />
        </Card>
      </DetailSection>

      <DetailSection title="By activity">
        {data.weekActivities.length ? (
          <Card className="py-xs">
            {data.weekActivities.map((entry, index) => {
              const value = energy
                ? `${formatEnergy(entry.energyKcal).value} ${formatEnergy(entry.energyKcal).unit}`
                : formatDuration(entry.minutes);
              return (
                <View
                  key={entry.activity}
                  className={cn(
                    "flex-row items-center justify-between gap-md py-md",
                    index > 0 && "border-t-hairline border-t-outline-soft",
                  )}
                >
                  <View className="flex-1 gap-2xs">
                    <Text className="type-subheading text-text text-[15px]">
                      {entry.activity}
                    </Text>
                    <Text className="type-caption text-text-muted">
                      {entry.sessions}{" "}
                      {entry.sessions === 1 ? "session" : "sessions"}
                    </Text>
                  </View>
                  <Text className="type-mono text-text tabular-nums">
                    {value}
                  </Text>
                </View>
              );
            })}
          </Card>
        ) : (
          <Card>
            <EmptyState
              title="No workouts this week"
              detail="Workouts from the last 7 days will be broken down here."
            />
          </Card>
        )}
      </DetailSection>

      <Text className="type-caption text-text-subtle text-center">
        {energy
          ? "Energy burned during recorded workouts, not your whole day."
          : "Time spent in recorded workouts."}
      </Text>
    </DetailLayout>
  );
}

function RecoveryDetail({ data }: { data: FitnessData }) {
  const { colors } = useTheme();
  const width = useChartWidth();
  const withRecovery = data.workouts.filter(
    (workout) =>
      workout.heartRate.peak !== null && workout.heartRate.recovery !== null,
  );
  const drop = (workout: Workout) =>
    Math.max(
      0,
      Math.round(workout.heartRate.peak! - workout.heartRate.recovery!),
    );
  const latest = withRecovery[0];
  const values = withRecovery.map(drop);
  const average = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;

  return (
    <DetailLayout
      title="Heart rate recovery"
      value={latest ? `${drop(latest)}` : null}
      unit="bpm"
      status={latest ? heartRateRecoveryRating(drop(latest)) : null}
      statusColor={colors.salmon}
      caption={
        latest
          ? `After ${latest.activity.toLowerCase()} on ${formatDayLabel(new Date(latest.endedAt))}`
          : null
      }
    >
      {withRecovery.length ? (
        <>
          <DetailSection title="Last 30 days">
            <Card>
              <TrendChart
                points={[...withRecovery].reverse().map((workout) => ({
                  time: new Date(workout.endedAt).getTime(),
                  value: drop(workout),
                }))}
                color={colors.salmon}
                width={width}
                band={[25, 40]}
                formatValue={(value) => formatNumber(value)}
                accessibilityLabel="Heart rate recovery after each workout"
              />
              <Text className="type-caption text-text-subtle mt-md">
                Shaded: 25–40 bpm, a good one-minute drop.
              </Text>
            </Card>
          </DetailSection>
          <Card>
            <StatGrid
              stats={[
                {
                  label: "Average",
                  value: formatNumber(average ?? 0),
                  unit: "bpm",
                },
                {
                  label: "Best",
                  value: formatNumber(Math.max(...values)),
                  unit: "bpm",
                },
                { label: "Workouts", value: `${values.length}` },
                {
                  label: "Rating",
                  value: heartRateRecoveryRating(Math.round(average ?? 0)),
                },
              ]}
            />
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            title="No recovery readings yet"
            detail="Recovery needs heart rate for a minute or two after a workout ends. Keep your watch on as you cool down."
          />
        </Card>
      )}

      <DetailSection title="What this means">
        <Card>
          <Text className="type-body-small text-text-muted">
            How far your heart rate falls in the first minute after a workout. A
            faster drop reflects a stronger parasympathetic response and better
            cardiovascular fitness.
          </Text>
          <Text className="type-body-small mt-md text-text-subtle">
            40 bpm or more is excellent, 25–39 good, 12–24 fair. Under 12 bpm is
            a recognised clinical warning sign worth mentioning to a doctor if
            it persists.
          </Text>
        </Card>
      </DetailSection>

      <WorkoutList
        title="Recent workouts"
        workouts={withRecovery.slice(0, 10)}
        empty=""
        detail={(workout) =>
          `${workout.heartRate.peak} → ${workout.heartRate.recovery} bpm · −${drop(workout)}`
        }
      />
    </DetailLayout>
  );
}

function FocusDetail({ data }: { data: FitnessData }) {
  const { colors } = useTheme();
  const focus = data.cardioFocus;
  const rows = focus
    ? [
        {
          label: "Low aerobic",
          value: focus.aerobic,
          color: colors.primary,
          detail:
            "Below 70% of heart rate reserve. Builds your aerobic base and recovers well.",
        },
        {
          label: "High aerobic",
          value: focus.threshold,
          color: colors.sleep,
          detail:
            "70–85% of reserve. Tempo and threshold work that lifts sustainable pace.",
        },
        {
          label: "Anaerobic",
          value: focus.anaerobic,
          color: colors.salmon,
          detail:
            "Above 85% of reserve. Short, hard efforts that build top-end speed.",
        },
      ]
    : [];
  const top = [...rows].sort((a, b) => b.value - a.value)[0];

  return (
    <DetailLayout
      title="Cardio focus"
      value={top ? `${top.value}%` : null}
      status={top?.label}
      statusColor={top?.color}
      caption="Cardio minutes, last 30 days"
    >
      {rows.length ? (
        <Card>
          <View className="gap-lg">
            {rows.map((row) => (
              <View key={row.label} className="gap-xs">
                <View className="flex-row justify-between items-baseline">
                  <Text className="type-subheading text-text text-[15px]">
                    {row.label}
                  </Text>
                  <Text
                    className="type-mono text-text tabular-nums"
                    style={{ color: row.color }}
                  >
                    {row.value}%
                  </Text>
                </View>
                <View className="h-2 rounded-full overflow-hidden bg-track">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(row.value, 2)}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </View>
                <Text className="type-caption text-text-muted">
                  {row.detail}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="No cardio with heart rate"
            detail="Cardio workouts with heart rate from the last 30 days will be split by intensity here."
          />
        </Card>
      )}
      <DetailSection title="What this means">
        <Card>
          <Text className="type-body-small text-text-muted">
            Each cardio session counts towards one band by its average heart
            rate, as a share of your heart rate reserve (between resting and
            maximum). Most endurance plans put about 80% of time in low aerobic
            work.
          </Text>
        </Card>
      </DetailSection>
    </DetailLayout>
  );
}

function ZonesDetail({ data }: { data: FitnessData }) {
  const { colors } = useTheme();
  const palette = zoneColors(colors);
  const week = data.zoneWeeks.at(-1)?.minutes ?? [0, 0, 0, 0, 0];
  const weekTotal = week.reduce((a, b) => a + b, 0);
  const topMinutes = Math.max(...week);
  const topZone = week.indexOf(topMinutes);
  const max = data.maxHeartRate;
  const bounds = (zone: number) =>
    `${Math.round(ZONE_FLOORS[zone]! * max)}–${zone === 4 ? max : Math.round(ZONE_FLOORS[zone + 1]! * max) - 1} bpm`;

  return (
    <DetailLayout
      title="Heart rate zones"
      value={topMinutes > 0 ? `Zone ${topZone + 1}` : null}
      status={
        topMinutes > 0
          ? `${formatDuration(topMinutes)} of ${formatDuration(weekTotal)}`
          : null
      }
      statusColor={palette[topZone]}
      caption="Last 7 days"
    >
      <DetailSection title="This week">
        <Card>
          <View className="gap-lg">
            {week.map((minutes, zone) => (
              <View key={zone} className="gap-xs">
                <View className="flex-row justify-between items-baseline">
                  <Text className="type-subheading text-text text-[15px]">
                    {zoneNames[zone]}
                  </Text>
                  <Text className="type-mono text-text tabular-nums">
                    {formatDuration(minutes)}
                  </Text>
                </View>
                <View className="h-2 rounded-full overflow-hidden bg-track">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${weekTotal ? Math.max((minutes / weekTotal) * 100, minutes ? 2 : 0) : 0}%`,
                      backgroundColor: palette[zone],
                    }}
                  />
                </View>
                <Text className="type-caption text-text-muted">
                  {bounds(zone)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </DetailSection>

      <DetailSection title="Last 4 weeks">
        <Card>
          <View className="gap-lg">
            {data.zoneWeeks.map((entry) => {
              const total = entry.minutes.reduce((a, b) => a + b, 0);
              return (
                <View key={entry.start} className="gap-xs">
                  <View className="flex-row justify-between items-baseline">
                    <Text className="type-caption text-text-muted">
                      Week of {formatDay(entry.start)}
                    </Text>
                    <Text className="type-mono text-text tabular-nums">
                      {formatDuration(total)}
                    </Text>
                  </View>
                  <View className="h-2 rounded-full overflow-hidden bg-track flex-row gap-0.5">
                    {entry.minutes.map((minutes, zone) =>
                      minutes > 0 ? (
                        <View
                          key={zone}
                          style={{
                            flex: minutes,
                            backgroundColor: palette[zone],
                          }}
                        />
                      ) : null,
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      </DetailSection>

      <DetailSection title="What this means">
        <Card>
          <Text className="type-body-small text-text-muted">
            Zones are bands of your maximum heart rate, {max} bpm
            {data.maxHeartRateFromAge
              ? ", estimated from your age (208 − 0.7 × age)."
              : ". That's a default; add your birth year on the Biomarkers tab for a personal estimate."}{" "}
            Time is counted minute by minute from your workouts&apos; heart
            rate.
          </Text>
        </Card>
      </DetailSection>

      <WorkoutList
        title="Recent workouts"
        workouts={data.workouts.slice(0, 10)}
        empty="No workouts in the last 30 days."
        detail={(workout) => {
          const zones = workoutZoneMinutes(workout, max);
          const best = Math.max(...zones);
          return best > 0
            ? `${formatDuration(workoutMinutes(workout))} · mostly zone ${zones.indexOf(best) + 1}`
            : formatDuration(workoutMinutes(workout));
        }}
      />
    </DetailLayout>
  );
}

function WorkoutList({
  title,
  workouts,
  empty,
  detail,
}: {
  title: string;
  workouts: Workout[];
  empty: string;
  detail: (workout: Workout) => string;
}) {
  if (!workouts.length && !empty) return null;
  return (
    <DetailSection title={title}>
      <Card className="py-xs">
        {workouts.length ? (
          workouts.map((workout, index) => (
            <View
              key={workout.id}
              className={cn(
                "flex-row items-center justify-between gap-md py-md",
                index > 0 && "border-t-hairline border-t-outline-soft",
              )}
            >
              <View className="flex-1 gap-2xs">
                <Text className="type-subheading text-text text-[15px]">
                  {workout.activity}
                </Text>
                <Text className="type-caption text-text-muted">
                  {detail(workout)}
                </Text>
              </View>
              <Text className="type-mono-small text-text-subtle">
                {formatDayLabel(new Date(workout.startedAt))}
              </Text>
            </View>
          ))
        ) : (
          <Text className="type-caption text-text-muted py-md">{empty}</Text>
        )}
      </Card>
    </DetailSection>
  );
}
