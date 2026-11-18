import { fromDayKey, shiftDayKey, toDayKey } from "@/services/journal";
import type { DailyScore } from "@/services/metrics/daily";

export type PeriodKind = "week" | "month";

/** A Monday-to-Sunday week or a calendar month; `start` and `end` are inclusive day keys. */
export type Period = { kind: PeriodKind; start: string; end: string };

export function periodContaining(kind: PeriodKind, day: string): Period {
  const date = fromDayKey(day);
  if (kind === "week") {
    const start = shiftDayKey(day, -((date.getDay() + 6) % 7));
    return { kind, start, end: shiftDayKey(start, 6) };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { kind, start: toDayKey(start), end: toDayKey(end) };
}

export function shiftPeriod(period: Period, steps: number): Period {
  if (period.kind === "week") {
    return periodContaining("week", shiftDayKey(period.start, steps * 7));
  }
  const start = fromDayKey(period.start);
  return periodContaining(
    "month",
    toDayKey(new Date(start.getFullYear(), start.getMonth() + steps, 1)),
  );
}

/** True for the period containing `today` and the one before it. */
export function isRecentPeriod(period: Period, today: string): boolean {
  const current = periodContaining(period.kind, today);
  return (
    period.start === current.start ||
    period.start === shiftPeriod(current, -1).start
  );
}

/** Day keys from the period's start to its end, or to `today` if that comes first. */
export function daysInPeriod(period: Period, today: string): string[] {
  const last = period.end < today ? period.end : today;
  const days: string[] = [];
  for (let key = period.start; key <= last; key = shiftDayKey(key, 1)) {
    days.push(key);
  }
  return days;
}

type Averages = {
  recovery: number | null;
  strain: number | null;
  sleep: number | null;
};

export type ScoreSummary = {
  /** Days with a recovery score. */
  scoredDays: number;
  averages: Averages;
  /** Change against the previous period's averages; null when either side has none. */
  deltas: Averages;
  /** Highest recovery. */
  best: DailyScore | null;
  /** Lowest recovery. */
  toughest: DailyScore | null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function averageOf(values: readonly (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  if (!present.length) return null;
  return round1(present.reduce((sum, v) => sum + v, 0) / present.length);
}

function averagesOf(days: readonly (DailyScore | null)[]): Averages {
  const scored = days.filter((d): d is DailyScore => d !== null);
  return {
    recovery: averageOf(scored.map((d) => d.recovery)),
    strain: averageOf(scored.map((d) => d.strain)),
    sleep: averageOf(scored.map((d) => d.sleepScore)),
  };
}

const delta = (now: number | null, before: number | null) =>
  now === null || before === null ? null : round1(now - before);

export function summarizeScores(
  days: readonly (DailyScore | null)[],
  previous: readonly (DailyScore | null)[],
): ScoreSummary {
  const scored = days.filter(
    (d): d is DailyScore & { recovery: number } => d !== null && d.recovery !== null,
  );
  const averages = averagesOf(days);
  const before = averagesOf(previous);
  let best: DailyScore | null = null;
  let toughest: DailyScore | null = null;
  for (const day of scored) {
    if (!best || day.recovery > (best.recovery ?? -1)) best = day;
    if (!toughest || day.recovery < (toughest.recovery ?? 101)) toughest = day;
  }
  return {
    scoredDays: scored.length,
    averages,
    deltas: {
      recovery: delta(averages.recovery, before.recovery),
      strain: delta(averages.strain, before.strain),
      sleep: delta(averages.sleep, before.sleep),
    },
    best,
    toughest,
  };
}
