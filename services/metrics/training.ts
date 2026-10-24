import type { Workout } from "@/services/health/types";

import { dayKey, workoutMinutes, type FitnessDay } from "./fitness";

const DAY_MS = 86_400_000;
const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

export type LoadGauge = {
  /** Training load over the last 7 days. */
  value: number;
  /** The 7-day load that keeps the acute:chronic ratio between 0.8 and 1.3. */
  optimal: readonly [number, number] | null;
  /** Average weekly load over the last 28 days. */
  chronicWeekly: number;
  status: "BUILDING" | "BELOW" | "OPTIMAL" | "ABOVE" | "NO DATA";
};

/** A 7-day load against the range its own 28-day history can absorb. */
export function loadGauge(dailyLoads: number[]): LoadGauge {
  const value = sum(dailyLoads.slice(-7));
  const chronicWindow = dailyLoads.slice(-28);
  const chronicWeekly = (sum(chronicWindow) / 28) * 7;
  const round = (n: number) => Math.round(n * 10) / 10;
  if (chronicWeekly <= 0)
    return {
      value: round(value),
      optimal: null,
      chronicWeekly: 0,
      status: value > 0 ? "BUILDING" : "NO DATA",
    };
  const optimal = [
    round(chronicWeekly * 0.8),
    round(chronicWeekly * 1.3),
  ] as const;
  return {
    value: round(value),
    optimal,
    chronicWeekly: round(chronicWeekly),
    status:
      value < optimal[0] ? "BELOW" : value > optimal[1] ? "ABOVE" : "OPTIMAL",
  };
}

export type WeekComparison = {
  /** Running total at the end of each of the last 7 days, oldest first. */
  current: number[];
  /** The same for the 7 days before. */
  previous: number[];
  total: number;
  previousTotal: number;
};

/** This week against last week, as running totals of a per-day value. */
export function compareWeeks(
  days: FitnessDay[],
  pick: (day: FitnessDay) => number,
) {
  const running = (slice: FitnessDay[]) => {
    let total = 0;
    return slice.map((day) => (total += pick(day)));
  };
  const current = running(days.slice(-7));
  const previous = running(days.slice(-14, -7));
  return {
    current,
    previous,
    total: current.at(-1) ?? 0,
    previousTotal: previous.at(-1) ?? 0,
  } satisfies WeekComparison;
}

export type ActivityBreakdown = {
  activity: string;
  sessions: number;
  minutes: number;
  energyKcal: number;
};

/** Minutes and energy per activity type, largest first. */
export function breakdownByActivity(workouts: Workout[]): ActivityBreakdown[] {
  const groups = new Map<string, ActivityBreakdown>();
  for (const workout of workouts) {
    const group = groups.get(workout.activity) ?? {
      activity: workout.activity,
      sessions: 0,
      minutes: 0,
      energyKcal: 0,
    };
    group.sessions += 1;
    group.minutes += workoutMinutes(workout);
    group.energyKcal += workout.activeEnergyKcal ?? 0;
    groups.set(workout.activity, group);
  }
  return [...groups.values()].sort((a, b) => b.minutes - a.minutes);
}

/** Tanaka et al. (2001): 208 − 0.7 × age, the most accurate simple estimate. */
export function estimateMaxHeartRate(age: number | null): number {
  return age === null ? 190 : Math.round(208 - 0.7 * age);
}

/** Lower bound of zones 1–5 as a fraction of max heart rate. */
export const ZONE_FLOORS = [0.5, 0.6, 0.7, 0.8, 0.9] as const;

/** Zone 1–5 for a heart rate, or 0 below zone 1. */
export function heartRateZone(bpm: number, maxHeartRate: number): number {
  const fraction = bpm / maxHeartRate;
  let zone = 0;
  ZONE_FLOORS.forEach((floor, index) => {
    if (fraction >= floor) zone = index + 1;
  });
  return zone;
}

/** Minutes in zones 1–5 for one workout, from its per-minute heart rate. */
export function workoutZoneMinutes(
  workout: Workout,
  maxHeartRate: number,
): number[] {
  const zones = [0, 0, 0, 0, 0];
  const trace = workout.heartRateByMinute ?? [];
  if (trace.some((bpm) => bpm > 0)) {
    for (const bpm of trace) {
      const zone = heartRateZone(bpm, maxHeartRate);
      if (zone > 0) zones[zone - 1]! += 1;
    }
  } else if (workout.heartRate.average !== null) {
    // No minute-by-minute data: count the whole session in its average's zone.
    const zone = heartRateZone(workout.heartRate.average, maxHeartRate);
    if (zone > 0) zones[zone - 1]! += Math.round(workoutMinutes(workout));
  }
  return zones;
}

export type ZoneWeek = {
  /** First local day of the week, YYYY-MM-DD. */
  start: string;
  minutes: number[];
};

/** Zone minutes per rolling 7-day week ending on `end`, oldest first. */
export function weeklyZoneMinutes(
  workouts: Workout[],
  maxHeartRate: number,
  end: Date,
  weeks = 4,
): ZoneWeek[] {
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  const result = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(endDay.getTime() - (weeks - index) * 7 * DAY_MS + 1);
    return { start: dayKey(start), minutes: [0, 0, 0, 0, 0] };
  });
  for (const workout of workouts) {
    const weeksAgo = Math.floor(
      (endDay.getTime() - new Date(workout.startedAt).getTime()) / (7 * DAY_MS),
    );
    if (weeksAgo < 0 || weeksAgo >= weeks) continue;
    const week = result[weeks - 1 - weeksAgo]!;
    workoutZoneMinutes(workout, maxHeartRate).forEach((minutes, zone) => {
      week.minutes[zone]! += minutes;
    });
  }
  return result;
}
