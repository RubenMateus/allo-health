import type {
  HealthSample,
  SleepData,
  StrainInputs,
} from "@/services/health/types";
import { toDayKey } from "@/services/journal";

import {
  baselineFor,
  compareToBaseline,
  dailyValue,
  scoreDay,
  strainCurve,
  strainZoneOf,
  strainZones,
} from "./daily";
import { calculateStrainScore } from "./index";

const sleep: SleepData = {
  durationMinutes: 450,
  needMinutes: 480,
  efficiency: 0.92,
  deepMinutes: 90,
  remMinutes: 100,
  lightMinutes: 260,
  awakeMinutes: 30,
  inBedMinutes: 480,
  bedtime: "2026-11-14T23:00:00.000Z",
  wakeTime: "2026-11-15T07:00:00.000Z",
  stages: [],
  lastSleepAt: "2026-11-15T07:00:00.000Z",
};

const day = (date: string, value: number): HealthSample => {
  const [y, m, d] = date.split("-").map(Number);
  return { value, unit: "ms", timestamp: new Date(y, m - 1, d).toISOString() };
};

/** Daily values for the `count` days before 2026-11-15, plus the day itself. */
const history = (count: number, value: number, today: number) => {
  const samples: HealthSample[] = [];
  for (let back = count; back >= 1; back -= 1) {
    const date = new Date(2026, 10, 15 - back);
    samples.push(day(toDayKey(date), value));
  }
  samples.push(day("2026-11-15", today));
  return samples;
};

const strainInputs = (bpms: number[]): StrainInputs => ({
  heartRateSamples: bpms.map((value, index) => ({
    value,
    unit: "bpm",
    timestamp: new Date(2026, 10, 15, 8, index * 5).toISOString(),
    sampleMinutes: 5,
  })),
  activeEnergyKcal: 400,
  restingHeartRate: 55,
  maxHeartRate: 190,
});

describe("strainZoneOf", () => {
  it("maps heart-rate-reserve fractions to zones and weights", () => {
    expect(strainZoneOf(0.55)).toEqual({ zone: 1, weight: 0.2 });
    expect(strainZoneOf(0.65)).toEqual({ zone: 2, weight: 0.5 });
    expect(strainZoneOf(0.75)).toEqual({ zone: 3, weight: 0.9 });
    expect(strainZoneOf(0.85)).toEqual({ zone: 4, weight: 1.4 });
    expect(strainZoneOf(0.95)).toEqual({ zone: 5, weight: 2 });
  });

  it("leaves calculateStrainScore unchanged", () => {
    expect(calculateStrainScore({ ...strainInputs([]), activeEnergyKcal: 2000 })).toBe(12);
    // 3 buckets: zone 1, zone 3, zone 5 → (0.2 + 0.9 + 2) * 5 * 0.075 + 400 * 0.006
    expect(calculateStrainScore(strainInputs([100, 157, 185]))).toBe(3.6);
  });
});

describe("baselineFor", () => {
  it("averages the 30 days before the scored day, excluding it", () => {
    expect(baselineFor("hrv", history(10, 50, 90), "2026-11-15")).toEqual({
      baseline: 50,
      baselineDays: 10,
      building: false,
    });
  });

  it("ignores values older than 30 days", () => {
    const old = [day("2026-10-01", 500), ...history(8, 40, 90)];
    expect(baselineFor("hrv", old, "2026-11-15").baseline).toBe(40);
  });

  it("falls back to the fixed baseline under 7 days", () => {
    expect(baselineFor("hrv", history(5, 50, 90), "2026-11-15")).toEqual({
      baseline: 48,
      baselineDays: 5,
      building: true,
    });
    expect(baselineFor("restingHeartRate", [], "2026-11-15").baseline).toBe(58);
    expect(baselineFor("respiratoryRate", [], "2026-11-15").baseline).toBe(15);
  });
});

describe("dailyValue", () => {
  it("returns that day's value or null", () => {
    expect(dailyValue(history(3, 50, 90), "2026-11-15")).toBe(90);
    expect(dailyValue(history(3, 50, 90), "2026-11-20")).toBeNull();
  });
});

