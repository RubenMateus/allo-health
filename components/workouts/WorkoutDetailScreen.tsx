import * as Haptics from "expo-haptics";
import {
  ChevronDown,
  ChevronUp,
  Gauge,
  HeartPulse,
  ListOrdered,
  Timer,
  Zap,
} from "lucide-react-native";
import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { DetailTopBar } from "@/components/detail/DetailLayout";
import { zoneColors } from "@/components/fitness/fitnessMetrics";
import { Card, EmptyState } from "@/components/ui/primitives";
import {
  paceOrSpeed,
  workoutContext,
  WorkoutIcon,
  type WorkoutStat,
} from "@/components/workouts/workoutUi";
import { useWorkoutDetails } from "@/hooks/useWorkoutDetails";
import type { FitnessData } from "@/services/health/fitness";
import type {
  RunDynamics,
  Workout,
  WorkoutDetails,
} from "@/services/health/types";
import {
  calculateTrainingLoad,
  dayKey,
  heartRateRecoveryRating,
  workoutMinutes,
  workoutZoneMinutes,
  ZONE_FLOORS,
} from "@/services/metrics";
import {
  buildSplits,
  splitPace,
  trainingWeek,
  workoutKind,
  workoutMaxHeartRate,
  workoutStrain,
  workoutTitle,
  type WorkoutSplit,
} from "@/services/metrics/workouts";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import {
  distanceUnit,
  formatDayLabel,
  formatDistance,
  formatDuration,
  formatElapsed,
  formatElevation,
  formatEnergy,
  formatNumber,
  formatPace,
  formatTime,
} from "@/utils/formatters";

const ZONE_SHORT = ["Z1", "Z2", "Z3", "Z4", "Z5"];
const ZONE_LABELS = ["Recovery", "Endurance", "Tempo", "Threshold", "Max"];

