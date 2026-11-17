import * as Haptics from "expo-haptics";
import { ChevronRight, Zap } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Sparkline } from "@/components/charts/Sparkline";
import { DetailTopBar } from "@/components/detail/DetailLayout";
import { zoneNames } from "@/components/fitness/fitnessMetrics";
import { Card, EmptyState } from "@/components/ui/primitives";
import {
  formatSessionDate,
  openWorkout,
  StrainPill,
  WorkoutIcon,
  workoutStats,
  type WorkoutStat,
} from "@/components/workouts/workoutUi";
import { useFitnessDashboard } from "@/hooks/useFitnessDashboard";
import type { FitnessData } from "@/services/health/fitness";
import type { Workout } from "@/services/health/types";
import { dayKey, workoutZoneMinutes } from "@/services/metrics";
import {
  totalWorkouts,
  trainingWeek,
  workoutKind,
  workoutKinds,
  workoutStrain,
  workoutTitle,
  type WorkoutKind,
} from "@/services/metrics/workouts";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { cn } from "@/utils/cn";
import {
  formatDay,
  formatDistance,
  formatDuration,
  formatEnergy,
} from "@/utils/formatters";

type Filter = "all" | WorkoutKind;

export function WorkoutsScreen() {
  const { colors } = useTheme();
  const { data, isLoading, isFetching, refetch } = useFitnessDashboard();
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-canvas">
      <DetailTopBar title="Workouts" subtitle="Last 30 days" />
      <ScrollView
        contentContainerClassName="gap-2xl px-margin pb-16 pt-xl"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {!data ? (
          <Card>
            <EmptyState
              title={isLoading ? "Loading workouts" : "Workouts unavailable"}
              detail={
                isLoading
                  ? "Reading workouts from your health app."
                  : "We couldn't read workouts from your health source. Check that workout access is allowed, then pull to refresh."
              }
            />
          </Card>
        ) : (
          <WorkoutSections data={data} filter={filter} onFilter={setFilter} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkoutSections({
  data,
  filter,
  onFilter,
}: {
  data: FitnessData;
  filter: Filter;
  onFilter: (filter: Filter) => void;
}) {
  const profile = {
    restingHeartRate: data.restingHeartRate,
    maxHeartRate: data.maxHeartRate,
  };
  const kinds = useMemo(() => {
    const present = new Set(data.workouts.map(workoutKind));
    return workoutKinds.filter((entry) => present.has(entry.kind));
  }, [data.workouts]);
  const workouts =
    filter === "all"
      ? data.workouts
      : data.workouts.filter((workout) => workoutKind(workout) === filter);
  const [featured, ...past] = workouts;

  if (!data.workouts.length)
    return (
      <Card>
        <EmptyState
          title="No workouts yet"
          detail="Workouts recorded in your health app over the last 30 days will appear here."
        />
      </Card>
    );

  return (
    <>
      <FilterChips kinds={kinds} value={filter} onChange={onFilter} />
      <WeekCard workouts={workouts} profile={profile} />
      {featured ? (
        <View className="gap-md">
          <SectionLabel title="Latest session" />
          <FeaturedCard
            workout={featured}
            strain={workoutStrain(featured, profile)}
            maxHeartRate={data.maxHeartRate}
          />
        </View>
      ) : null}
      {past.length ? (
        <View className="gap-md">
          <SectionLabel
            title="Past sessions"
            trailing={`${formatDay(dayKey(new Date(past.at(-1)!.startedAt)))} – ${formatDay(dayKey(new Date(past[0]!.startedAt)))}`}
          />
          <View className="gap-gutter">
            {past.map((workout) => (
              <SessionCard
                key={workout.id}
                workout={workout}
                strain={workoutStrain(workout, profile)}
              />
            ))}
          </View>
        </View>
      ) : null}
      <TotalsCard workouts={workouts} />
    </>
  );
}

function SectionLabel({
  title,
  trailing,
}: {
  title: string;
  trailing?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text className="type-badge text-text-subtle uppercase">{title}</Text>
      {trailing ? (
        <Text className="type-mono text-text-subtle">{trailing}</Text>
      ) : null}
    </View>
  );
}

function FilterChips({
  kinds,
  value,
  onChange,
}: {
  kinds: typeof workoutKinds;
  value: Filter;
  onChange: (value: Filter) => void;
}) {
  const options: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    ...kinds.map((entry) => ({ value: entry.kind, label: entry.label })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-sm"
      className="-mx-margin"
      contentContainerStyle={{ paddingHorizontal: spacing.margin }}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            className={cn(
              "min-h-[36px] px-lg rounded-full border flex-row items-center gap-xs",
              selected
                ? "bg-surface-highest border-outline"
                : "bg-surface border-outline-soft",
            )}
          >
            <Text
              className={cn(
                "type-caption",
                selected ? "text-text" : "text-text-muted",
              )}
            >
              {option.label}
            </Text>
            {selected ? (
              <View className="w-[6px] h-[6px] rounded-full bg-primary" />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function WeekCard({
  workouts,
  profile,
}: {
  workouts: Workout[];
  profile: { restingHeartRate: number; maxHeartRate: number };
}) {
  const { colors } = useTheme();
  const week = trainingWeek(workouts, profile, new Date());
  return (
    <Card>
      <View className="flex-row items-start gap-md">
        <View className="flex-1 gap-2xs">
          <Text className="type-badge text-text-subtle uppercase">
            This week&apos;s training load
          </Text>
          <Text className="type-heading text-text">
            {week.sessions} {week.sessions === 1 ? "session" : "sessions"}
            {week.minutes > 0 ? ` · ${formatDuration(week.minutes)}` : ""}
          </Text>
        </View>
        <View className="flex-row items-center gap-2xs px-md py-xs rounded-md border border-primary-border bg-primary-wash">
          <Zap color={colors.primary} size={13} />
          <Text className="type-mono text-primary tabular-nums">
            {week.strain.toFixed(1)} strain
          </Text>
        </View>
      </View>
      <View
        className="flex-row justify-between mt-lg"
        accessible
        accessibilityLabel={`Strain by day this week: ${week.days
          .map(
            (day, index) =>
              `${WEEKDAY_LETTERS[index]} ${day.sessions ? day.strain.toFixed(1) : "rest"}`,
          )
          .join(", ")}`}
      >
        {week.days.map((day, index) => (
          <View key={day.date} className="items-center gap-xs">
            <Text
              className={cn(
                "type-caption",
                day.isToday ? "text-primary" : "text-text-subtle",
              )}
            >
              {WEEKDAY_LETTERS[index]}
            </Text>
            <View
              className={cn(
                "w-9 h-9 rounded-md items-center justify-center gap-[3px] border",
                day.isToday
                  ? "bg-primary-wash border-primary"
                  : "bg-surface border-outline-soft",
                day.isFuture && "opacity-50",
              )}
            >
              {day.sessions === 0 ? (
                <View className="w-[4px] h-[4px] rounded-full bg-track" />
              ) : (
                Array.from({ length: Math.min(day.sessions, 3) }, (_, dot) => (
                  <View
                    key={dot}
                    className="w-[6px] h-[6px] rounded-full bg-primary"
                  />
                ))
              )}
            </View>
            <Text
              className={cn(
                "type-mono-small tabular-nums",
                day.isToday ? "text-primary" : "text-text-muted",
              )}
            >
              {day.sessions ? day.strain.toFixed(1) : "–"}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function FeaturedCard({
  workout,
  strain,
  maxHeartRate,
}: {
  workout: Workout;
  strain: number;
  maxHeartRate: number;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const kind = workoutKind(workout);
  const sparkWidth = Math.min(120, width * 0.3);
  const stats = workoutStats(workout, kind).slice(0, 3);
  const zones = workoutZoneMinutes(workout, maxHeartRate);
  const zoneTotal = zones.reduce((a, b) => a + b, 0);
  const topZone = zoneTotal ? zones.indexOf(Math.max(...zones)) : -1;
  const trace = (workout.heartRateByMinute ?? []).filter((bpm) => bpm > 0);
  const energy =
    workout.activeEnergyKcal === null
      ? null
      : formatEnergy(workout.activeEnergyKcal);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workoutTitle(workout)}, ${formatSessionDate(workout.startedAt)}. Open details`}
      onPress={() => openWorkout(workout.id)}
      className="rounded-card border border-primary-border bg-surface-elevated-prose p-lg gap-lg active:opacity-80"
    >
      <View className="flex-row items-center gap-md">
        <WorkoutIcon kind={kind} size={44} highlighted />
        <View className="flex-1 gap-2xs">
          <Text className="type-subheading text-text" numberOfLines={1}>
            {workoutTitle(workout)}
          </Text>
          <Text className="type-mono text-text-muted">
            {formatSessionDate(workout.startedAt)}
          </Text>
        </View>
        <ChevronRight color={colors.textSubtle} size={18} />
      </View>
      <View className="flex-row justify-between">
        {stats.map((stat) => (
          <StatColumn key={stat.label} stat={stat} />
        ))}
        <View className="gap-2xs">
          <Text className="type-caption text-text-subtle">Strain</Text>
          <Text className="type-metric-lg text-stress tabular-nums text-[20px]">
            {strain.toFixed(1)}
          </Text>
        </View>
      </View>
      {trace.length > 1 ? (
        <View className="rounded-md bg-surface p-md flex-row items-center gap-md">
          <View className="flex-1 gap-2xs">
            <View className="flex-row items-center gap-xs">
              <View className="w-[6px] h-[6px] rounded-full bg-salmon" />
              <Text className="type-caption text-text" numberOfLines={1}>
                {workout.heartRate.average !== null
                  ? `Avg HR ${Math.round(workout.heartRate.average)} bpm`
                  : "Heart rate"}
                {energy ? ` · ${energy.value} ${energy.unit}` : ""}
              </Text>
            </View>
            {topZone >= 0 ? (
              <Text className="type-mono-small text-text-subtle">
                Mostly {zoneNames[topZone]!.replace("Zone ", "Z")} (
                {Math.round((zones[topZone]! / zoneTotal) * 100)}%)
              </Text>
            ) : null}
          </View>
          <View style={{ width: sparkWidth }}>
            <Sparkline
              values={trace}
              color={colors.primary}
              width={sparkWidth}
              height={36}
              fill={false}
              accessibilityLabel="Heart rate through the session"
            />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

function StatColumn({ stat }: { stat: WorkoutStat }) {
  return (
    <View className="gap-2xs">
      <Text className="type-caption text-text-subtle">{stat.label}</Text>
      <Text className="type-metric-lg text-text tabular-nums text-[20px]">
        {stat.value}
        {stat.unit ? (
          <Text className="type-mono text-text-subtle">{stat.unit}</Text>
        ) : null}
      </Text>
    </View>
  );
}

function SessionCard({
  workout,
  strain,
}: {
  workout: Workout;
  strain: number;
}) {
  const { colors } = useTheme();
  const kind = workoutKind(workout);
  const stats = workoutStats(workout, kind).slice(0, 4);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workoutTitle(workout)}, ${formatSessionDate(workout.startedAt)}, strain ${strain.toFixed(1)}. Open details`}
      onPress={() => openWorkout(workout.id)}
      className="rounded-card border border-outline-soft bg-surface-prose p-lg gap-md active:opacity-80"
    >
      <View className="flex-row items-center gap-md">
        <WorkoutIcon kind={kind} />
        <View className="flex-1 gap-2xs">
          <Text className="type-subheading text-text" numberOfLines={1}>
            {workoutTitle(workout)}
          </Text>
          <Text className="type-mono text-text-muted">
            {formatSessionDate(workout.startedAt)}
          </Text>
        </View>
        <StrainPill strain={strain} />
      </View>
      <View className="flex-row flex-wrap items-center gap-x-sm gap-y-2xs pt-md border-t-hairline border-t-outline-soft">
        {stats.map((stat, index) => (
          <View key={stat.label} className="flex-row items-center gap-sm">
            {index > 0 ? (
              <View className="w-[3px] h-[3px] rounded-full bg-text-subtle" />
            ) : null}
            <Text className="type-mono text-text tabular-nums">
              {stat.value}
              {stat.unit ? (
                <Text className="text-text-subtle"> {stat.unit}</Text>
              ) : null}
            </Text>
          </View>
        ))}
        <View className="flex-1" />
        <ChevronRight color={colors.textSubtle} size={16} />
      </View>
    </Pressable>
  );
}

function TotalsCard({ workouts }: { workouts: Workout[] }) {
  const totals = totalWorkouts(workouts);
  const distance = formatDistance(totals.distanceMeters, 1);
  const energy = formatEnergy(totals.energyKcal);
  const stats: WorkoutStat[] = [
    { label: "Sessions", value: `${totals.sessions}` },
    { label: "Time", value: formatDuration(totals.minutes) },
    ...(totals.distanceMeters > 0
      ? [{ label: "Distance", value: distance.value, unit: distance.unit }]
      : []),
    { label: "Active energy", value: energy.value, unit: energy.unit },
  ];
  return (
    <Card>
      <Text className="type-badge text-text-subtle uppercase">
        30-day total
      </Text>
      <View className="flex-row justify-between mt-md">
        {stats.map((stat) => (
          <View key={stat.label} className="gap-2xs">
            <Text className="type-caption text-text-subtle">{stat.label}</Text>
            <Text className="type-subheading text-text tabular-nums">
              {stat.value}
              {stat.unit ? (
                <Text className="type-mono text-text-subtle"> {stat.unit}</Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
