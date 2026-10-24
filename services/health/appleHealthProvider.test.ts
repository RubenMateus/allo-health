import * as healthKit from "@kingstinct/react-native-healthkit";

import { AppleHealthProvider } from "./appleHealthProvider";

jest.mock("@kingstinct/react-native-healthkit", () => ({
  queryCategorySamples: jest.fn(),
  queryQuantitySamples: jest.fn(),
  queryStatisticsForQuantity: jest.fn(),
  queryStatisticsCollectionForQuantity: jest.fn(),
  queryWorkoutSamples: jest.fn(),
}));

const mocked = healthKit as jest.Mocked<typeof healthKit>;
const provider = () => new AppleHealthProvider(async () => mocked);

// Saturday 08:00 local time: the morning read that used to catch two nights.
const NOW = new Date(2026, 9, 24, 8, 0);
const at = (day: number, hour: number, minute = 0, second = 0) =>
  new Date(2026, 9, day, hour, minute, second);

const watch = {
  source: {
    name: "Ruben's Apple Watch",
    bundleIdentifier: "com.apple.health.81C9",
  },
  operatingSystemVersion: "11.0",
  productType: "Watch7,3",
};
const iPhone = {
  source: { name: "Ruben's iPhone", bundleIdentifier: "com.apple.health.4D2E" },
  operatingSystemVersion: "26.0",
  productType: "iPhone17,1",
};
const strava = {
  source: { name: "Strava", bundleIdentifier: "com.strava.stravaride" },
  operatingSystemVersion: "26.0",
};

type Revision = typeof watch | typeof strava;

const sleepSample = (
  value: number,
  startDate: Date,
  endDate: Date,
  sourceRevision: Revision,
) => ({
  uuid: `${sourceRevision.source.bundleIdentifier}-${startDate.toISOString()}`,
  categoryType: "HKCategoryTypeIdentifierSleepAnalysis",
  value,
  startDate,
  endDate,
  sourceRevision,
  metadata: {},
  hasUndeterminedDuration: false,
});

const quantitySample = (
  quantity: number,
  unit: string,
  endDate: Date,
  sourceRevision: Revision = watch,
) => ({
  uuid: `${quantity}-${endDate.toISOString()}`,
  quantity,
  unit,
  startDate: endDate,
  endDate,
  sourceRevision,
  metadata: {},
});

