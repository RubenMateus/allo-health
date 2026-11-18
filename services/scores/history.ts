import { readSignalHistories } from "@/services/health/dashboard";
import type { HealthProvider, HealthSample } from "@/services/health/types";
import { fromDayKey, shiftDayKey, toDayKey } from "@/services/journal";
import {
  BASELINE_DAYS,
  dailyValue,
  scoreDay,
  sleepAsOf,
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
export const KEEP_DAYS = 730;
const STORAGE_KEY = "days";

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

/** Keeps nothing: sample scores are cheap to recompute and must never pass for real ones. */
const discardingStorage: ScoreStorage = {
  getItem: () => null,
  setItem: () => undefined,
};

/** The store to keep `provider`'s scores in; the sample provider's are never kept. */
export function scoreStorageFor(
  provider: HealthProvider,
  storage: ScoreStorage,
): ScoreStorage {
  return provider.kind === "mock" ? discardingStorage : storage;
}

let storedDaysQueue: Promise<unknown> = Promise.resolve();

/** Runs every read-modify-write of the stored days one after another. */
export function withStoredDays<T>(fn: () => Promise<T>): Promise<T> {
  const run = storedDaysQueue.then(fn, fn);
  storedDaysQueue = run.catch(() => undefined);
  return run;
}

/** Drops days that are too old, and today or later (those are never stored). */
function pruneStored(stored: Record<string, DailyScore>, today: string) {
  const oldest = shiftDayKey(today, -KEEP_DAYS);
  for (const date of Object.keys(stored))
    if (date < oldest || date >= today) delete stored[date];
}

async function saveDays(
  storage: ScoreStorage,
  today: string,
  fresh: Record<string, DailyScore>,
) {
  await withStoredDays(async () => {
    const stored = await readStored(storage);
    Object.assign(stored, fresh);
    pruneStored(stored, today);
    await storage.setItem(STORAGE_KEY, JSON.stringify(stored));
  });
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
  const stored = await withStoredDays(() => readStored(storage));
  // Count back from today's date, not the clock: the dashboard may have been
  // read before midnight and the app left open.
  const past = Array.from({ length: HISTORY_DAYS - 1 }, (_, index) => {
    const daysAgo = HISTORY_DAYS - 1 - index;
    return { daysAgo, date: shiftDayKey(today.date, -daysAgo) };
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
    const fresh: Record<string, DailyScore> = {};
    for (const { date } of stale) {
      fresh[date] = await computeDay(provider, date, histories, now);
    }
    Object.assign(stored, fresh);
    await saveDays(storage, today.date, fresh);
  }

  return [...past.map(({ date }) => stored[date]!), today];
}

/**
 * Scores for every day in [from, to]. Today and later map to null and are never
 * stored. Days already stored are passed to `onStored` first, then missing
 * finished days are computed one at a time, saved, and passed to `onDay` as
 * they land.
 * Once `signal` aborts, no further reads or writes happen.
 */
export async function loadScoreRange(
  provider: HealthProvider,
  storage: ScoreStorage,
  from: string,
  to: string,
  now = new Date(),
  onDay?: (score: DailyScore) => void,
  options: {
    signal?: AbortSignal;
    onStored?: (days: Record<string, DailyScore | null>) => void;
  } = {},
): Promise<Record<string, DailyScore | null>> {
  const { signal, onStored } = options;
  const todayKey = toDayKey(now);
  const stored = await withStoredDays(() => readStored(storage));
  const result: Record<string, DailyScore | null> = {};
  const missing: string[] = [];
  for (let date = from; date <= to; date = shiftDayKey(date, 1)) {
    if (date >= todayKey) result[date] = null;
    else if (stored[date]) result[date] = stored[date]!;
    else missing.push(date);
  }
  if (!missing.length || signal?.aborted) return result;
  onStored?.({ ...result });

  const span = Math.round(
    (fromDayKey(to).getTime() - fromDayKey(from).getTime()) / 86_400_000,
  );
  const histories = await readSignalHistories(
    provider,
    span + BASELINE_DAYS + 1,
    fromDayKey(to),
  );
  for (const date of missing) {
    if (signal?.aborted) break;
    const score = await computeDay(provider, date, histories, now);
    if (signal?.aborted) break;
    // Durable before it is reported, so an interrupted backfill keeps its days.
    await saveDays(storage, todayKey, { [date]: score });
    result[date] = score;
    onDay?.(score);
  }
  return result;
}

async function computeDay(
  provider: HealthProvider,
  date: string,
  histories: Record<SignalKind, HealthSample[]>,
  now: Date,
): Promise<DailyScore> {
  const day = fromDayKey(date);
  const asOf = sleepAsOf(day);
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
