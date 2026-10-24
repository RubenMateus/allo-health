import type {
  HealthSample,
  Workout,
  WorkoutCategory,
  WorkoutHeartRate,
} from "@/services/health/types";

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) =>
  values.length ? sum(values) / values.length : 0;

/** Largest-remainder rounding so whole-number shares always add up to 100. */
function percentages(values: number[]): number[] {
  const total = sum(values);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (value / total) * 100);
  const rounded = exact.map(Math.floor);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  const missing = 100 - sum(rounded);
  for (let i = 0; i < missing; i += 1) {
    rounded[order[i]!.index]! += 1;
  }
  return rounded;
}

export type HeartRateProfile = {
  restingHeartRate: number;
  maxHeartRate: number;
};

export type FitnessDay = {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  minutes: number;
  sessions: number;
  load: number;
  /** Load from cardio and mixed sessions. */
  cardioLoad: number;
  /** Load from strength sessions. */
  muscularLoad: number;
  energyKcal: number;
};

export type ActivitySummary = {
  totalMinutes: number;
  previousMinutes: number | null;
  /** Running total of minutes at the end of each day in the window. */
  cumulativeMinutes: number[];
};

export type AcuteChronicSummary = {
  acute: number;
  chronic: number;
  ratio: number | null;
  status: "LOW" | "OPTIMAL" | "HIGH" | "SPIKE" | "NO DATA";
  /** Ratio at the end of each of the most recent days, oldest first. */
  trend: number[];
};

export type CardioFocus = {
  aerobic: number;
  threshold: number;
  anaerobic: number;
};

export type StrengthSummary = {
  sessions: number;
  minutes: number;
  activeEnergyKcal: number | null;
  averageHeartRate: number | null;
  /** Strength sessions per rolling week, oldest first. */
  weekly: number[];
};

export type TrainingMixEntry = {
  category: WorkoutCategory;
  minutes: number;
  share: number;
};

export function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function workoutMinutes(workout: Workout): number {
  return Math.max(
    0,
    (new Date(workout.endedAt).getTime() -
      new Date(workout.startedAt).getTime()) /
      60_000,
  );
}

function reserveFraction(heartRate: number, profile: HeartRateProfile) {
  return clamp(
    (heartRate - profile.restingHeartRate) /
      Math.max(profile.maxHeartRate - profile.restingHeartRate, 1),
    0,
    1,
  );
}

export function calculateTrainingLoad(
  workout: Workout,
  profile: HeartRateProfile,
): number {
  const minutes = workoutMinutes(workout);
  if (workout.heartRate.average === null) {
    // Without heart rate, assume a moderate session (TRIMP at ~60% of reserve).
    return Math.round(minutes * 1.09 * 10) / 10;
  }
  const fraction = reserveFraction(workout.heartRate.average, profile);
  // Banister TRIMP: minutes weighted exponentially by heart-rate-reserve fraction.
  return (
    Math.round(minutes * fraction * 0.64 * Math.exp(1.92 * fraction) * 10) / 10
  );
}

/** Buckets workouts into `days` local calendar days ending on `end`, oldest first. */
export function buildFitnessDays(
  workouts: Workout[],
  profile: HeartRateProfile,
  end: Date,
  days: number,
): FitnessDay[] {
  const buckets = new Map<string, FitnessDay>();
  const result: FitnessDay[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    const day = {
      date: dayKey(date),
      minutes: 0,
      sessions: 0,
      load: 0,
      cardioLoad: 0,
      muscularLoad: 0,
      energyKcal: 0,
    };
    buckets.set(day.date, day);
    result.push(day);
  }
  for (const workout of workouts) {
    const day = buckets.get(dayKey(new Date(workout.startedAt)));
    if (!day) continue;
    day.minutes += workoutMinutes(workout);
    day.sessions += 1;
    const load = calculateTrainingLoad(workout, profile);
    day.load += load;
    if (workout.category === "strength") day.muscularLoad += load;
    else day.cardioLoad += load;
    day.energyKcal += workout.activeEnergyKcal ?? 0;
  }
  return result;
}

