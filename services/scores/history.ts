import { readSignalHistories } from "@/services/health/dashboard";
import type { HealthProvider, HealthSample } from "@/services/health/types";
import { fromDayKey, toDayKey } from "@/services/journal";
import {
  BASELINE_DAYS,
  dailyValue,
  scoreDay,
  type DailyScore,
  type SignalKind,
} from "@/services/metrics/daily";

import type { ScoreStorage } from "./types";

/** Days shown on the Strain and Recovery pages, today included. */
export const HISTORY_DAYS = 14;
/** Finished days recomputed on every load, for watches that sync late. */
export const REFRESH_RECENT_DAYS = 2;
/** Empty days this recent are tried again. */
export const RETRY_NULL_DAYS = 7;
/** An empty day is read again only after this long, so pages don't re-read every open. */
export const RETRY_AFTER_HOURS = 6;
/** Stored days older than this are dropped. */
const KEEP_DAYS = 45;
const STORAGE_KEY = "days";

const daysBefore = (now: Date, days: number) => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - days);
  return day;
};

async function readStored(
  storage: ScoreStorage,
): Promise<Record<string, DailyScore>> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DailyScore>) : {};
  } catch {
    return {};
  }
}

const needsCompute = (
  stored: DailyScore | undefined,
  daysAgo: number,
  now: Date,
) =>
  !stored ||
  daysAgo <= REFRESH_RECENT_DAYS ||
  (daysAgo < RETRY_NULL_DAYS &&
    (stored.strain === null || stored.recovery === null) &&
    now.getTime() - new Date(stored.computedAt).getTime() >=
      RETRY_AFTER_HOURS * 3_600_000);

/**
 * The last 14 days of scores, oldest first, ending with `today` (computed live by
 * the dashboard and never stored). Finished days come from the on-device cache;
 * missing or stale ones are read again from Health and saved.
 */
export async function loadScoreHistory(
  provider: HealthProvider,
  storage: ScoreStorage,
  today: DailyScore,
  now = new Date(),
): Promise<DailyScore[]> {
  const stored = await readStored(storage);
  // Count back from today's date, not the clock: the dashboard may have been
  // read before midnight and the app left open.
  const anchor = fromDayKey(today.date);
  const past = Array.from({ length: HISTORY_DAYS - 1 }, (_, index) => {
    const daysAgo = HISTORY_DAYS - 1 - index;
    return { daysAgo, date: toDayKey(daysBefore(anchor, daysAgo)) };
  });
  const stale = past.filter(({ date, daysAgo }) =>
    needsCompute(stored[date], daysAgo, now),
  );

  if (stale.length) {
    const histories = await readSignalHistories(
      provider,
      HISTORY_DAYS + BASELINE_DAYS + 1,
    );
    // One day at a time, so a backfill doesn't flood HealthKit / Health Connect.
    for (const { date } of stale) {
      stored[date] = await computeDay(provider, date, histories, now);
    }
    const oldest = toDayKey(daysBefore(anchor, KEEP_DAYS));
    for (const date of Object.keys(stored))
      if (date < oldest || date >= today.date) delete stored[date];
    await storage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  return [...past.map(({ date }) => stored[date]!), today];
}

async function computeDay(
  provider: HealthProvider,
  date: string,
  histories: Record<SignalKind, HealthSample[]>,
  now: Date,
): Promise<DailyScore> {
  const day = fromDayKey(date);
  // Late afternoon picks the night that ended that morning, not a later nap.
  const asOf = new Date(day);
  asOf.setHours(18, 0, 0, 0);
  const signals = {
    hrv: dailyValue(histories.hrv, date),
    restingHeartRate: dailyValue(histories.restingHeartRate, date),
    respiratoryRate: dailyValue(histories.respiratoryRate, date),
  };
  // Each read on its own: a type the user didn't grant mustn't empty the others.
  const [sleep, strainInputs] = await Promise.allSettled([
    provider.getSleep(asOf),
    provider.getStrainInputs(day),
  ]);
  return scoreDay({
    date,
    sleep: sleep.status === "fulfilled" ? sleep.value : null,
    strainInputs:
      strainInputs.status === "fulfilled" ? strainInputs.value : null,
    signals,
    histories,
    now,
  });
}