export function WorkoutDetailScreen({ id }: { id: string }) {
  const { fitness, workout, details } = useWorkoutDetails(id);
  const data = fitness.data;

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-canvas">
      <DetailTopBar
        title={workout ? workoutTitle(workout) : "Workout"}
        subtitle={workout ? sessionWindow(workout) : undefined}
      />
      <ScrollView
        contentContainerClassName="gap-xl px-margin pb-16 pt-lg"
        showsVerticalScrollIndicator={false}
      >
        {workout && data ? (
          <WorkoutSections
            workout={workout}
            data={data}
            details={details.data ?? null}
            detailsLoading={details.isLoading}
          />
        ) : (
          <Card>
            <EmptyState
              title={
                fitness.isLoading ? "Loading workout" : "Workout not found"
              }
              detail={
                fitness.isLoading
                  ? "Reading this session from your health app."
                  : "This session is no longer in the last 30 days of workouts."
              }
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function sessionWindow(workout: Workout) {
  return `${formatDayLabel(new Date(workout.startedAt))} · ${formatTime(workout.startedAt)} – ${formatTime(workout.endedAt)}`;
}

function WorkoutSections({
  workout,
  data,
  details,
  detailsLoading,
}: {
  workout: Workout;
  data: FitnessData;
  details: WorkoutDetails | null;
  detailsLoading: boolean;
}) {
  const kind = workoutKind(workout);
  const profile = {
    restingHeartRate: data.restingHeartRate,
    maxHeartRate: data.maxHeartRate,
  };
  const strain = workoutStrain(workout, profile);
  const splits = useMemo(
    () =>
      details
        ? buildSplits(
            details.distanceSamples,
            workout.startedAt,
            workout.heartRateByMinute,
            distanceUnit.meters,
          )
        : [],
    [details, workout],
  );
  const hasRecovery =
    workout.heartRate.peak !== null && workout.heartRate.recovery !== null;

  return (
    <>
      <View className="flex-row items-center gap-sm self-start px-md py-xs rounded-full border border-outline-soft bg-surface">
        <WorkoutIcon kind={kind} size={22} highlighted />
        <Text className="type-caption text-text">
          {workoutContext(workout)}
        </Text>
      </View>

      <HeroCards workout={workout} strain={strain} />
      <StatStrip workout={workout} kind={kind} details={details} />
      <IntensityCard workout={workout} maxHeartRate={data.maxHeartRate} />
      {splits.length > 1 ? (
        <SplitsCard splits={splits} />
      ) : detailsLoading && workout.distanceMeters ? (
        <Card>
          <Text className="type-caption text-text-subtle">Loading splits…</Text>
        </Card>
      ) : null}
      {details?.dynamics && hasDynamics(details.dynamics) ? (
        <DynamicsCard dynamics={details.dynamics} />
      ) : null}
      {hasRecovery ? <RecoveryCard workout={workout} /> : null}
      <LoadCard workout={workout} data={data} />

      <View className="items-center py-sm">
        <Text className="type-caption text-text-subtle text-center">
          Strain, zones and load computed on this device.
        </Text>
      </View>
    </>
  );
}

function HeroCards({ workout, strain }: { workout: Workout; strain: number }) {
  const { colors } = useTheme();
  const distance =
    workout.distanceMeters && workout.distanceMeters >= 100
      ? formatDistance(workout.distanceMeters)
      : null;
  return (
    <View className="flex-row gap-gutter">
      <Card className="flex-1 gap-sm">
        <View className="flex-row items-center gap-xs">
          <Timer color={colors.primary} size={14} />
          <Text className="type-badge text-primary uppercase">
            {distance ? "Distance" : "Duration"}
          </Text>
        </View>
        <Text className="type-display text-text tabular-nums">
          {distance ? distance.value : formatDuration(workoutMinutes(workout))}
          {distance ? (
            <Text className="type-mono text-text-subtle"> {distance.unit}</Text>
          ) : null}
        </Text>
      </Card>
      <Card className="flex-1 gap-sm">
        <View className="flex-row items-center gap-xs">
          <Zap color={colors.stress} size={14} />
          <Text className="type-badge text-stress uppercase">Strain</Text>
        </View>
        <Text
          className="type-display tabular-nums"
          style={{ color: colors.strainEnd }}
        >
          {strain.toFixed(1)}
        </Text>
        <Text className="type-mono-small text-text-subtle">of 21</Text>
      </Card>
    </View>
  );
}

function StatStrip({
  workout,
  kind,
  details,
}: {
  workout: Workout;
  kind: ReturnType<typeof workoutKind>;
  details: WorkoutDetails | null;
}) {
  const stats: WorkoutStat[] = [
    {
      label: "Time",
      value: formatElapsed(workoutMinutes(workout) * 60),
    },
  ];
  const pace = paceOrSpeed(workout, kind);
  if (pace)
    stats.push({
      ...pace,
      label: pace.label === "Avg pace" ? "Pace" : "Speed",
    });
  if (workout.activeEnergyKcal !== null) {
    const energy = formatEnergy(workout.activeEnergyKcal);
    stats.push({ label: "Active", value: energy.value, unit: energy.unit });
  }
  if (details?.elevationGainMeters) {
    const elevation = formatElevation(details.elevationGainMeters);
    stats.push({
      label: "Elev gain",
      value: `+${elevation.value}`,
      unit: elevation.unit,
    });
  } else if (workout.heartRate.average !== null) {
    stats.push({
      label: "Avg HR",
      value: `${Math.round(workout.heartRate.average)}`,
      unit: "bpm",
    });
  }
  return (
    <View className="flex-row gap-sm">
      {stats.map((stat) => (
        <View
          key={stat.label}
          className="flex-1 rounded-md border border-outline-soft bg-surface-prose p-sm gap-2xs"
        >
          <Text className="type-caption text-text-subtle" numberOfLines={1}>
            {stat.label}
          </Text>
          <Text
            className="type-mono text-text tabular-nums"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {stat.value}
            {stat.unit ? (
              <Text className="text-text-subtle"> {stat.unit}</Text>
            ) : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CardTitle({
  icon,
  title,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-sm">
      {icon}
      <Text className="type-subheading text-text flex-1">{title}</Text>
      {trailing}
    </View>
  );
}

function IntensityCard({
  workout,
  maxHeartRate,
}: {
  workout: Workout;
  maxHeartRate: number;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const chartWidth = width - 64;
  const trace = workout.heartRateByMinute ?? [];
  const peak = workoutMaxHeartRate(workout);
  const zones = workoutZoneMinutes(workout, maxHeartRate);
  const total = zones.reduce((a, b) => a + b, 0);
  const top = total ? zones.indexOf(Math.max(...zones)) : -1;
  const palette = zoneColors(colors);
  if (workout.heartRate.average === null && !trace.some((bpm) => bpm > 0))
    return null;

  return (
    <Card className="gap-lg">
      <CardTitle
        icon={<HeartPulse color={colors.salmon} size={18} />}
        title="Heart rate"
        trailing={
          <View className="flex-row gap-xs">
            {workout.heartRate.average !== null ? (
              <Chip label={`Avg ${Math.round(workout.heartRate.average)}`} />
            ) : null}
            {peak !== null ? <Chip label={`Max ${peak}`} tone="hot" /> : null}
          </View>
        }
      />
      {trace.filter((bpm) => bpm > 0).length > 1 ? (
        <HeartRateChart
          trace={trace}
          width={chartWidth}
          threshold={Math.round(maxHeartRate * ZONE_FLOORS[3])}
          minutes={workoutMinutes(workout)}
        />
      ) : null}
      {total > 0 ? (
        <View className="gap-md">
          <View className="flex-row items-baseline justify-between">
            <Text className="type-badge text-text-subtle uppercase">
              Time in zones
            </Text>
            {top >= 0 ? (
              <Text className="type-caption" style={{ color: palette[top] }}>
                Mostly {ZONE_LABELS[top]!.toLowerCase()}
              </Text>
            ) : null}
          </View>
          <View className="flex-row h-2 gap-[3px] rounded-full overflow-hidden">
            {zones.map((minutes, zone) =>
              minutes > 0 ? (
                <View
                  key={zone}
                  style={{ flex: minutes, backgroundColor: palette[zone] }}
                />
              ) : null,
            )}
          </View>
          <View className="flex-row gap-xs">
            {zones.map((minutes, zone) => (
              <View
                key={zone}
                accessible
                accessibilityLabel={`Zone ${zone + 1}, ${ZONE_LABELS[zone]}: ${Math.round((minutes / total) * 100)} percent, ${minutes} minutes`}
                className={cn(
                  "flex-1 items-center gap-2xs py-sm rounded-md border",
                  zone === top
                    ? "border-outline bg-surface-high"
                    : "border-outline-soft bg-surface",
                )}
              >
                <Text className="type-badge" style={{ color: palette[zone] }}>
                  {ZONE_SHORT[zone]}
                </Text>
                <Text className="type-mono text-text tabular-nums">
                  {Math.round((minutes / total) * 100)}%
                </Text>
                <Text className="type-mono-small text-text-subtle">
                  {minutes}m
                </Text>
              </View>
            ))}
          </View>
          <Text className="type-mono-small text-text-subtle">
            Zones from a max heart rate of {maxHeartRate} bpm.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function Chip({ label, tone }: { label: string; tone?: "hot" }) {
  return (
    <View
      className={cn(
        "px-sm py-2xs rounded-sm border",
        tone === "hot"
          ? "border-stress-border bg-stress-wash"
          : "border-outline-soft bg-surface",
      )}
    >
      <Text
        className={cn(
          "type-mono-small tabular-nums",
          tone === "hot" ? "text-stress" : "text-text-muted",
        )}
      >
        {label} bpm
      </Text>
    </View>
  );
}

function clockLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = `${Math.round(minutes % 60)}`.padStart(2, "0");
  return hours ? `${hours}:${rest}:00` : `${rest}:00`;
}

function HeartRateChart({
  trace,
  width,
  threshold,
  minutes,
}: {
  trace: number[];
  width: number;
  threshold: number;
  minutes: number;
}) {
  const { colors } = useTheme();
  const height = 140;
  const fillId = `hr-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const chart = useMemo(() => {
    const readings = trace.filter((bpm) => bpm > 0);
    const min = Math.min(...readings, threshold) - 8;
    const max = Math.max(...readings, threshold) + 6;
    const x = (index: number) =>
      (index / Math.max(trace.length - 1, 1)) * width;
    const y = (bpm: number) =>
      height - ((bpm - min) / Math.max(max - min, 1)) * height;
    let path = "";
    let peakIndex = 0;
    trace.forEach((bpm, index) => {
      if (bpm <= 0) return;
      if (bpm > trace[peakIndex]!) peakIndex = index;
      path += `${path ? "L" : "M"} ${x(index).toFixed(1)} ${y(bpm).toFixed(1)} `;
    });
    const firstIndex = trace.findIndex((bpm) => bpm > 0);
    const lastIndex =
      trace.length - 1 - [...trace].reverse().findIndex((bpm) => bpm > 0);
    return {
      path,
      area: `${path} L ${x(lastIndex)} ${height} L ${x(firstIndex)} ${height} Z`,
      thresholdY: y(threshold),
      peak: { x: x(peakIndex), y: y(trace[peakIndex]!) },
    };
  }, [threshold, trace, width]);

  return (
    <View
      className="gap-xs"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Heart rate through the session, ranging up to ${Math.max(...trace)} beats per minute`}
    >
      <Text className="type-mono-small text-text-subtle">
        Threshold {threshold} bpm
      </Text>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.salmon} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={`${fillId}-line`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.salmon} />
          </LinearGradient>
        </Defs>
        <Line
          x1={0}
          x2={width}
          y1={chart.thresholdY}
          y2={chart.thresholdY}
          stroke={colors.textSubtle}
          strokeDasharray="4 4"
          strokeWidth={1}
          opacity={0.6}
        />
        <Path d={chart.area} fill={`url(#${fillId})`} />
        <Path
          d={chart.path}
          stroke={`url(#${fillId}-line)`}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle
          cx={chart.peak.x}
          cy={chart.peak.y}
          r={4.5}
          fill={colors.strainEnd}
          stroke={colors.surfaceProse}
          strokeWidth={2}
        />
      </Svg>
      <View className="flex-row justify-between">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <Text key={fraction} className="type-mono-small text-text-subtle">
            {clockLabel(minutes * fraction)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const VISIBLE_SPLITS = 5;

function SplitsCard({ splits }: { splits: WorkoutSplit[] }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const paces = splits.map((split) => splitPace(split, distanceUnit.meters));
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const visible = expanded ? splits : splits.slice(0, VISIBLE_SPLITS);
  const unit = distanceUnit.label === "km" ? "Kilometer" : "Mile";
  return (
    <Card className="gap-md">
      <CardTitle
        icon={<ListOrdered color={colors.primary} size={18} />}
        title={`${unit} splits`}
        trailing={
          <Text className="type-mono text-text-subtle">
            {splits.length} splits
          </Text>
        }
      />
      <View className="gap-2xs">
        {visible.map((split, index) => {
          const pace = paces[index]!;
          const previous = index > 0 ? paces[index - 1]! : null;
          const delta = previous === null ? null : Math.round(pace - previous);
          // Faster splits draw longer bars.
          const share =
            slowest === fastest
              ? 1
              : 0.35 + 0.65 * ((slowest - pace) / (slowest - fastest));
          return (
            <View
              key={split.index}
              className="flex-row items-center gap-md py-xs"
              accessible
              accessibilityLabel={`${distanceUnit.label} ${split.index}${split.complete ? "" : ", partial"}: ${formatPace(pace)} per ${distanceUnit.label}${split.heartRate ? `, ${split.heartRate} bpm` : ""}`}
            >
              <Text className="type-mono text-text-subtle w-10">
                {split.complete
                  ? `${split.index}`
                  : formatNumber(split.meters / distanceUnit.meters, 2)}
              </Text>
              <Text className="type-mono text-text tabular-nums w-12">
                {formatPace(pace)}
              </Text>
              <View className="flex-1 h-2 rounded-full bg-track overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${share * 100}%`,
                    backgroundColor:
                      pace === fastest ? colors.primary : colors.primaryBorder,
                  }}
                />
              </View>
              <Text
                className={cn(
                  "type-mono-small tabular-nums w-10 text-right",
                  delta === null || delta === 0
                    ? "text-text-subtle"
                    : delta < 0
                      ? "text-primary"
                      : "text-stress",
                )}
              >
                {delta === null
                  ? ""
                  : delta === 0
                    ? "0s"
                    : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}s`}
              </Text>
              <Text className="type-mono-small text-text-muted tabular-nums w-12 text-right">
                {split.heartRate ? `${split.heartRate} bpm` : "--"}
              </Text>
            </View>
          );
        })}
      </View>
      {splits.length > VISIBLE_SPLITS ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Haptics.selectionAsync();
            setExpanded((value) => !value);
          }}
          className="flex-row items-center justify-center gap-xs min-h-[40px] active:opacity-70"
        >
          <Text className="type-caption text-text-muted">
            {expanded
              ? "Show fewer splits"
              : `Show ${splits.length - VISIBLE_SPLITS} more ${splits.length - VISIBLE_SPLITS === 1 ? "split" : "splits"}`}
          </Text>
          {expanded ? (
            <ChevronUp color={colors.textMuted} size={14} />
          ) : (
            <ChevronDown color={colors.textMuted} size={14} />
          )}
        </Pressable>
      ) : null}
      <Text className="type-mono-small text-text-subtle">
        Pace per {distanceUnit.label}, change against the previous split, and
        average heart rate.
      </Text>
    </Card>
  );
}

function hasDynamics(dynamics: RunDynamics) {
  return Object.values(dynamics).some((value) => value !== null);
}

function DynamicsCard({ dynamics }: { dynamics: RunDynamics }) {
  const { colors } = useTheme();
  const rows: { label: string; value: string; unit: string }[] = [];
  if (dynamics.strideLengthMeters !== null)
    rows.push({
      label: "Stride length",
      value: formatNumber(dynamics.strideLengthMeters, 2),
      unit: "m",
    });
  if (dynamics.verticalOscillationCm !== null)
    rows.push({
      label: "Vertical oscillation",
      value: formatNumber(dynamics.verticalOscillationCm, 1),
      unit: "cm",
    });
  if (dynamics.groundContactMs !== null)
    rows.push({
      label: "Ground contact time",
      value: formatNumber(dynamics.groundContactMs),
      unit: "ms",
    });
  // 170–180 spm is the commonly cited efficient range for distance running.
  const cadenceShare =
    dynamics.cadence === null
      ? 0
      : Math.min(1, Math.max(0, (dynamics.cadence - 130) / 60));
  return (
    <Card className="gap-md">
      <CardTitle
        icon={<Gauge color={colors.primary} size={18} />}
        title="Run dynamics"
      />
      {dynamics.cadence !== null ? (
        <View className="rounded-md border border-outline-soft bg-surface p-md gap-sm">
          <Text className="type-caption text-text-subtle">Cadence</Text>
          <Text className="type-metric-lg text-text tabular-nums">
            {dynamics.cadence}
            <Text className="type-mono text-text-subtle"> spm</Text>
          </Text>
          <View className="h-1.5 rounded-full bg-track overflow-hidden">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${cadenceShare * 100}%` }}
            />
          </View>
        </View>
      ) : null}
      {rows.map((row) => (
        <View
          key={row.label}
          className="flex-row items-baseline justify-between py-xs border-b-hairline border-b-outline-soft"
        >
          <Text className="type-body-small text-text-muted">{row.label}</Text>
          <Text className="type-mono text-text tabular-nums">
            {row.value}
            <Text className="text-text-subtle"> {row.unit}</Text>
          </Text>
        </View>
      ))}
    </Card>
  );
}

function RecoveryCard({ workout }: { workout: Workout }) {
  const { colors } = useTheme();
  const drop = Math.max(
    0,
    Math.round(workout.heartRate.peak! - workout.heartRate.recovery!),
  );
  const rating = heartRateRecoveryRating(drop);
  return (
    <Card className="flex-row items-center gap-md">
      <HeartPulse color={colors.salmon} size={20} />
      <View className="flex-1 gap-2xs">
        <Text className="type-caption text-text-subtle">
          Heart rate recovery (1 min)
        </Text>
        <Text className="type-subheading text-text tabular-nums">
          −{drop} bpm
          <Text className="type-mono text-text-subtle">
            {"  "}
            {Math.round(workout.heartRate.peak!)} →{" "}
            {Math.round(workout.heartRate.recovery!)}
          </Text>
        </Text>
      </View>
      <View className="px-md py-xs rounded-full border border-primary-border bg-primary-wash">
        <Text className="type-badge text-primary uppercase">{rating}</Text>
      </View>
    </Card>
  );
}

function LoadCard({ workout, data }: { workout: Workout; data: FitnessData }) {
  const { colors } = useTheme();
  const profile = {
    restingHeartRate: data.restingHeartRate,
    maxHeartRate: data.maxHeartRate,
  };
  const load = calculateTrainingLoad(workout, profile);
  const muscular = workout.category === "strength";
  // Share of the load from this workout's calendar week (Monday to Sunday).
  const week = trainingWeek(
    data.workouts,
    profile,
    new Date(workout.startedAt),
  );
  const weekDates = new Set(week.days.map((day) => day.date));
  const weekWorkouts = data.workouts.filter((item) =>
    weekDates.has(dayKey(new Date(item.startedAt))),
  );
  const weekLoad = weekWorkouts.reduce(
    (total, item) => total + calculateTrainingLoad(item, profile),
    0,
  );
  const share = weekLoad > 0 ? Math.round((load / weekLoad) * 100) : null;
  return (
    <Card className="gap-md">
      <CardTitle
        icon={<Zap color={muscular ? colors.fat : colors.primary} size={18} />}
        title="Training load"
        trailing={
          <Text
            className="type-badge uppercase"
            style={{ color: muscular ? colors.fat : colors.primary }}
          >
            {muscular ? "Muscular" : "Cardio"}
          </Text>
        }
      />
      <View className="flex-row items-baseline gap-sm">
        <Text className="type-metric-xl text-text tabular-nums">
          {formatNumber(load)}
        </Text>
        <Text className="type-mono text-text-subtle">load</Text>
      </View>
      {share !== null ? (
        <View className="gap-xs">
          <View className="h-2 rounded-full bg-track overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${share}%`,
                backgroundColor: muscular ? colors.fat : colors.primary,
              }}
            />
          </View>
          <Text className="type-mono-small text-text-subtle">
            {share}% of that week&apos;s training load. Counts toward your{" "}
            {muscular ? "muscular" : "cardio"} load on the Fitness tab.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
