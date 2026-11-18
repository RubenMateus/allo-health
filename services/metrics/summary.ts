import type { Workout, WorkoutCategory } from "@/services/health/types";
import { fromDayKey, shiftDayKey, tagLabels, toDayKey } from "@/services/journal";
import type { JournalEntry, JournalTag } from "@/services/journal/types";
import type { DailyScore } from "@/services/metrics/daily";
import { loadBalance, loadBalanceRules } from "@/services/metrics/loadBalance";

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

const inPeriod = (day: string, period: Period) =>
  day >= period.start && day <= period.end;

export type WorkoutTotals = {
  count: number;
  minutes: number;
  activeEnergyKcal: number;
  byCategory: Record<WorkoutCategory, number>;
};

/** Workouts whose start falls on a local day inside the period. */
export function summarizeWorkouts(
  workouts: readonly Workout[],
  period: Period,
): WorkoutTotals {
  const totals: WorkoutTotals = {
    count: 0,
    minutes: 0,
    activeEnergyKcal: 0,
    byCategory: { cardio: 0, strength: 0, mixed: 0 },
  };
  for (const workout of workouts) {
    const start = new Date(workout.startedAt);
    if (!inPeriod(toDayKey(start), period)) continue;
    totals.count += 1;
    totals.minutes += Math.max(
      0,
      Math.round((new Date(workout.endedAt).getTime() - start.getTime()) / 60_000),
    );
    totals.activeEnergyKcal += Math.round(workout.activeEnergyKcal ?? 0);
    totals.byCategory[workout.category] += 1;
  }
  return totals;
}

export type JournalSummary = {
  loggedDays: number;
  averageMood: number | null;
  averageEnergy: number | null;
  /** Up to three tags, most days first. */
  topTags: { tag: JournalTag; days: number }[];
};

function tagCounts(entries: readonly JournalEntry[]): Map<JournalTag, number> {
  const counts = new Map<JournalTag, number>();
  for (const entry of entries) {
    for (const tag of new Set(entry.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

export function summarizeJournal(
  entries: readonly JournalEntry[],
  period: Period,
): JournalSummary {
  const inside = entries.filter((entry) => inPeriod(entry.date, period));
  const topTags = [...tagCounts(inside)]
    .map(([tag, days]) => ({ tag, days }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 3);
  return {
    loggedDays: inside.length,
    averageMood: averageOf(inside.map((e) => e.mood)),
    averageEnergy: averageOf(inside.map((e) => e.energy)),
    topTags,
  };
}

export type TagEffect = {
  tag: JournalTag;
  /** Tagged days whose next day is inside the period and has a recovery score. */
  days: number;
  /** Next-day recovery average minus the period's recovery average; negative is lower. */
  recoveryDifference: number;
};

export const summaryRules = {
  sleepAverageBelow: 70,
  poorNightBelow: 55,
  poorNightsForSuggestion: 2,
  tagMinDays: 2,
  tagDifferenceAtLeast: 10,
  recoveryDropAtLeast: 5,
  maxSuggestions: 3,
} as const;

export function tagEffects(
  entries: readonly JournalEntry[],
  scoresByDay: Record<string, DailyScore | null>,
  period: Period,
): TagEffect[] {
  const periodAverage = averageOf(
    Object.entries(scoresByDay)
      .filter(([day]) => inPeriod(day, period))
      .map(([, score]) => score?.recovery),
  );
  if (periodAverage === null) return [];
  const nextDay = new Map<JournalTag, number[]>();
  for (const entry of entries) {
    if (!inPeriod(entry.date, period)) continue;
    const next = shiftDayKey(entry.date, 1);
    const recovery = inPeriod(next, period) ? scoresByDay[next]?.recovery : null;
    if (recovery === null || recovery === undefined) continue;
    for (const tag of new Set(entry.tags)) {
      nextDay.set(tag, [...(nextDay.get(tag) ?? []), recovery]);
    }
  }
  return [...nextDay]
    .filter(([, values]) => values.length >= summaryRules.tagMinDays)
    .map(([tag, values]) => ({
      tag,
      days: values.length,
      recoveryDifference: round1((averageOf(values) ?? 0) - periodAverage),
    }))
    .sort((a, b) => a.recoveryDifference - b.recoveryDifference);
}

export type SuggestionId =
  | "over-reaching"
  | "room-to-push"
  | "sleep"
  | "tag"
  | "recovery-drop";

export type Suggestion = { id: SuggestionId; text: string };

/** Up to three plain suggestions for the next period, most important first. */
export function suggestionsFor(input: {
  days: readonly (DailyScore | null)[];
  scores: ScoreSummary;
  tagEffects: readonly TagEffect[];
}): Suggestion[] {
  const { days, scores } = input;
  const rules = summaryRules;
  if (scores.scoredDays < loadBalanceRules.minDays) return [];
  const out: Suggestion[] = [];

  const scored = days.filter((d): d is DailyScore => d !== null);
  const verdict = loadBalance(scored).verdict;
  if (verdict === "over-reaching") {
    out.push({
      id: "over-reaching",
      text: "Several hard days came on low recovery. Plan an easier day after a hard one.",
    });
  } else if (verdict === "room-to-push") {
    out.push({
      id: "room-to-push",
      text: "Recovery stayed high on easy days. You have room for a harder session.",
    });
  }

  const poorNights = scored.filter(
    (d) => d.sleepScore !== null && d.sleepScore < rules.poorNightBelow,
  ).length;
  const sleep = scores.averages.sleep;
  if (
    (sleep !== null && sleep < rules.sleepAverageBelow) ||
    poorNights >= rules.poorNightsForSuggestion
  ) {
    out.push({
      id: "sleep",
      text: "Sleep was the weak spot. An earlier, steadier bedtime is the easiest win.",
    });
  }

  const worstTag = input.tagEffects
    .filter((e) => e.recoveryDifference <= -rules.tagDifferenceAtLeast)
    .sort((a, b) => a.recoveryDifference - b.recoveryDifference)[0];
  if (worstTag) {
    out.push({
      id: "tag",
      text: `Recovery was ${Math.round(Math.abs(worstTag.recoveryDifference))} lower the day after ${tagLabels[worstTag.tag].toLowerCase()}.`,
    });
  }

  const drop = scores.deltas.recovery;
  if (drop !== null && drop <= -rules.recoveryDropAtLeast) {
    out.push({
      id: "recovery-drop",
      text: `Recovery averaged ${Math.round(Math.abs(drop))} lower than the period before. Keep an eye on load and sleep.`,
    });
  }

  return out.slice(0, rules.maxSuggestions);
}
