import type { DistanceSample, Workout } from "@/services/health/types";

import {
  buildSplits,
  splitPace,
  totalWorkouts,
  trainingWeek,
  workoutKind,
  workoutStrain,
  workoutTitle,
} from "./workouts";

const at = (day: number, hour: number, minute = 0, second = 0) =>
  new Date(2026, 10, day, hour, minute, second).toISOString();

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w",
    activity: "Run",
    category: "cardio",
    startedAt: at(17, 7, 0),
    endedAt: at(17, 7, 30),
    activeEnergyKcal: 300,
    heartRate: { average: 150, peak: 170, recovery: 140 },
    ...overrides,
  };
}

/** One sample per minute at a steady pace. */
function steady(
  start: string,
  minutes: number,
  metersPerMinute: number,
): DistanceSample[] {
  const from = new Date(start).getTime();
  return Array.from({ length: minutes }, (_, minute) => ({
    startedAt: new Date(from + minute * 60_000).toISOString(),
    endedAt: new Date(from + (minute + 1) * 60_000).toISOString(),
    meters: metersPerMinute,
  }));
}

describe("workoutKind", () => {
  it("groups activities into the list filters", () => {
    expect(workoutKind(workout({ activity: "Long run" }))).toBe("run");
    expect(workoutKind(workout({ activity: "Ride" }))).toBe("ride");
    expect(workoutKind(workout({ activity: "Hike" }))).toBe("walk");
    expect(workoutKind(workout({ activity: "Swim" }))).toBe("swim");
    expect(workoutKind(workout({ activity: "Yoga", category: "mixed" }))).toBe(
      "other",
    );
    expect(
      workoutKind(workout({ activity: "Calisthenics", category: "strength" })),
    ).toBe("strength");
  });
});

describe("workoutTitle", () => {
  it("names generic workouts by time of day and keeps a name the app gave", () => {
    expect(workoutTitle(workout())).toBe("Morning run");
    expect(
      workoutTitle(workout({ activity: "Strength", startedAt: at(17, 18) })),
    ).toBe("Evening strength");
    expect(workoutTitle(workout({ activity: "Tempo with the club" }))).toBe(
      "Tempo with the club",
    );
  });
});

describe("buildSplits", () => {
  it("cuts whole kilometres and a short final split", () => {
    // 200 m a minute for 26 minutes: 5.2 km, so five 5-minute splits and 200 m.
    const splits = buildSplits(steady(at(17, 7), 26, 200), at(17, 7));
    expect(splits).toHaveLength(6);
    expect(splits.slice(0, 5).every((split) => split.seconds === 300)).toBe(
      true,
    );
    expect(splits[5]).toMatchObject({
      meters: 200,
      seconds: 60,
      complete: false,
    });
    expect(splitPace(splits[5]!)).toBe(300);
  });

  it("interpolates a boundary inside a sample", () => {
    // 600 m in the first two minutes, then 800 m in one minute.
    const samples: DistanceSample[] = [
      { startedAt: at(17, 7, 0), endedAt: at(17, 7, 2), meters: 600 },
      { startedAt: at(17, 7, 2), endedAt: at(17, 7, 3), meters: 800 },
    ];
    const [first] = buildSplits(samples, at(17, 7));
    // The last 400 m of the first km take half of the second sample's minute.
    expect(first!.seconds).toBe(150);
  });

  it("averages heart rate over each split's minutes", () => {
    const trace = [120, 130, 140, 150, 0, 160];
    const splits = buildSplits(steady(at(17, 7), 6, 500), at(17, 7), trace);
    expect(splits.map((split) => split.heartRate)).toEqual([125, 145, 160]);
  });

  it("counts elapsed time across a pause", () => {
    const samples: DistanceSample[] = [
      { startedAt: at(17, 7, 0), endedAt: at(17, 7, 3), meters: 500 },
      { startedAt: at(17, 7, 8), endedAt: at(17, 7, 11), meters: 500 },
    ];
    expect(buildSplits(samples, at(17, 7))[0]!.seconds).toBe(11 * 60);
  });

  it("returns nothing without distance", () => {
    expect(buildSplits([], at(17, 7))).toEqual([]);
  });
});

describe("workoutStrain", () => {
  const profile = { restingHeartRate: 55, maxHeartRate: 190 };

  it("rates a harder session higher on the 0-21 scale", () => {
    const easy = workoutStrain(
      workout({ heartRateByMinute: Array(45).fill(120) }),
      profile,
    );
    const hard = workoutStrain(
      workout({ heartRateByMinute: Array(45).fill(175) }),
      profile,
    );
    expect(hard).toBeGreaterThan(easy);
    expect(hard).toBeLessThanOrEqual(21);
  });

  it("falls back to the average heart rate without a trace", () => {
    expect(workoutStrain(workout(), profile)).toBeGreaterThan(0);
  });
});

describe("trainingWeek", () => {
  it("totals Monday to Sunday of the current week", () => {
    const profile = { restingHeartRate: 55, maxHeartRate: 190 };
    // Tuesday 17 November 2026.
    const week = trainingWeek(
      [
        workout({ id: "mon", startedAt: at(16, 7), endedAt: at(16, 7, 40) }),
        workout({ id: "tue", startedAt: at(17, 7), endedAt: at(17, 7, 30) }),
        workout({ id: "last", startedAt: at(15, 7), endedAt: at(15, 8) }),
      ],
      profile,
      new Date(2026, 10, 17, 12),
    );
    expect(week.days[0]!.date).toBe("2026-11-16");
    expect(week.sessions).toBe(2);
    expect(week.minutes).toBe(70);
    expect(week.days[1]!.isToday).toBe(true);
    expect(week.days[2]!.isFuture).toBe(true);
    expect(week.strain).toBeCloseTo(
      week.days[0]!.strain + week.days[1]!.strain,
    );
  });
});

describe("totalWorkouts", () => {
  it("adds distance and energy, skipping missing values", () => {
    expect(
      totalWorkouts([
        workout({ distanceMeters: 5000 }),
        workout({ distanceMeters: null, activeEnergyKcal: null }),
      ]),
    ).toEqual({
      sessions: 2,
      minutes: 60,
      distanceMeters: 5000,
      energyKcal: 300,
    });
  });
});
