import type { DistanceSample, Workout } from "@/services/health/types";

import { calculateStrainScore } from "./index";
import { dayKey, workoutMinutes, type HeartRateProfile } from "./fitness";

export type WorkoutKind =
  | "run"
  | "ride"
  | "strength"
  | "walk"
  | "swim"
  | "other";

/** Filter order and labels for the workouts list. */
export const workoutKinds: { kind: WorkoutKind; label: string }[] = [
  { kind: "run", label: "Runs" },
  { kind: "strength", label: "Strength" },
  { kind: "ride", label: "Cycling" },
  { kind: "walk", label: "Walks & hikes" },
  { kind: "swim", label: "Swims" },
  { kind: "other", label: "Other" },
];

export function workoutKind(workout: Workout): WorkoutKind {
  if (workout.category === "strength") return "strength";
  const label = workout.activity.toLowerCase();
  if (/\brun|jog|treadmill/.test(label)) return "run";
  if (/ride|cycl|bik|spin/.test(label)) return "ride";
  if (/walk|hike/.test(label)) return "walk";
  if (/swim/.test(label)) return "swim";
  return "other";
}

/** Whether pace (time per distance) suits the activity better than speed. */
export function usesPace(kind: WorkoutKind): boolean {
  return kind === "run" || kind === "walk";
}

// The activity labels the providers fall back to. A workout whose activity is one
// of these gets a time-of-day name ("Morning run"); a name the user gave is kept.
const genericActivities = new Set(
  [
    "Calisthenics",
    "Cooldown",
    "Core",
    "Cross training",
    "Elliptical",
    "Flexibility",
    "Hike",
    "Intervals",
    "Long run",
    "Mind & body",
    "Mixed cardio",
    "Mobility",
    "Pilates",
    "Recovery",
    "Ride",
    "Row",
    "Run",
    "Stairs",
    "Strength",
    "Swim",
    "Walk",
    "Workout",
    "Yoga",
  ].map((label) => label.toLowerCase()),
);

export function partOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 22) return "Evening";
  return "Night";
}

/** "Morning run" for a generic workout, or the name the recording app gave it. */
export function workoutTitle(workout: Workout): string {
  if (!genericActivities.has(workout.activity.toLowerCase()))
    return workout.activity;
  return `${partOfDay(new Date(workout.startedAt))} ${workout.activity.toLowerCase()}`;
}

/**
 * Strain for one workout on the same 0–21 scale as the daily strain: weighted
 * heart-rate-zone minutes plus a small active-energy share.
 */
export function workoutStrain(
  workout: Workout,
  profile: HeartRateProfile,
): number {
  const trace = (workout.heartRateByMinute ?? []).filter((bpm) => bpm > 0);
  const samples = trace.length
    ? trace.map((bpm) => ({ value: bpm, sampleMinutes: 1 }))
    : workout.heartRate.average !== null
      ? [
          {
            value: workout.heartRate.average,
            sampleMinutes: workoutMinutes(workout),
          },
        ]
      : [];
  return calculateStrainScore({
    heartRateSamples: samples.map((sample) => ({
      ...sample,
      unit: "bpm",
      timestamp: workout.startedAt,
    })),
    activeEnergyKcal: workout.activeEnergyKcal ?? 0,
    restingHeartRate: profile.restingHeartRate,
    maxHeartRate: profile.maxHeartRate,
  });
}

export type WorkoutSplit = {
  /** 1-based split number. */
  index: number;
  meters: number;
  seconds: number;
  /** Average heart rate over the split, from the per-minute trace. */
  heartRate: number | null;
  /** False for the last, shorter-than-a-split stretch. */
  complete: boolean;
};

/**
 * Splits a workout into fixed distances (1 km by default) from its distance
 * samples. Each sample is assumed to cover its distance at an even pace, so the
 * moment a boundary is crossed is interpolated inside the sample. Elapsed time
 * counts, including pauses, as on a watch's auto-lap.
 */
