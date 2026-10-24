import { loadFitnessData } from "./fitness";
import { MockHealthProvider } from "./mockProvider";
import type { HealthProvider } from "./types";

describe("loadFitnessData", () => {
  it("builds a 30-day fitness summary from sample workouts", async () => {
    const data = await loadFitnessData(new MockHealthProvider());
    expect(data.days).toHaveLength(30);
    expect(data.rangeEnd).toBe(data.days.at(-1)?.date);
    expect(data.activity.totalMinutes).toBeGreaterThan(0);
    expect(data.activity.previousMinutes).not.toBeNull();
    expect(data.cardioLoad.ratio).not.toBeNull();
    expect(data.cardioFocus).not.toBeNull();
    expect(data.heartRateRecovery.length).toBeGreaterThan(0);
    expect(data.strength.sessions).toBeGreaterThan(0);
    expect(data.strength.weekly).toHaveLength(4);
    expect(
      data.trainingMix.reduce((total, entry) => total + entry.share, 0),
    ).toBe(100);
    expect(data.maxHeartRateFromAge).toBe(true);
    expect(data.cardioGauge.optimal).not.toBeNull();
    expect(data.muscularGauge.value).toBeGreaterThan(0);
    expect(data.activeMinutes.current).toHaveLength(7);
    expect(data.zoneWeeks).toHaveLength(4);
    expect(data.zoneWeeks.at(-1)!.minutes.some((minutes) => minutes > 0)).toBe(
      true,
    );
  });

  it("returns empty sections when no workouts are recorded", async () => {
    const provider = {
      kind: "apple",
      getWorkouts: async () => [],
      getRestingHR: async () => 55,
      getProfile: async () => ({ birthDate: null, sex: null }),
    } as unknown as HealthProvider;
    const data = await loadFitnessData(provider);
    expect(data.workoutCount).toBe(0);
    expect(data.activity).toMatchObject({
      totalMinutes: 0,
      previousMinutes: null,
    });
    expect(data.cardioLoad.status).toBe("NO DATA");
    expect(data.cardioFocus).toBeNull();
    expect(data.heartRateRecovery).toEqual([]);
    expect(data.strength).toMatchObject({ sessions: 0, weekly: [0, 0, 0, 0] });
    expect(data.trainingMix).toEqual([]);
    expect(data.cardioGauge.status).toBe("NO DATA");
    expect(data.maxHeartRateFromAge).toBe(false);
  });
});
