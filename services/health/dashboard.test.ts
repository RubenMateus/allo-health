import { toDayKey } from "@/services/journal";
import { loadScoreRange } from "@/services/scores/history";
import { loadDashboardData } from "./dashboard";
import { MockHealthProvider } from "./mockProvider";

describe("loadDashboardData baselines", () => {
  it("scores today's recovery against the provider's 30-day history", async () => {
    const data = await loadDashboardData(new MockHealthProvider());
    expect(data.today.recovery).not.toBeNull();
    expect(data.today.recoveryInputs.hrv.building).toBe(false);
    expect(data.today.recoveryInputs.hrv.baselineDays).toBeGreaterThanOrEqual(7);
    expect(data.strainInputs.activeEnergyKcal).toBe(468);
  });

  it("falls back to fixed baselines when history can't be read", async () => {
    const provider = new MockHealthProvider();
    provider.getBiomarkerHistory = () => Promise.reject(new Error("denied"));
    const data = await loadDashboardData(provider);
    expect(data.today.recovery).not.toBeNull();
    expect(data.today.recoveryInputs.hrv).toMatchObject({
      baseline: 48,
      building: true,
    });
    expect(data.sectionErrors.recovery).toBe(false);
  });
});

describe("loadDashboardData for a day", () => {
  const pastDay = new Date(2026, 10, 15, 14);
  beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 10, 18, 12) }));
  afterEach(() => jest.useRealTimers());

  it("scores a past day the same way as the day history, as of its end", async () => {
    const provider = new MockHealthProvider();
    const key = toDayKey(pastDay);
    const data = await loadDashboardData(provider, "mock", pastDay);
    const range = await loadScoreRange(
      provider,
      { getItem: () => null, setItem: () => undefined },
      key,
      key,
    );

    const { computedAt, ...scores } = data.today;
    const { computedAt: _rangeComputedAt, ...rangeScores } = range[key]!;
    expect(scores).toEqual(rangeScores);
    expect(new Date(computedAt).getHours()).toBe(23);
  });

  it("describes the requested day", async () => {
    const data = await loadDashboardData(new MockHealthProvider(), "mock", pastDay);
    expect(data.today.date).toBe(toDayKey(pastDay));
    expect(new Date(data.sleep!.wakeTime).toDateString()).toBe(
      pastDay.toDateString(),
    );
    expect(data.stress).not.toBeNull();
    expect(
      data.stress!.samples.every(
        (s) => new Date(s.timestamp).toDateString() === pastDay.toDateString(),
      ),
    ).toBe(true);
  });

  it("defaults to today", async () => {
    const data = await loadDashboardData(new MockHealthProvider());
    expect(data.today.date).toBe(toDayKey(new Date()));
  });
});
