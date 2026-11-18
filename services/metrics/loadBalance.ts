import { coachingThresholds } from "@/services/coaching";

/** One day's strain (0–21) and recovery (0–100); null when it could not be computed. */
export type LoadDay = {
  date: string;
  strain: number | null;
  recovery: number | null;
};

/**
 * How a day's strain matched its recovery:
 * - "over": hard day (strain 12+) on low recovery (under 45)
 * - "under": easy day (strain under 12) on high recovery (75+)
 * - "matched": anything in between
 * - "unknown": strain or recovery is missing
 */
export type DayFit = "over" | "under" | "matched" | "unknown";

export type LoadVerdict = "over-reaching" | "balanced" | "room-to-push";

export type LoadBalance = {
  /** Null until the window has at least `minDays` days with both scores. */
  verdict: LoadVerdict | null;
  /** Days in the window with both scores. */
  scoredDays: number;
  overDays: number;
  underDays: number;
  averageStrain: number | null;
  averageRecovery: number | null;
};

export const loadBalanceRules = {
  /** Days the verdict looks back over. */
  windowDays: 7,
  /** Scored days needed before a verdict is given. */
  minDays: 3,
  /** Hard days on low recovery that make the week over-reaching. */
  overDaysForOverreaching: 2,
  /** Easy days on high recovery that leave room to push. */
  underDaysForRoomToPush: 3,
} as const;

export function dayFit({ strain, recovery }: LoadDay): DayFit {
  if (strain === null || recovery === null) return "unknown";
  const hard = strain >= coachingThresholds.pushBelowStrain;
  if (hard && recovery < coachingThresholds.recoverBelowRecovery) return "over";
  if (!hard && recovery >= coachingThresholds.pushFromRecovery) return "under";
  return "matched";
}

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

/** The verdict over the last `windowDays` days of `days` (oldest first). */
export function loadBalance(days: readonly LoadDay[]): LoadBalance {
  const rules = loadBalanceRules;
  const recent = days.slice(-rules.windowDays);
  const scored = recent.filter((day) => dayFit(day) !== "unknown");
  const overDays = scored.filter((day) => dayFit(day) === "over").length;
  const underDays = scored.filter((day) => dayFit(day) === "under").length;

  let verdict: LoadVerdict | null = null;
  if (scored.length >= rules.minDays) {
    if (overDays >= rules.overDaysForOverreaching) verdict = "over-reaching";
    else if (underDays >= rules.underDaysForRoomToPush)
      verdict = "room-to-push";
    else verdict = "balanced";
  }

  return {
    verdict,
    scoredDays: scored.length,
    overDays,
    underDays,
    averageStrain: average(scored.map((day) => day.strain!)),
    averageRecovery: average(scored.map((day) => day.recovery!)),
  };
}

/** The one-line explanation under the verdict. */
export function loadBalanceSummary(balance: LoadBalance): string {
  const { windowDays, minDays } = loadBalanceRules;
  const days = (count: number) => `${count} day${count === 1 ? "" : "s"}`;
  switch (balance.verdict) {
    case null:
      return `Needs ${days(minDays)} with both strain and recovery in the last ${windowDays}. You have ${balance.scoredDays}.`;
    case "over-reaching":
      return `${days(balance.overDays)} of hard training on low recovery this week. Ease off until recovery climbs.`;
    case "room-to-push":
      return `${days(balance.underDays)} this week were easy despite high recovery. You can take on more.`;
    case "balanced":
      return "Your strain has tracked your recovery this week.";
  }
}

/**
 * The `count` days ending at the newest day in `days`, one entry per calendar
 * day, with missing days filled in as empty so gaps show as gaps.
 */
export function lastDays(days: readonly LoadDay[], count: number): LoadDay[] {
  const newest = days.at(-1);
  if (!newest) return [];
  const byDate = new Map(days.map((day) => [day.date, day]));
  const end = new Date(`${newest.date}T12:00:00`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (count - 1 - index));
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    return byDate.get(key) ?? { date: key, strain: null, recovery: null };
  });
}