describe("strain breakdown", () => {
  const inputs = strainInputs([100, 157, 185, 100]);

  it("always lists five zones with minutes adding up", () => {
    const zones = strainZones(inputs);
    expect(zones.map((zone) => zone.zone)).toEqual([1, 2, 3, 4, 5]);
    expect(zones.reduce((sum, zone) => sum + zone.minutes, 0)).toBe(20);
    expect(zones[0]).toEqual({ zone: 1, minutes: 10, weight: 0.2 });
  });

  it("builds a running curve that ends at the day's score", () => {
    const curve = strainCurve(inputs);
    expect(curve).toHaveLength(4);
    expect(curve.at(-1)?.strain).toBe(calculateStrainScore(inputs));
    expect(curve[0]!.strain).toBeLessThanOrEqual(curve[1]!.strain);
  });
});

describe("scoreDay", () => {
  const now = new Date(2026, 10, 16, 9);
  const histories = {
    hrv: history(10, 50, 55),
    restingHeartRate: history(10, 58, 56),
    respiratoryRate: history(10, 15, 14.8),
  };
  const signals = { hrv: 55, restingHeartRate: 56, respiratoryRate: 14.8 };

  it("scores strain and recovery against personal baselines", () => {
    const result = scoreDay({
      date: "2026-11-15",
      sleep,
      strainInputs: strainInputs([100, 157]),
      signals,
      histories,
      now,
    });
    expect(result.date).toBe("2026-11-15");
    expect(result.strain).not.toBeNull();
    expect(result.recovery).toBeGreaterThan(50);
    expect(result.recoveryInputs.hrv).toEqual({
      value: 55,
      baseline: 50,
      baselineDays: 10,
      building: false,
    });
    expect(result.sleepScore).toBe(result.recoveryInputs.sleepScore);
    expect(result.computedAt).toBe(now.toISOString());
  });

  it("keeps strain when sleep is missing, but recovery is null", () => {
    const result = scoreDay({
      date: "2026-11-15",
      sleep: null,
      strainInputs: strainInputs([100]),
      signals,
      histories,
      now,
    });
    expect(result.recovery).toBeNull();
    expect(result.sleepScore).toBeNull();
    expect(result.strain).not.toBeNull();
  });

  it("energy is null when the day has no stress readings", () => {
    const result = scoreDay({
      date: "2026-11-15",
      sleep,
      strainInputs: strainInputs([100]),
      signals,
      histories,
      now,
      dayStress: [],
    });
    expect(result.energy).toBeNull();
  });

  it("scoreDay stores energy summary without points", () => {
    const dayStress = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(2026, 10, 15, 9, (i + 1) * 5).toISOString(),
      heartRate: 70,
      hrv: 50,
    }));
    const result = scoreDay({
      date: "2026-11-15",
      sleep,
      strainInputs: strainInputs([100]),
      signals,
      histories,
      now,
      dayStress,
    });
    expect(result.energy).not.toBeNull();
    expect("points" in result.energy!).toBe(false);
    expect(result.energy!.hourly).toHaveLength(25);
  });

  it("has no strain without heart rate or active energy", () => {
    const result = scoreDay({
      date: "2026-11-15",
      sleep,
      strainInputs: { ...strainInputs([]), activeEnergyKcal: 0 },
      signals: { ...signals, hrv: null },
      histories,
      now,
    });
    expect(result.strain).toBeNull();
    expect(result.strainBreakdown).toBeNull();
    expect(result.recovery).toBeNull();
  });
});

describe("compareToBaseline", () => {
  const signal = (value: number | null, baseline: number, building = false) => ({
    value,
    baseline,
    baselineDays: building ? 3 : 20,
    building,
  });

  it("is direction-aware", () => {
    expect(compareToBaseline("hrv", signal(52, 47))).toEqual({ percent: 11, better: true });
    expect(compareToBaseline("restingHeartRate", signal(56, 58))).toEqual({ percent: -3, better: true });
    expect(compareToBaseline("respiratoryRate", signal(16, 15))?.better).toBe(false);
  });

  it("is null while building or without a value", () => {
    expect(compareToBaseline("hrv", signal(52, 48, true))).toBeNull();
    expect(compareToBaseline("hrv", signal(null, 48))).toBeNull();
  });
});