export function summarizeActivity(
  current: FitnessDay[],
  previous: FitnessDay[],
): ActivitySummary {
  let running = 0;
  const cumulativeMinutes = current.map((day) => (running += day.minutes));
  const previousSessions = sum(previous.map((day) => day.sessions));
  return {
    totalMinutes: Math.round(running),
    previousMinutes: previousSessions
      ? Math.round(sum(previous.map((day) => day.minutes)))
      : null,
    cumulativeMinutes,
  };
}

export function acwrStatus(
  ratio: number | null,
): AcuteChronicSummary["status"] {
  if (ratio === null) return "NO DATA";
  // Common sports-science bands: 0.8–1.3 is the "sweet spot", >1.5 a load spike.
  return ratio < 0.8
    ? "LOW"
    : ratio <= 1.3
      ? "OPTIMAL"
      : ratio <= 1.5
        ? "HIGH"
        : "SPIKE";
}

/** Acute (7-day) to chronic (28-day) workload ratio from daily loads, oldest first. */
export function calculateAcuteChronicRatio(
  dailyLoads: number[],
  trendDays = 14,
): AcuteChronicSummary {
  const ratioAt = (endIndex: number) => {
    const chronicWindow = dailyLoads.slice(
      Math.max(0, endIndex - 27),
      endIndex + 1,
    );
    const chronic = mean(chronicWindow) * (chronicWindow.length / 28);
    const acute = mean(
      dailyLoads.slice(Math.max(0, endIndex - 6), endIndex + 1),
    );
    return { acute, chronic, ratio: chronic > 0 ? acute / chronic : null };
  };
  const last = ratioAt(dailyLoads.length - 1);
  const trend: number[] = [];
  for (
    let index = Math.max(0, dailyLoads.length - trendDays);
    index < dailyLoads.length;
    index += 1
  ) {
    const point = ratioAt(index).ratio;
    if (point !== null) trend.push(Math.round(point * 100) / 100);
  }
  const ratio = last.ratio === null ? null : Math.round(last.ratio * 100) / 100;
  return {
    acute: Math.round(last.acute * 10) / 10,
    chronic: Math.round(last.chronic * 10) / 10,
    ratio,
    status: acwrStatus(ratio),
    trend,
  };
}

/** Percent change in training load between the second and first half of the window. */
export function calculateLoadChange(dailyLoads: number[]): number | null {
  const half = Math.floor(dailyLoads.length / 2);
  const earlier = sum(dailyLoads.slice(0, half));
  const later = sum(dailyLoads.slice(dailyLoads.length - half));
  if (earlier <= 0) return null;
  return Math.round(((later - earlier) / earlier) * 100);
}

/** Splits cardio minutes into intensity zones by each session's average heart rate. */
export function calculateCardioFocus(
  workouts: Workout[],
  profile: HeartRateProfile,
): CardioFocus | null {
  const minutes = { aerobic: 0, threshold: 0, anaerobic: 0 };
  for (const workout of workouts) {
    if (workout.category === "strength" || workout.heartRate.average === null)
      continue;
    const fraction = reserveFraction(workout.heartRate.average, profile);
    // Zones by heart-rate reserve: <70% aerobic base, 70–85% threshold, ≥85% anaerobic.
    const zone =
      fraction >= 0.85
        ? "anaerobic"
        : fraction >= 0.7
          ? "threshold"
          : "aerobic";
    minutes[zone] += workoutMinutes(workout);
  }
  const total = minutes.aerobic + minutes.threshold + minutes.anaerobic;
  if (total <= 0) return null;
  const rounded = percentages([
    minutes.aerobic,
    minutes.threshold,
    minutes.anaerobic,
  ]);
  return {
    aerobic: rounded[0]!,
    threshold: rounded[1]!,
    anaerobic: rounded[2]!,
  };
}

