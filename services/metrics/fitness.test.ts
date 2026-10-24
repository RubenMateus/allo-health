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
  summarizeStrength,
  summarizeTrainingMix,
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
      cardioLoad: 0,
      muscularLoad: 0,
      energyKcal: 0,
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
    // Three equal thirds need two units of remainder to reach 100.
    expect(
      calculateCardioFocus(
        [
          workout({ minutes: 30, heartRate: hr(130) }),
          workout({ minutes: 30, heartRate: hr(160) }),
          workout({ minutes: 30, heartRate: hr(180) }),
        ],
        profile,
      ),
    ).toEqual({ aerobic: 34, threshold: 33, anaerobic: 33 });
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

  it("summarizes strength sessions per rolling week", () => {
    const end = new Date("2026-10-24T12:00:00.000");
    const lift = (
      startedAt: string,
      kcal: number | null,
      average: number | null,
    ) =>
      workout({
        category: "strength",
        startedAt,
        minutes: 45,
        activeEnergyKcal: kcal,
        heartRate: { average, peak: null, recovery: null },
      });
    expect(
      summarizeStrength(
        [
          lift("2026-10-24T07:00:00.000", 300, 120),
          lift("2026-10-20T07:00:00.000", null, 110),
          lift("2026-10-10T07:00:00.000", 250, null),
          lift("2026-09-01T07:00:00.000", 200, 100),
          workout({ startedAt: "2026-10-23T07:00:00.000" }),
        ],
        end,
      ),
    ).toEqual({
      sessions: 4,
      minutes: 180,
      activeEnergyKcal: 750,
      averageHeartRate: 110,
      weekly: [0, 1, 0, 2],
    });
  });

  it("splits training minutes by category", () => {
    expect(
      summarizeTrainingMix([
        workout({ minutes: 100 }),
        workout({ minutes: 50, category: "strength" }),
        workout({ minutes: 50, category: "cardio" }),
      ]),
    ).toEqual([
      { category: "cardio", minutes: 150, share: 75 },
      { category: "strength", minutes: 50, share: 25 },
    ]);
    expect(summarizeTrainingMix([])).toEqual([]);
  });
});
