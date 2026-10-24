import {
  ageOn,
  bodyFatRating,
  calculateTrend,
  dailyAverages,
  fitnessAge,
  summarizeBiomarker,
  vo2MaxPercentile,
  vo2MaxRating,
} from "./index";
import type { HealthSample } from "@/services/health/types";

const now = new Date("2026-10-24T12:00:00");

function daily(values: number[], unit = "kg"): HealthSample[] {
  // Oldest first, the last value is today.
  return values.map((value, index) => ({
    value,
    unit,
    timestamp: new Date(
      now.getTime() - (values.length - 1 - index) * 86_400_000,
    ).toISOString(),
  }));
}

describe("biomarker metrics", () => {
  it("averages readings per local day, oldest first", () => {
    const result = dailyAverages([
      { value: 60, unit: "ms", timestamp: "2026-10-23T22:00:00" },
      { value: 40, unit: "ms", timestamp: "2026-10-22T08:00:00" },
      { value: 80, unit: "ms", timestamp: "2026-10-23T07:00:00" },
    ]);
    expect(result.map((sample) => sample.value)).toEqual([40, 70]);
  });

  it("compares the last week with the month before it", () => {
    const falling = daily([...Array(30).fill(86), ...Array(7).fill(84.5)]);
    expect(calculateTrend("weight", falling, now)?.direction).toBe(
      "decreasing",
    );
    const flat = daily([...Array(30).fill(86), ...Array(7).fill(85.8)]);
    expect(calculateTrend("weight", flat, now)?.direction).toBe("stable");
    expect(calculateTrend("weight", daily([85]), now)).toBeNull();
  });

  it("works out whole years of age", () => {
    expect(ageOn("1990-10-24", now)).toBe(36);
    expect(ageOn("1990-10-25", now)).toBe(35);
  });

  it("places VO2 max against the reference median for age and sex", () => {
    expect(vo2MaxPercentile(39.7, 35, "male")).toBeCloseTo(50, 0);
    expect(vo2MaxPercentile(55.5, 35, "male")).toBeCloseTo(90, 0);
    expect(vo2MaxPercentile(18.6, 35, "female")).toBeCloseTo(10, 0);
    expect(vo2MaxRating(45).label).toBe("Good");
    expect(vo2MaxRating(10).label).toBe("Poor");
  });

  it("finds the age at which a VO2 max is the median", () => {
    expect(fitnessAge(39.7, "male")).toBeCloseTo(35, 5);
    expect(fitnessAge(37.5, "male")).toBeCloseTo(40, 5);
    expect(fitnessAge(28.3, "female")).toBeCloseTo(35, 5);
    expect(fitnessAge(80, "male")).toBe(20);
    expect(fitnessAge(10, "female")).toBe(89);
  });

  it("rates body fat by sex", () => {
    expect(bodyFatRating(27.8, "male").label).toBe("High");
    expect(bodyFatRating(27.8, "female").label).toBe("Average");
  });

  it("falls back to the trend when a rating needs a missing profile", () => {
    const history = daily([...Array(30).fill(40), ...Array(7).fill(42)], "");
    const unknown = summarizeBiomarker(
      "vo2Max",
      history,
      { birthDate: null, sex: null },
      now,
    );
    expect(unknown.status).toEqual({
      label: "Increasing",
      tone: "neutral",
      basis: "trend",
    });
    const known = summarizeBiomarker(
      "vo2Max",
      history,
      { birthDate: "1990-01-01", sex: "male" },
      now,
    );
    expect(known.status?.basis).toBe("rating");
  });
});