/** Derives average, end-of-effort and one-minute-recovery heart rate for a workout. */
export function summarizeWorkoutHeartRate(
  samples: HealthSample[],
  startedAt: string,
  endedAt: string,
): WorkoutHeartRate {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const timed = samples.map((sample) => ({
    value: sample.value,
    time: new Date(sample.timestamp).getTime(),
  }));
  const during = timed.filter(
    (sample) => sample.time >= start && sample.time <= end,
  );
  const finalMinute = during.filter((sample) => sample.time >= end - 60_000);
  const peak = finalMinute.length
    ? Math.max(...finalMinute.map((sample) => sample.value))
    : null;
  const after = timed
    .filter((sample) => sample.time > end && sample.time <= end + 120_000)
    .sort(
      (a, b) =>
        Math.abs(a.time - end - 60_000) - Math.abs(b.time - end - 60_000),
    );
  return {
    average: during.length
      ? Math.round(mean(during.map((sample) => sample.value)))
      : null,
    peak,
    recovery: peak === null ? null : (after[0]?.value ?? null),
  };
}

/** Averages heart-rate samples into one value per minute of the workout (0 = no reading). */
export function heartRateByMinute(
  samples: HealthSample[],
  startedAt: string,
  endedAt: string,
): number[] {
  const start = new Date(startedAt).getTime();
  const minutes = Math.ceil((new Date(endedAt).getTime() - start) / 60_000);
  if (minutes <= 0) return [];
  const totals = Array.from({ length: minutes }, () => ({ sum: 0, count: 0 }));
  for (const sample of samples) {
    const index = Math.floor(
      (new Date(sample.timestamp).getTime() - start) / 60_000,
    );
    if (index < 0 || index >= minutes) continue;
    totals[index]!.sum += sample.value;
    totals[index]!.count += 1;
  }
  return totals.map(({ sum: total, count }) =>
    count ? Math.round(total / count) : 0,
  );
}

/** One-minute heart-rate recovery (bpm drop) for each workout that has it, oldest first. */
export function heartRateRecoveries(workouts: Workout[]): number[] {
  return [...workouts]
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
    .flatMap(({ heartRate }) =>
      heartRate.peak !== null && heartRate.recovery !== null
        ? [Math.max(0, Math.round(heartRate.peak - heartRate.recovery))]
        : [],
    );
}

export function heartRateRecoveryRating(bpm: number): string {
  // One-minute HRR under 12 bpm is a recognised clinical warning sign.
  return bpm >= 40
    ? "Excellent"
    : bpm >= 25
      ? "Good"
      : bpm >= 12
        ? "Fair"
        : "Low";
}

export function summarizeStrength(
  workouts: Workout[],
  end: Date,
  weeks = 4,
): StrengthSummary {
  const strength = workouts.filter(
    (workout) => workout.category === "strength",
  );
  const weekly = Array.from({ length: weeks }, () => 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  for (const workout of strength) {
    // Rolling 7-day weeks ending today, oldest first.
    const weeksAgo = Math.floor(
      (endDay.getTime() - new Date(workout.startedAt).getTime()) /
        (7 * 86_400_000),
    );
    if (weeksAgo >= 0 && weeksAgo < weeks) weekly[weeks - 1 - weeksAgo]! += 1;
  }
  const energy = strength.flatMap((workout) =>
    workout.activeEnergyKcal === null ? [] : [workout.activeEnergyKcal],
  );
  const heartRates = strength.flatMap((workout) =>
    workout.heartRate.average === null ? [] : [workout.heartRate.average],
  );
  return {
    sessions: strength.length,
    minutes: Math.round(sum(strength.map(workoutMinutes))),
    activeEnergyKcal: energy.length ? Math.round(sum(energy)) : null,
    averageHeartRate: heartRates.length ? Math.round(mean(heartRates)) : null,
    weekly,
  };
}

/** Share of training minutes per workout category, adding up to 100. */
export function summarizeTrainingMix(workouts: Workout[]): TrainingMixEntry[] {
  const categories: WorkoutCategory[] = ["cardio", "strength", "mixed"];
  const minutes = categories.map((category) =>
    sum(
      workouts
        .filter((workout) => workout.category === category)
        .map(workoutMinutes),
    ),
  );
  const shares = percentages(minutes);
  return categories
    .map((category, index) => ({
      category,
      minutes: Math.round(minutes[index]!),
      share: shares[index]!,
    }))
    .filter((entry) => entry.minutes > 0);
}