/** A Watch staged night: core / deep / core / REM / awake / core, in minutes. */
function watchNight(start: Date) {
  const stages: Array<[number, number]> = [
    [3, 60],
    [4, 75],
    [3, 90],
    [5, 45],
    [2, 10],
    [3, 120],
  ];
  let cursor = start.getTime();
  return stages.map(([value, minutes]) => {
    const begin = new Date(cursor);
    cursor += minutes * 60_000;
    return sleepSample(value, begin, new Date(cursor), watch);
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.resetAllMocks();
});

afterEach(() => jest.useRealTimers());

describe("AppleHealthProvider.getSleep", () => {
  it("reads only last night, once, when the Watch and iPhone both recorded it", async () => {
    mocked.queryCategorySamples.mockResolvedValue([
      // The night before last ends inside the 36-hour window at 08:00.
      ...watchNight(at(22, 23, 30)),
      // Last night from the Watch (390 min asleep, 10 min awake).
      ...watchNight(at(23, 23, 30)),
      // The iPhone's bedtime schedule writes in bed plus an unstaged asleep block.
      sleepSample(0, at(23, 23, 15), at(24, 6, 55), iPhone),
      sleepSample(1, at(23, 23, 40), at(24, 6, 30), iPhone),
    ] as never);

    const sleep = await provider().getSleep();

    expect(sleep).toEqual({
      durationMinutes: 390,
      needMinutes: 480,
      efficiency: 390 / 400,
      deepMinutes: 75,
      remMinutes: 45,
      lastSleepAt: at(24, 6, 10).toISOString(),
    });
  });

  it("prefers the night over an afternoon nap", async () => {
    jest.setSystemTime(at(24, 17));
    mocked.queryCategorySamples.mockResolvedValue([
      ...watchNight(at(23, 23, 30)),
      sleepSample(3, at(24, 14), at(24, 14, 40), watch),
    ] as never);

    const sleep = await provider().getSleep();

    expect(sleep?.durationMinutes).toBe(390);
  });

  it("returns null when nothing was recorded", async () => {
    mocked.queryCategorySamples.mockResolvedValue([]);
    expect(await provider().getSleep()).toBeNull();
  });
});

describe("AppleHealthProvider daily totals", () => {
  it("uses HealthKit's deduplicated sum from local midnight for active energy", async () => {
    mocked.queryStatisticsForQuantity.mockResolvedValue({
      sumQuantity: { unit: "kcal", quantity: 212.4 },
      sources: [],
    } as never);

    expect(await provider().getActiveEnergy()).toBe(212.4);
    expect(mocked.queryStatisticsForQuantity).toHaveBeenCalledWith(
      "HKQuantityTypeIdentifierActiveEnergyBurned",
      ["cumulativeSum"],
      {
        unit: "kcal",
        filter: { date: { startDate: at(24, 0), endDate: NOW } },
      },
    );
  });

  it("returns null nutrition when no source logged anything today", async () => {
    mocked.queryStatisticsForQuantity.mockResolvedValue({
      sources: [],
    } as never);
    expect(await provider().getNutrition()).toBeNull();
  });

  it("sums today's macros per type", async () => {
    const sums: Record<string, number> = {
      HKQuantityTypeIdentifierDietaryEnergyConsumed: 640,
      HKQuantityTypeIdentifierDietaryProtein: 42,
      HKQuantityTypeIdentifierDietaryCarbohydrates: 71.5,
      HKQuantityTypeIdentifierDietaryFatTotal: 19,
    };
    mocked.queryStatisticsForQuantity.mockImplementation(
      async (identifier) =>
        ({
          sumQuantity: { unit: "g", quantity: sums[identifier] },
          sources: [],
        }) as never,
    );
    expect(await provider().getNutrition()).toEqual({
      calories: 640,
      proteinGrams: 42,
      carbohydrateGrams: 71.5,
      fatGrams: 19,
    });
  });
});

describe("AppleHealthProvider heart rate", () => {
  it("counts today's minutes once even when the Watch samples every 5 seconds", async () => {
    // 30 minutes of workout readings at 5-second spacing, plus yesterday evening.
    const workout = Array.from({ length: 360 }, (_, index) =>
      quantitySample(
        150,
        "count/min",
        new Date(at(24, 7).getTime() + index * 5_000),
      ),
    );
    mocked.queryQuantitySamples.mockImplementation(async (identifier) => {
      if (identifier === "HKQuantityTypeIdentifierHeartRate")
        return [
          quantitySample(62, "count/min", at(23, 21)),
          ...workout,
        ] as never;
      if (identifier === "HKQuantityTypeIdentifierRestingHeartRate")
        return [quantitySample(54, "count/min", at(24, 6))] as never;
      return [] as never;
    });
    mocked.queryStatisticsForQuantity.mockResolvedValue({
      sources: [],
    } as never);

    const inputs = await provider().getStrainInputs();

    const minutes = inputs.heartRateSamples.reduce(
      (total, sample) => total + sample.sampleMinutes,
      0,
    );
    expect(minutes).toBe(30);
    expect(
      inputs.heartRateSamples.every((sample) => sample.value === 150),
    ).toBe(true);
    expect(inputs.restingHeartRate).toBe(54);
  });

  it("pairs each stress point with the HRV reading nearest in time", async () => {
    mocked.queryQuantitySamples.mockImplementation(async (identifier) => {
      if (identifier === "HKQuantityTypeIdentifierHeartRate")
        return [
          quantitySample(58, "count/min", at(24, 2, 2)),
          quantitySample(74, "count/min", at(24, 7, 52)),
        ] as never;
      if (identifier === "HKQuantityTypeIdentifierHeartRateVariabilitySDNN")
        return [
          quantitySample(61, "ms", at(24, 2, 30)),
          quantitySample(38, "ms", at(24, 7, 40)),
        ] as never;
      return [] as never;
    });

    const stress = await provider().getStressSamples();

    expect(stress).toEqual([
      { timestamp: at(24, 2, 5).toISOString(), heartRate: 58, hrv: 61 },
      { timestamp: at(24, 7, 55).toISOString(), heartRate: 74, hrv: 38 },
    ]);
  });

  it("ignores a resting heart rate older than a week", async () => {
    mocked.queryQuantitySamples.mockResolvedValue([]);
    expect(await provider().getRestingHR()).toBeNull();
    expect(mocked.queryQuantitySamples).toHaveBeenCalledWith(
      "HKQuantityTypeIdentifierRestingHeartRate",
      expect.objectContaining({
        limit: 1,
        ascending: false,
        filter: {
          date: {
            startDate: new Date(NOW.getTime() - 7 * 86_400_000),
            endDate: NOW,
          },
        },
      }),
    );
  });
});

describe("AppleHealthProvider.getWorkouts", () => {
  const workout = (
    uuid: string,
    workoutActivityType: number,
    startDate: Date,
    endDate: Date,
    sourceRevision: Revision,
    averageHeartRate?: number,
  ) => ({
    uuid,
    workoutActivityType,
    startDate,
    endDate,
    sourceRevision,
    totalEnergyBurned: { unit: "kcal", quantity: 412 },
    getStatistic: jest.fn(async () =>
      averageHeartRate
        ? { averageQuantity: { unit: "count/min", quantity: averageHeartRate } }
        : undefined,
    ),
  });

  it("keeps one copy of a run that Strava also wrote", async () => {
    mocked.queryWorkoutSamples.mockResolvedValue([
      workout("watch-run", 37, at(23, 7, 15), at(23, 8, 3), watch, 148),
      workout("strava-run", 37, at(23, 7, 15, 20), at(23, 8, 2), strava),
      workout("watch-lift", 50, at(23, 18), at(23, 18, 55), watch, 118),
    ] as never);
    mocked.queryQuantitySamples.mockResolvedValue([]);

    const workouts = await provider().getWorkouts(at(1, 0));

    expect(
      workouts.map((item) => [item.id, item.activity, item.category]),
    ).toEqual([
      ["watch-run", "Run", "cardio"],
      ["watch-lift", "Strength", "strength"],
    ]);
    expect(workouts[0]!.activeEnergyKcal).toBe(412);
    expect(workouts[0]!.heartRate.average).toBe(148);
  });
});

describe("AppleHealthProvider.getBiomarkerHistory", () => {
  it("converts HealthKit fractions to percent", async () => {
    mocked.queryStatisticsCollectionForQuantity.mockResolvedValue([
      {
        startDate: at(22, 0),
        averageQuantity: { unit: "%", quantity: 0.185 },
        sources: [],
      },
      { startDate: at(23, 0), sources: [] },
    ] as never);

    const history = await provider().getBiomarkerHistory("bodyFat", at(1, 9));

    expect(history).toEqual([
      { value: 18.5, unit: "%", timestamp: at(22, 0).toISOString() },
    ]);
    expect(mocked.queryStatisticsCollectionForQuantity).toHaveBeenCalledWith(
      "HKQuantityTypeIdentifierBodyFatPercentage",
      ["discreteAverage"],
      at(1, 0),
      { day: 1 },
      { unit: "%", filter: { date: { startDate: at(1, 0), endDate: NOW } } },
    );
  });
});
