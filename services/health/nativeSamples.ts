import type { HealthSample, StressSample, Workout } from "./types";

/** Minutes each strain or stress point stands for; the scores assume this spacing. */
export const SAMPLE_BUCKET_MINUTES = 5;
/** HRV used for a stress point when no HRV reading exists, so it neither adds nor removes load. */
export const NEUTRAL_HRV_MS = 48;
/** How far back a "latest" resting heart rate or respiratory rate may be. */
export const LATEST_READING_DAYS = 7;

const minute = 60_000;

/**
 * Averages heart-rate samples into fixed buckets, oldest first. Watches write a
 * sample every few seconds during workouts and every few minutes at rest, so raw
 * samples can't each count as five minutes. Buckets with no reading are skipped.
 */
export function bucketSamples(
  samples: HealthSample[],
  start: Date,
  end: Date,
  bucketMinutes = SAMPLE_BUCKET_MINUTES,
): HealthSample[] {
  const size = bucketMinutes * minute;
  const from = start.getTime();
  const to = end.getTime();
  const buckets = new Map<number, { total: number; count: number }>();
  for (const sample of samples) {
    const time = new Date(sample.timestamp).getTime();
    if (time < from || time > to) continue;
    const index = Math.floor((time - from) / size);
    const bucket = buckets.get(index) ?? { total: 0, count: 0 };
    bucket.total += sample.value;
    bucket.count += 1;
    buckets.set(index, bucket);
  }
  const unit = samples[0]?.unit ?? "";
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, { total, count }]) => ({
      value: total / count,
      unit,
      // Stamp each bucket at its end, like a sample's end date.
      timestamp: new Date(
        Math.min(from + (index + 1) * size, to),
      ).toISOString(),
    }));
}

/**
 * Pairs the latest heart-rate buckets with the HRV reading nearest in time.
 * HRV is sparse (a few readings a day), so pairing by array index was meaningless.
 */
export function buildStressSamples(
  heartRate: HealthSample[],
  hrv: HealthSample[],
  now: Date,
  count = 48,
): StressSample[] {
  const buckets = bucketSamples(
    heartRate,
    new Date(now.getTime() - 24 * 60 * minute),
    now,
  ).slice(-count);
  const hrvTimes = hrv.map((sample) => ({
    value: sample.value,
    time: new Date(sample.timestamp).getTime(),
  }));
  return buckets.map((bucket) => {
    const time = new Date(bucket.timestamp).getTime();
    let nearest: number | null = null;
    let distance = Infinity;
    for (const sample of hrvTimes) {
      const gap = Math.abs(sample.time - time);
      if (gap < distance) {
        distance = gap;
        nearest = sample.value;
      }
    }
    return {
      timestamp: bucket.timestamp,
      heartRate: Math.round(bucket.value),
      hrv: nearest ?? NEUTRAL_HRV_MS,
    };
  });
}

type Interval = { start: number; end: number };

/** Total minutes covered by intervals, counting overlaps once. */
export function unionMinutes(intervals: Interval[]): number {
  const sorted = [...intervals]
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let current: Interval | null = null;
  for (const interval of sorted) {
    if (current && interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
      continue;
    }
    if (current) total += current.end - current.start;
    current = { ...interval };
  }
  if (current) total += current.end - current.start;
  return total / minute;
}

/** Splits intervals into sessions wherever there's a gap longer than `gapMinutes`. */
export function clusterIntervals<T extends Interval>(
  intervals: T[],
  gapMinutes = 120,
): T[][] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const clusters: T[][] = [];
  let end = -Infinity;
  for (const interval of sorted) {
    if (interval.start - end > gapMinutes * minute) clusters.push([]);
    clusters.at(-1)!.push(interval);
    end = Math.max(end, interval.end);
  }
  return clusters;
}

/**
 * Picks last night's sleep from candidate sessions: the latest one that ended in
 * the past 24 hours and holds at least three hours of sleep, else the longest one.
 * A 36-hour read window otherwise catches two nights in the morning, or a nap.
 */
export function pickMainSleep<T extends { end: number; asleepMinutes: number }>(
  sessions: T[],
  now: Date,
): T | null {
  const recent = sessions.filter(
    (session) =>
      session.end <= now.getTime() &&
      session.end >= now.getTime() - 24 * 60 * minute &&
      session.asleepMinutes > 0,
  );
  const main = recent
    .filter((session) => session.asleepMinutes >= 180)
    .sort((a, b) => b.end - a.end)[0];
  return (
    main ??
    [...recent].sort((a, b) => b.asleepMinutes - a.asleepMinutes)[0] ??
    null
  );
}

/**
 * Drops a workout that another source also recorded (for example a watch workout
 * that Strava or Garmin wrote again). Two workouts are the same when they overlap
 * by more than half of the shorter one; the one with heart rate, then the longer
 * one, is kept.
 */
export function dedupeWorkouts(workouts: Workout[]): Workout[] {
  const span = (workout: Workout) => ({
    start: new Date(workout.startedAt).getTime(),
    end: new Date(workout.endedAt).getTime(),
  });
  const rank = (workout: Workout) => {
    const { start, end } = span(workout);
    return (workout.heartRate.average === null ? 0 : 1e12) + (end - start);
  };
  const kept: Workout[] = [];
  for (const workout of [...workouts].sort((a, b) => rank(b) - rank(a))) {
    const { start, end } = span(workout);
    const duplicate = kept.some((other) => {
      const range = span(other);
      const overlap = Math.min(end, range.end) - Math.max(start, range.start);
      const shorter = Math.min(end - start, range.end - range.start);
      return overlap > 0 && overlap > shorter / 2;
    });
    if (!duplicate) kept.push(workout);
  }
  return kept.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