export function buildSplits(
  samples: DistanceSample[],
  startedAt: string,
  heartRateByMinute: number[] = [],
  splitMeters = 1000,
): WorkoutSplit[] {
  const workoutStart = new Date(startedAt).getTime();
  const sorted = [...samples]
    .map((sample) => ({
      start: new Date(sample.startedAt).getTime(),
      end: new Date(sample.endedAt).getTime(),
      meters: sample.meters,
    }))
    .filter((sample) => sample.meters > 0 && sample.end >= sample.start)
    .sort((a, b) => a.start - b.start);
  const bounds: { start: number; end: number; meters: number }[] = [];
  let covered = 0;
  let boundary = splitMeters;
  let splitStart = workoutStart;
  let lastEnd = workoutStart;
  for (const sample of sorted) {
    let segmentStart = sample.start;
    let segmentMeters = sample.meters;
    let segmentDuration = sample.end - sample.start;
    while (covered + segmentMeters >= boundary) {
      const needed = boundary - covered;
      const crossing =
        segmentStart + segmentDuration * (needed / segmentMeters);
      bounds.push({ start: splitStart, end: crossing, meters: splitMeters });
      segmentDuration -= crossing - segmentStart;
      segmentMeters -= needed;
      segmentStart = crossing;
      splitStart = crossing;
      covered = boundary;
      boundary += splitMeters;
    }
    covered += segmentMeters;
    lastEnd = Math.max(lastEnd, sample.end);
  }
  const remainder = covered - (boundary - splitMeters);
  // Ignore a final stretch too short to give a meaningful pace.
  if (remainder >= splitMeters * 0.05)
    bounds.push({ start: splitStart, end: lastEnd, meters: remainder });

  return bounds.map((bound, index) => {
    const from = Math.max(0, Math.floor((bound.start - workoutStart) / 60_000));
    const to = Math.max(
      from + 1,
      Math.ceil((bound.end - workoutStart) / 60_000),
    );
    const readings = heartRateByMinute.slice(from, to).filter((bpm) => bpm > 0);
    return {
      index: index + 1,
      meters: Math.round(bound.meters),
      seconds: Math.round((bound.end - bound.start) / 1000),
      heartRate: readings.length
        ? Math.round(readings.reduce((a, b) => a + b, 0) / readings.length)
        : null,
      complete: bound.meters === splitMeters,
    };
  });
}

/** Seconds per split distance, scaling a short final split up to a full one. */
export function splitPace(split: WorkoutSplit, splitMeters = 1000): number {
  return split.meters > 0 ? (split.seconds / split.meters) * splitMeters : 0;
}

export type TrainingWeekDay = {
  date: string;
  sessions: number;
  strain: number;
  isToday: boolean;
  isFuture: boolean;
};

export type TrainingWeek = {
  days: TrainingWeekDay[];
  sessions: number;
  minutes: number;
  strain: number;
};

/** Monday-to-Sunday totals for the week containing `now`. */
export function trainingWeek(
  workouts: Workout[],
  profile: HeartRateProfile,
  now: Date,
): TrainingWeek {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const today = dayKey(now);
  const days: TrainingWeekDay[] = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    const key = dayKey(date);
    return {
      date: key,
      sessions: 0,
      strain: 0,
      isToday: key === today,
      isFuture: key > today,
    };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  let minutes = 0;
  for (const workout of workouts) {
    const day = byDate.get(dayKey(new Date(workout.startedAt)));
    if (!day) continue;
    day.sessions += 1;
    day.strain = round1(day.strain + workoutStrain(workout, profile));
    minutes += workoutMinutes(workout);
  }
  return {
    days,
    sessions: days.reduce((total, day) => total + day.sessions, 0),
    minutes,
    strain: round1(days.reduce((total, day) => total + day.strain, 0)),
  };
}

export type WorkoutTotals = {
  sessions: number;
  minutes: number;
  distanceMeters: number;
  energyKcal: number;
};

export function totalWorkouts(workouts: Workout[]): WorkoutTotals {
  return workouts.reduce<WorkoutTotals>(
    (totals, workout) => ({
      sessions: totals.sessions + 1,
      minutes: totals.minutes + workoutMinutes(workout),
      distanceMeters: totals.distanceMeters + (workout.distanceMeters ?? 0),
      energyKcal: totals.energyKcal + (workout.activeEnergyKcal ?? 0),
    }),
    { sessions: 0, minutes: 0, distanceMeters: 0, energyKcal: 0 },
  );
}

/** Highest per-minute heart rate, falling back to the end-of-effort peak. */
export function workoutMaxHeartRate(workout: Workout): number | null {
  const trace = workout.heartRateByMinute ?? [];
  const max = trace.length ? Math.max(...trace) : 0;
  return max > 0 ? max : workout.heartRate.peak;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
