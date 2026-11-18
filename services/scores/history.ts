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

const needsCompute = (stored: DailyScore | undefined, daysAgo: number) =>
  !stored ||
  daysAgo <= REFRESH_RECENT_DAYS ||
  (daysAgo < RETRY_NULL_DAYS &&
    (stored.strain === null || stored.recovery === null));

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
  const past = Array.from({ length: HISTORY_DAYS - 1 }, (_, index) => {
    const daysAgo = HISTORY_DAYS - 1 - index;
    return { daysAgo, date: toDayKey(daysBefore(now, daysAgo)) };
  });
  const stale = past.filter(({ date, daysAgo }) =>
    needsCompute(stored[date], daysAgo),
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
    const oldest = toDayKey(daysBefore(now, KEEP_DAYS));
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
  try {
    const [sleep, strainInputs] = await Promise.all([
      provider.getSleep(asOf),
      provider.getStrainInputs(day),
    ]);
    return scoreDay({ date, sleep, strainInputs, signals, histories, now });
  } catch {
    return scoreDay({
      date,
      sleep: null,
      strainInputs: null,
      signals: { hrv: null, restingHeartRate: null, respiratoryRate: null },
      histories,
      now,
    });
  }
}
