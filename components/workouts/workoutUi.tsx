import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  Mountain,
  Waves,
  Zap,
} from "lucide-react-native";
import { Text, View } from "react-native";

import type { Workout } from "@/services/health/types";
import { workoutMinutes } from "@/services/metrics";
import { usesPace, type WorkoutKind } from "@/services/metrics/workouts";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import {
  distanceUnit,
  formatDayLabel,
  formatDistance,
  formatDuration,
  formatEnergy,
  formatPace,
  formatSpeed,
  formatTime,
} from "@/utils/formatters";

export function openWorkout(id: string) {
  void Haptics.selectionAsync();
  router.push({ pathname: "/workouts/[id]", params: { id } });
}

export function openWorkouts() {
  void Haptics.selectionAsync();
  router.push("/workouts");
}

const kindIcons = {
  run: Footprints,
  ride: Bike,
  strength: Dumbbell,
  walk: Mountain,
  swim: Waves,
  other: Activity,
} as const;

export function WorkoutIcon({
  kind,
  size = 40,
  highlighted = false,
}: {
  kind: WorkoutKind;
  size?: number;
  highlighted?: boolean;
}) {
  const { colors } = useTheme();
  const Icon = kindIcons[kind];
  return (
    <View
      className={cn(
        "rounded-md items-center justify-center border",
        highlighted
          ? "bg-primary-wash border-primary-border"
          : "bg-surface-high border-outline-soft",
      )}
      style={{ width: size, height: size }}
    >
      <Icon
        color={highlighted ? colors.primary : colors.textMuted}
        size={Math.round(size * 0.48)}
      />
    </View>
  );
}

export function StrainPill({ strain }: { strain: number }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-2xs px-sm py-2xs rounded-full border border-stress-border bg-stress-wash">
      <Zap color={colors.stress} size={11} />
      <Text className="type-mono text-stress tabular-nums">
        {strain.toFixed(1)}
      </Text>
    </View>
  );
}

/** "Today · 7:15 AM", "Yesterday · …" or "Tue, Nov 11 · …". */
export function formatSessionDate(startedAt: string, now = new Date()): string {
  const date = new Date(startedAt);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day =
    date.toDateString() === now.toDateString()
      ? "Today"
      : date.toDateString() === yesterday.toDateString()
        ? "Yesterday"
        : formatDayLabel(date);
  return `${day} · ${formatTime(startedAt)}`;
}

export type WorkoutStat = { label: string; value: string; unit?: string };

/** Pace per display unit for runs and walks, speed for everything else. */
export function paceOrSpeed(
  workout: Workout,
  kind: WorkoutKind,
): WorkoutStat | null {
  const meters = workout.distanceMeters ?? 0;
  const seconds = workoutMinutes(workout) * 60;
  if (meters < 100 || seconds <= 0) return null;
  if (usesPace(kind))
    return {
      label: "Avg pace",
      value: formatPace((seconds / meters) * distanceUnit.meters),
      unit: `/${distanceUnit.label}`,
    };
  const speed = formatSpeed(meters / seconds);
  return { label: "Avg speed", value: speed.value, unit: speed.unit };
}

/** The headline numbers for a workout card, most telling first. */
export function workoutStats(
  workout: Workout,
  kind: WorkoutKind,
): WorkoutStat[] {
  const stats: WorkoutStat[] = [];
  if (workout.distanceMeters && workout.distanceMeters >= 100) {
    const distance = formatDistance(workout.distanceMeters);
    stats.push({
      label: "Distance",
      value: distance.value,
      unit: distance.unit,
    });
  }
  stats.push({
    label: "Duration",
    value: formatDuration(workoutMinutes(workout)),
  });
  const pace = paceOrSpeed(workout, kind);
  if (pace) stats.push(pace);
  if (workout.heartRate.average !== null)
    stats.push({
      label: "Avg HR",
      value: `${Math.round(workout.heartRate.average)}`,
      unit: "bpm",
    });
  if (workout.activeEnergyKcal !== null) {
    const energy = formatEnergy(workout.activeEnergyKcal);
    stats.push({
      label: "Active energy",
      value: energy.value,
      unit: energy.unit,
    });
  }
  return stats;
}

/** "Outdoor run · Apple Watch" style line. */
export function workoutContext(workout: Workout): string {
  const place =
    workout.indoor === true
      ? "Indoor"
      : workout.indoor === false
        ? "Outdoor"
        : null;
  const activity = workout.activity.toLowerCase();
  return [place ? `${place} ${activity}` : workout.activity, workout.source]
    .filter(Boolean)
    .join(" · ");
}
