import { readSignalHistories } from "@/services/health/dashboard";
import type { HealthProvider, HealthSample } from "@/services/health/types";
import { fromDayKey, shiftDayKey, toDayKey } from "@/services/journal";
import {
  BASELINE_DAYS,
  scoreDay,
  signalsFor,
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
/** A backfill saves after this many new days, and once more at the end. */
const SAVE_EVERY_DAYS = 7;

/** The last text read or written per store, with its parsed days. */
const parsed = new WeakMap<
  ScoreStorage,
  { raw: string; days: Record<string, DailyScore> }
>();

async function readStored(
  storage: ScoreStorage,
): Promise<Record<string, DailyScore>> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    // Parsing up to 730 days is the slow part; skip it while the text is unchanged.
    const cached = parsed.get(storage);
    if (cached?.raw === raw) return { ...cached.days };
    const days = JSON.parse(raw) as Record<string, DailyScore>;
    parsed.set(storage, { raw, days });
    return { ...days };
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
function scoreStorageFor(
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
    const raw = JSON.stringify(stored);
    await storage.setItem(STORAGE_KEY, raw);
    parsed.set(storage, { raw, days: stored });
  });
}

/**
 * Days computed but not saved yet, per provider, so overlapping loads share
 * one read. An entry goes once its day is saved, or if the read fails.
 */
const unsavedDays = new WeakMap<
  HealthProvider,
  Map<string, Promise<DailyScore>>
>();

function unsavedFor(provider: HealthProvider) {
  let days = unsavedDays.get(provider);
  if (!days) unsavedDays.set(provider, (days = new Map()));
  return days;
}

function computeShared(
  provider: HealthProvider,
  date: string,
  histories: Record<SignalKind, HealthSample[]>,
  now: Date,
): Promise<DailyScore> {
  const days = unsavedFor(provider);
  const existing = days.get(date);
  if (existing) return existing;
  const day = computeDay(provider, date, histories, now);
  days.set(date, day);
  day.catch(() => days.delete(date));
  return day;
}

/** Saves `fresh`, then lets later loads read those days from storage. */
async function saveComputed(
  provider: HealthProvider,
  storage: ScoreStorage,
  today: string,
  fresh: Record<string, DailyScore>,
) {
  if (!Object.keys(fresh).length) return;
  try {
    await saveDays(storage, today, fresh);
  } finally {
    const days = unsavedFor(provider);
    for (const date of Object.keys(fresh)) days.delete(date);
  }
}

/** A day another load already saved since `stored` was read. */
const savedSince = (storage: ScoreStorage, date: string) => {
  const day = parsed.get(storage)?.days[date];
  // A day saved before the Energy Bank is being refilled, not reused.
  return day && !lacksEnergy(day) ? day : undefined;
};

/** Days this recent that were saved before the Energy Bank are read again, so "usual" has them. */
export const ENERGY_REFILL_DAYS = 14;

/** Saved before the Energy Bank existed (no `energy` key at all, not a null one). */
const lacksEnergy = (day: DailyScore) => day.energy === undefined;

/** A stored day as callers see it: older days without energy read as null. */
const withEnergy = (day: DailyScore): DailyScore =>
  lacksEnergy(day) ? { ...day, energy: null } : day;

const needsCompute = (
  stored: DailyScore | undefined,
  daysAgo: number,
  now: Date,
) =>
  !stored ||
  daysAgo <= REFRESH_RECENT_DAYS ||
  (daysAgo <= ENERGY_REFILL_DAYS && lacksEnergy(stored)) ||
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
  store: ScoreStorage,
  today: DailyScore,
  now = new Date(),
): Promise<DailyScore[]> {
  const storage = scoreStorageFor(provider, store);
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
    try {
      for (const { date } of stale) {
        fresh[date] = await computeShared(provider, date, histories, now);
      }
    } finally {
      // Also on failure, so the days already read are kept.
      await saveComputed(provider, storage, today.date, fresh);
    }
    Object.assign(stored, fresh);
  }

  return [...past.map(({ date }) => withEnergy(stored[date]!)), today];
}

/**
 * Scores for every day in [from, to]. Today and later map to null and are never
 * stored. Days already stored are passed to `onStored` first, then missing
 * finished days are computed one at a time, saved, and passed to `onDay` as
 * they land, newest first so the most recent days fill in first. Scores from
 * the sample provider are returned but never saved. Once `signal` aborts, no
 * further days are read or reported; the ones already reported are still saved.
 */
export async function loadScoreRange(
  provider: HealthProvider,
  store: ScoreStorage,
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
  const storage = scoreStorageFor(provider, store);
  const todayKey = toDayKey(now);
  const stored = await withStoredDays(() => readStored(storage));
  const result: Record<string, DailyScore | null> = {};
  const missing: string[] = [];
  for (let date = from; date <= to; date = shiftDayKey(date, 1)) {
    const day = stored[date];
    if (date >= todayKey) result[date] = null;
    else if (
      day &&
      !(
        lacksEnergy(day) &&
        date >= shiftDayKey(todayKey, -ENERGY_REFILL_DAYS)
      )
    )
      result[date] = withEnergy(day);
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
  // Saved a few days at a time: each save rewrites the whole stored map.
  let unsaved: Record<string, DailyScore> = {};
  const flush = async () => {
    if (!Object.keys(unsaved).length) return;
    const batch = unsaved;
    unsaved = {};
    await saveComputed(provider, storage, todayKey, batch);
  };
  try {
    for (const date of missing.reverse()) {
      if (signal?.aborted) break;
      const saved = savedSince(storage, date);
      const score =
        saved ?? (await computeShared(provider, date, histories, now));
      if (signal?.aborted) {
        // Not saved, so a later load must read it again.
        if (!saved) unsavedFor(provider).delete(date);
        break;
      }
      if (!saved) unsaved[date] = score;
      result[date] = score;
      onDay?.(score);
      if (Object.keys(unsaved).length >= SAVE_EVERY_DAYS) await flush();
    }
  } finally {
    // Also on failure, so an interrupted backfill keeps the days it finished.
    await flush();
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
  // Each read on its own: a type the user didn't grant mustn't empty the others.
  const [sleep, strainInputs, dayStress] = await Promise.allSettled([
    provider.getSleep(asOf),
    provider.getStrainInputs(day),
    provider.getDayStressSamples(day),
  ]);
  return scoreDay({
    date,
    sleep: sleep.status === "fulfilled" ? sleep.value : null,
    strainInputs:
      strainInputs.status === "fulfilled" ? strainInputs.value : null,
    signals: signalsFor(histories, date),
    histories,
    now,
    dayStress: dayStress.status === "fulfilled" ? dayStress.value : [],
  });
}
