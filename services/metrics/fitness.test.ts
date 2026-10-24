import type { HeartRateProfile } from "./fitness";
import {
  buildFitnessDays,
  calculateAcuteChronicRatio,
  calculateCardioFocus,
  calculateLoadChange,
  calculateTrainingLoad,
  heartRateRecoveries,
  heartRateRecoveryRating,
  summarizeActivity,
  summarizeStrengthVolume,
  summarizeWorkoutHeartRate,
} from "./index";
import type { Workout } from "@/services/health/types";

const profile: HeartRateProfile = { restingHeartRate: 60, maxHeartRate: 190 };

function workout(
  overrides: Partial<Workout> & { minutes?: number } = {},
): Workout {
  const { minutes = 60, ...rest } = overrides;
  const startedAt = rest.startedAt ?? "2026-10-20T08:00:00.000";
  return {
    id: "w",
    activity: "Run",
    category: "cardio",
    startedAt,
    endedAt: new Date(
      new Date(startedAt).getTime() + minutes * 60_000,
    ).toISOString(),
    activeEnergyKcal: null,
    heartRate: { average: null, peak: null, recovery: null },
    ...rest,
  };
}

describe("fitness metrics", () => {
  it("weights training load by heart-rate reserve", () => {
    const easy = calculateTrainingLoad(
      workout({ heartRate: { average: 100, peak: null, recovery: null } }),
      profile,
    );
    const hard = calculateTrainingLoad(
      workout({ heartRate: { average: 170, peak: null, recovery: null } }),
      profile,
    );
    expect(easy).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(easy * 3);
    expect(calculateTrainingLoad(workout(), profile)).toBe(65.4);
  });

  it("buckets workouts into local days and ignores ones outside the window", () => {
    const end = new Date("2026-10-24T12:00:00.000");
    const days = buildFitnessDays(
      [
        workout({ startedAt: "2026-10-24T07:00:00.000", minutes: 30 }),
        workout({ startedAt: "2026-10-24T18:00:00.000", minutes: 45 }),
        workout({ startedAt: "2026-10-22T07:00:00.000", minutes: 20 }),
        workout({ startedAt: "2026-09-01T07:00:00.000", minutes: 90 }),
      ],
      profile,
      end,
      3,
    );
    expect(days.map((day) => day.date)).toEqual([
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
    expect(days.map((day) => day.sessions)).toEqual([1, 0, 2]);
    expect(days[2]?.minutes).toBe(75);
  });

  it("summarizes cumulative activity and only compares against a period with data", () => {
    const day = (minutes: number, sessions = minutes ? 1 : 0) => ({
      date: "",
      minutes,
      sessions,
      load: 0,
    });
    expect(summarizeActivity([day(30), day(0), day(45)], [day(20)])).toEqual({
      totalMinutes: 75,
      previousMinutes: 20,
      cumulativeMinutes: [30, 30, 75],
    });
    expect(summarizeActivity([day(30)], [day(0)]).previousMinutes).toBeNull();
  });

  it("computes the acute:chronic workload ratio", () => {
    const steady = calculateAcuteChronicRatio(Array(28).fill(50));
    expect(steady.ratio).toBe(1);
    expect(steady.status).toBe("OPTIMAL");
    expect(steady.trend).toHaveLength(14);

    const spike = calculateAcuteChronicRatio([
      ...Array(21).fill(20),
      ...Array(7).fill(80),
    ]);
    expect(spike.ratio).toBeGreaterThan(1.5);
    expect(spike.status).toBe("SPIKE");

    expect(calculateAcuteChronicRatio(Array(28).fill(0))).toMatchObject({
      ratio: null,
      status: "NO DATA",
      trend: [],
    });
  });

  it("reports load change between halves of the window", () => {
    expect(calculateLoadChange([10, 10, 11, 11])).toBe(10);
    expect(calculateLoadChange([0, 0, 5, 5])).toBeNull();
  });

  it("splits cardio minutes into zones that add up to 100%", () => {
    const hr = (average: number) => ({ average, peak: null, recovery: null });
    const focus = calculateCardioFocus(
      [
        workout({ minutes: 60, heartRate: hr(130) }),
        workout({ minutes: 20, heartRate: hr(160) }),
        workout({ minutes: 10, heartRate: hr(180) }),
        workout({ minutes: 45, category: "strength", heartRate: hr(180) }),
      ],
      profile,
    );
    expect(focus).toEqual({ aerobic: 67, threshold: 22, anaerobic: 11 });
    expect(calculateCardioFocus([workout()], profile)).toBeNull();
  });

  it("derives heart-rate recovery from samples around the end of a workout", () => {
    const sample = (iso: string, value: number) => ({
      value,
      unit: "bpm",
      timestamp: iso,
    });
    const summary = summarizeWorkoutHeartRate(
      [
        sample("2026-10-20T07:59:00.000Z", 70),
        sample("2026-10-20T08:20:00.000Z", 150),
        sample("2026-10-20T08:29:30.000Z", 172),
        sample("2026-10-20T08:30:58.000Z", 128),
        sample("2026-10-20T08:31:40.000Z", 120),
      ],
      "2026-10-20T08:00:00.000Z",
      "2026-10-20T08:30:00.000Z",
    );
    expect(summary).toEqual({ average: 161, peak: 172, recovery: 128 });
    expect(heartRateRecoveries([workout({ heartRate: summary })])).toEqual([
      44,
    ]);
    expect(heartRateRecoveryRating(44)).toBe("Excellent");
    expect(heartRateRecoveryRating(10)).toBe("Low");
  });

  it("totals strength volume per muscle group", () => {
    expect(summarizeStrengthVolume([workout()])).toBeNull();
    expect(
      summarizeStrengthVolume([
        workout({
          category: "strength",
          strengthVolumeKg: { chest: 1200.4, arms: 300 },
        }),
        workout({
          category: "strength",
          strengthVolumeKg: { chest: 800, legs: 1500 },
        }),
      ]),
    ).toEqual({
      byGroup: { chest: 2000, back: 0, legs: 1500, core: 0, arms: 300 },
      totalKg: 3800,
    });
  });
});
