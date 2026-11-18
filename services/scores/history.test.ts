import { MockHealthProvider } from "@/services/health/mockProvider";
import { toDayKey } from "@/services/journal";
import type { DailyScore } from "@/services/metrics/daily";

import { loadScoreHistory } from "./history";
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
  const provider = new MockHealthProvider();
  const strain = jest.spyOn(provider, "getStrainInputs");
  return { provider, strain };
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
    await loadScoreHistory(new MockHealthProvider(), storage, today, NOW);
    const { provider, strain } = countingProvider();

    await loadScoreHistory(provider, storage, today, NOW);

    expect(strain).toHaveBeenCalledTimes(2);
  });

  it("retries recent days that came out empty, but not older ones", async () => {
    const storage = memoryStorage();
    await loadScoreHistory(new MockHealthProvider(), storage, today, NOW);
    const days = stored(storage);
    days[key(4)] = { ...days[key(4)]!, strain: null };
    days[key(10)] = { ...days[key(10)]!, recovery: null };
    storage.data.set("days", JSON.stringify(days));
    const { provider, strain } = countingProvider();

    await loadScoreHistory(provider, storage, today, NOW);

    expect(strain).toHaveBeenCalledTimes(3);
    expect(stored(storage)[key(10)]!.recovery).toBeNull();
    expect(stored(storage)[key(4)]!.strain).not.toBeNull();
  });

  it("stores an empty day when one day's read fails", async () => {
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
    expect(failed.recovery).toBeNull();
    expect(days).toHaveLength(14);
  });

  it("drops stored days older than 45 days", async () => {
    const storage = memoryStorage();
    storage.data.set(
      "days",
      JSON.stringify({ [key(60)]: { ...today, date: key(60) } }),
    );
    await loadScoreHistory(new MockHealthProvider(), storage, today, NOW);
    expect(stored(storage)[key(60)]).toBeUndefined();
  });
});
