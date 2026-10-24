import {
  buildFitnessDays,
  calculateAcuteChronicRatio,
  calculateCardioFocus,
  calculateLoadChange,
  heartRateRecoveries,
  summarizeActivity,
  summarizeStrength,
  summarizeTrainingMix,
  type AcuteChronicSummary,
  type ActivitySummary,
  type CardioFocus,
  type FitnessDay,
  type StrengthSummary,
  type TrainingMixEntry,
} from "@/services/metrics";

import type { HealthProvider, PermissionState } from "./types";

export const FITNESS_WINDOW_DAYS = 30;

export type FitnessData = {
  source: HealthProvider["kind"];
  permissionState: PermissionState;
  rangeStart: string;
  rangeEnd: string;
  days: FitnessDay[];
  activity: ActivitySummary;
  cardioLoad: AcuteChronicSummary;
  loadChange: number | null;
  dailyLoads: number[];
  cardioFocus: CardioFocus | null;
  heartRateRecovery: number[];
  strength: StrengthSummary;
  trainingMix: TrainingMixEntry[];
  workoutCount: number;
};

export async function loadFitnessData(
  provider: HealthProvider,
  permissionState: PermissionState = provider.kind === "mock"
    ? "mock"
    : "granted",
  now = new Date(),
): Promise<FitnessData> {
  // Two windows: the visible 30 days plus the 30 before, which seeds the
  // 28-day chronic load and the period-over-period comparison.
  const since = new Date(now);
  since.setDate(now.getDate() - FITNESS_WINDOW_DAYS * 2 + 1);
  since.setHours(0, 0, 0, 0);
  const [workouts, restingHeartRate] = await Promise.all([
    provider.getWorkouts(since),
    provider.getRestingHR().catch(() => null),
  ]);
  const profile = {
    restingHeartRate: restingHeartRate ?? 60,
    maxHeartRate: 190,
  };
  const allDays = buildFitnessDays(
    workouts,
    profile,
    now,
    FITNESS_WINDOW_DAYS * 2,
  );
  const previous = allDays.slice(0, FITNESS_WINDOW_DAYS);
  const days = allDays.slice(FITNESS_WINDOW_DAYS);
  const windowStart = new Date(`${days[0]!.date}T00:00:00`).getTime();
  const recent = workouts.filter(
    (workout) => new Date(workout.startedAt).getTime() >= windowStart,
  );
  const dailyLoads = days.map((day) => day.load);

  return {
    source: provider.kind,
    permissionState,
    rangeStart: days[0]!.date,
    rangeEnd: days.at(-1)!.date,
    days,
    activity: summarizeActivity(days, previous),
    cardioLoad: calculateAcuteChronicRatio(allDays.map((day) => day.load)),
    loadChange: calculateLoadChange(dailyLoads),
    dailyLoads,
    cardioFocus: calculateCardioFocus(recent, profile),
    heartRateRecovery: heartRateRecoveries(recent).slice(-10),
    strength: summarizeStrength(recent, now),
    trainingMix: summarizeTrainingMix(recent),
    workoutCount: recent.length,
  };
}
