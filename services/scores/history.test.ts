import { MockHealthProvider } from "@/services/health/mockProvider";
import { toDayKey } from "@/services/journal";
import type { DailyScore } from "@/services/metrics/daily";

import {
  KEEP_DAYS,
  loadScoreHistory,
  loadScoreRange,
  scoreStorageFor,
  withStoredDays,
} from "./history";
import type { ScoreStorage } from "./types";

const NOW = new Date(2026, 10, 18, 12);
const key = (daysAgo: number) => toDayKey(new Date(2026, 10, 18 - daysAgo));

function memoryStorage(): ScoreStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (name) => data.get(name) ?? null,
    setItem: async (name, value) => {
      data.set(name, value);
    },
  };
}

const stored = (storage: { data: Map<string, string> }) =>
  JSON.parse(storage.data.get("days") ?? "{}") as Record<string, DailyScore>;

function countingProvider() {
  const provider = realProvider();
  const strain = jest.spyOn(provider, "getStrainInputs");
  return { provider, strain };
}

/** Sample data that behaves like a real provider: its scores are cached. */
function realProvider() {
  const provider = new MockHealthProvider();
  Object.defineProperty(provider, "kind", { value: "apple" });
  return provider;
}

const today = {
  date: key(0),
  strain: 5,
  recovery: 60,
  sleepScore: 70,
} as DailyScore;

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe("loadScoreHistory", () => {
  it("backfills 13 finished days on first load and appends today", async () => {
    const storage = memoryStorage();
    const { provider, strain } = countingProvider();

    const days = await loadScoreHistory(provider, storage, today, NOW);

    expect(days).toHaveLength(14);
    expect(days[0]!.date).toBe(key(13));
    expect(days.at(-1)).toBe(today);
    expect(strain).toHaveBeenCalledTimes(13);
    expect(Object.keys(stored(storage)).sort()).toEqual(
      Array.from({ length: 13 }, (_, index) => key(13 - index)),
    );
    expect(stored(storage)[key(0)]).toBeUndefined();
    expect(days.slice(0, -1).every((day) => day.strain !== null)).toBe(true);
  });

  it("only recomputes the last two finished days on a later load", async () => {
    const storage = memoryStorage();
    await loadScoreHistory(realProvider(), storage, today, NOW);
    const { provider, strain } = countingProvider();

    await loadScoreHistory(provider, storage, today, NOW);

    expect(strain).toHaveBeenCalledTimes(2);
  });

  it("retries recent days that came out empty, but not older ones", async () => {
    const storage = memoryStorage();
    await loadScoreHistory(realProvider(), storage, today, NOW);
    const days = stored(storage);
    const earlier = new Date(NOW.getTime() - 7 * 3_600_000).toISOString();
    days[key(4)] = { ...days[key(4)]!, strain: null, computedAt: earlier };
    days[key(5)] = { ...days[key(5)]!, recovery: null };
    days[key(10)] = { ...days[key(10)]!, recovery: null, computedAt: earlier };
    storage.data.set("days", JSON.stringify(days));
    const { provider, strain } = countingProvider();

    await loadScoreHistory(provider, storage, today, NOW);

    expect(strain).toHaveBeenCalledTimes(3);
    expect(stored(storage)[key(10)]!.recovery).toBeNull();
    expect(stored(storage)[key(4)]!.strain).not.toBeNull();
    // Day 5 came out empty only just now, so it isn't read again yet.
    expect(stored(storage)[key(5)]!.recovery).toBeNull();
  });

  it("anchors the days on today's date, even after midnight passes", async () => {
    const storage = memoryStorage();
    const yesterday = { ...today, date: key(1) };
    const later = new Date(2026, 10, 18, 8);

    const days = await loadScoreHistory(
      realProvider(),
      storage,
      yesterday,
      later,
    );

    expect(days).toHaveLength(14);
    expect(days.every(Boolean)).toBe(true);
    expect(days.at(-1)).toBe(yesterday);
    expect(days.at(-2)!.date).toBe(key(2));
  });

  it("keeps strain when only sleep can't be read", async () => {
    const storage = memoryStorage();
    const provider = realProvider();
    jest.spyOn(provider, "getSleep").mockRejectedValue(new Error("denied"));

    const days = await loadScoreHistory(provider, storage, today, NOW);

    expect(days[5]!.strain).not.toBeNull();
    expect(days[5]!.recovery).toBeNull();
    expect(days[5]!.recoveryInputs.hrv.value).not.toBeNull();
  });

  it("stores no strain for a day whose heart-rate read fails", async () => {
    const storage = memoryStorage();
    const { provider, strain } = countingProvider();
    const failing = new Date(2026, 10, 15).toDateString();
    strain.mockImplementation(async (day) => {
      if (day?.toDateString() === failing) throw new Error("read failed");
      return MockHealthProvider.prototype.getStrainInputs.call(provider, day);
    });

    const days = await loadScoreHistory(provider, storage, today, NOW);

    const failed = days.find((day) => day.date === key(3))!;
    expect(failed.strain).toBeNull();
    expect(failed.recovery).not.toBeNull();
    expect(days).toHaveLength(14);
  });

  it("drops stored days older than KEEP_DAYS", async () => {
    const storage = memoryStorage();
    storage.data.set(
      "days",
      JSON.stringify({
        [key(KEEP_DAYS + 1)]: { ...today, date: key(KEEP_DAYS + 1) },
      }),
    );
    await loadScoreHistory(realProvider(), storage, today, NOW);
    expect(stored(storage)[key(KEEP_DAYS + 1)]).toBeUndefined();
  });
});

