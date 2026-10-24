import {
  ageOn,
  breakdownByActivity,
  buildFitnessDays,
  calculateAcuteChronicRatio,
  calculateCardioFocus,
  calculateLoadChange,
  heartRateRecoveries,
  summarizeActivity,
  summarizeStrength,
  summarizeTrainingMix,
  compareWeeks,
  estimateMaxHeartRate,
  loadGauge,
  weeklyZoneMinutes,
  type AcuteChronicSummary,
  type ActivityBreakdown,
  type LoadGauge,
  type WeekComparison,
  type ZoneWeek,
  type ActivitySummary,
  type CardioFocus,
  type FitnessDay,
  type StrengthSummary,
  type TrainingMixEntry,
} from "@/services/metrics";

import type {
  HealthProfile,
  HealthProvider,
  PermissionState,
  Workout,
} from "./types";

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
  maxHeartRate: number;
  /** Whether max heart rate comes from the person's age rather than a default. */
  maxHeartRateFromAge: boolean;
  cardioGauge: LoadGauge;
  muscularGauge: LoadGauge;
  /** Daily cardio and strength load for the last 28 days, oldest first. */
  cardioLoads: number[];
  muscularLoads: number[];
  activeMinutes: WeekComparison;
  activeEnergy: WeekComparison;
  /** Activity types over the last 7 days. */
  weekActivities: ActivityBreakdown[];
  zoneWeeks: ZoneWeek[];
  /** Workouts in the visible window, newest first. */
  workouts: Workout[];
};

export async function loadFitnessData(
  provider: HealthProvider,
  permissionState: PermissionState = provider.kind === "mock"
    ? "mock"
    : "granted",
  now = new Date(),
  savedProfile: HealthProfile = { birthDate: null, sex: null },
): Promise<FitnessData> {
  // Two windows: the visible 30 days plus the 30 before, which seeds the
  // 28-day chronic load and the period-over-period comparison.
  const since = new Date(now);
  since.setDate(now.getDate() - FITNESS_WINDOW_DAYS * 2 + 1);
  since.setHours(0, 0, 0, 0);
  const [workouts, restingHeartRate, sourceProfile] = await Promise.all([
    provider.getWorkouts(since),
    provider.getRestingHR().catch(() => null),
    provider.getProfile().catch(() => null),
  ]);
  const birthDate = sourceProfile?.birthDate ?? savedProfile.birthDate;
  const age = birthDate ? ageOn(birthDate, now) : null;
  const profile = {
    restingHeartRate: restingHeartRate ?? 60,
    maxHeartRate: estimateMaxHeartRate(age),
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
    maxHeartRate: profile.maxHeartRate,
    maxHeartRateFromAge: age !== null,
    cardioGauge: loadGauge(allDays.map((day) => day.cardioLoad)),
    muscularGauge: loadGauge(allDays.map((day) => day.muscularLoad)),
    cardioLoads: allDays.slice(-28).map((day) => day.cardioLoad),
    muscularLoads: allDays.slice(-28).map((day) => day.muscularLoad),
    activeMinutes: compareWeeks(days, (day) => day.minutes),
    activeEnergy: compareWeeks(days, (day) => day.energyKcal),
    weekActivities: breakdownByActivity(
      recent.filter(
        (workout) =>
          new Date(workout.startedAt).getTime() >=
          new Date(`${days.at(-7)!.date}T00:00:00`).getTime(),
      ),
    ),
    zoneWeeks: weeklyZoneMinutes(recent, profile.maxHeartRate, now),
    workouts: [...recent].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    ),
  };
}