describe("loadScoreRange", () => {
  it("reads only missing days and stores them", async () => {
    const storage = memoryStorage();
    await loadScoreHistory(realProvider(), storage, today, NOW);
    const days = stored(storage);
    delete days[key(3)];
    delete days[key(5)];
    storage.data.set("days", JSON.stringify(days));
    const { provider, strain } = countingProvider();
    const landed: string[] = [];

    const result = await loadScoreRange(
      provider,
      storage,
      key(7),
      key(3),
      NOW,
      (score) => landed.push(score.date),
    );

    expect(strain).toHaveBeenCalledTimes(2);
    expect(Object.keys(result)).toHaveLength(5);
    expect(Object.values(result).every(Boolean)).toBe(true);
    expect(landed.sort()).toEqual([key(5), key(3)].sort());
    expect(Object.keys(stored(storage))).toHaveLength(13);
  });

  it("maps today and later to null without storing them", async () => {
    const storage = memoryStorage();
    const result = await loadScoreRange(
      realProvider(),
      storage,
      key(1),
      key(-1),
      NOW,
    );

    expect(result[key(1)]).not.toBeNull();
    expect(result[key(0)]).toBeNull();
    expect(result[key(-1)]).toBeNull();
    expect(Object.keys(stored(storage))).toEqual([key(1)]);
  });

  it("loses no writes when a range and the history load together", async () => {
    const storage = memoryStorage();
    await Promise.all([
      loadScoreRange(realProvider(), storage, key(400), key(398), NOW),
      loadScoreHistory(realProvider(), storage, today, NOW),
    ]);

    const keys = Object.keys(stored(storage));
    expect(keys).toEqual(
      expect.arrayContaining([key(400), key(399), key(398)]),
    );
    expect(keys).toEqual(expect.arrayContaining([key(13), key(1)]));
    expect(keys).toHaveLength(16);
  });

  it("drops stored days older than 730 days and keeps 700-day-old ones", async () => {
    const storage = memoryStorage();
    const sample = { ...today, date: key(1) };
    storage.data.set(
      "days",
      JSON.stringify({
        [key(KEEP_DAYS + 1)]: { ...sample, date: key(KEEP_DAYS + 1) },
        [key(700)]: { ...sample, date: key(700) },
      }),
    );

    await loadScoreRange(realProvider(), storage, key(2), key(1), NOW);

    const keys = Object.keys(stored(storage));
    expect(keys).toContain(key(700));
    expect(keys).not.toContain(key(KEEP_DAYS + 1));
  });

  it("keeps the days computed before a failure", async () => {
    const storage = memoryStorage();
    const provider = realProvider();
    const real = provider.getStrainInputs.bind(provider);
    let calls = 0;
    jest.spyOn(provider, "getStrainInputs").mockImplementation((day) => {
      calls += 1;
      if (calls === 3) throw new Error("interrupted");
      return real(day);
    });
    const landed: string[] = [];

    await expect(
      loadScoreRange(provider, storage, key(5), key(1), NOW, (score) =>
        landed.push(score.date),
      ),
    ).rejects.toThrow("interrupted");

    expect(landed).toEqual([key(5), key(4)]);
    expect(Object.keys(stored(storage)).sort()).toEqual(
      [key(5), key(4)].sort(),
    );
  });
});

describe("withStoredDays", () => {
  it("keeps running after a rejected step", async () => {
    await expect(
      withStoredDays(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(withStoredDays(async () => 7)).resolves.toBe(7);
  });
});

describe("sample data and cancellation", () => {
  it("never writes mock scores to storage", async () => {
    const storage = memoryStorage();
    const setItem = jest.spyOn(storage, "setItem");
    const mock = new MockHealthProvider();
    const kept = scoreStorageFor(mock, storage);

    const range = await loadScoreRange(mock, kept, key(5), key(1), NOW);
    const history = await loadScoreHistory(mock, kept, today, NOW);

    expect(Object.values(range).every(Boolean)).toBe(true);
    expect(history).toHaveLength(14);
    expect(setItem).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it("stops reading and writing once aborted", async () => {
    const storage = memoryStorage();
    const { provider, strain } = countingProvider();
    const controller = new AbortController();
    const original =
      MockHealthProvider.prototype.getStrainInputs.bind(provider);
    strain.mockImplementation(async (day) => {
      controller.abort();
      return original(day);
    });

    await loadScoreRange(provider, storage, key(7), key(3), NOW, undefined, {
      signal: controller.signal,
    });

    expect(strain).toHaveBeenCalledTimes(1);
    expect(Object.keys(stored(storage))).toHaveLength(0);
  });

  it("reports stored days before any provider read resolves", async () => {
    const storage = memoryStorage();
    await loadScoreHistory(realProvider(), storage, today, NOW);
    const days = stored(storage);
    delete days[key(7)];
    delete days[key(6)];
    storage.data.set("days", JSON.stringify(days));
    const { provider, strain } = countingProvider();
    const reports: string[][] = [];
    let readsBeforeFirstReport = -1;

    await loadScoreRange(provider, storage, key(7), key(3), NOW, undefined, {
      onStored: (partial) => {
        readsBeforeFirstReport = strain.mock.calls.length;
        reports.push(Object.keys(partial).sort());
      },
    });

    expect(readsBeforeFirstReport).toBe(0);
    expect(reports[0]).toEqual([key(5), key(4), key(3)].sort());
  });
});
