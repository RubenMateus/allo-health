import * as healthConnect from "react-native-health-connect";

import { HealthConnectProvider } from "./healthConnectProvider";

jest.mock("react-native-health-connect", () => ({
  initialize: jest.fn(),
  readRecords: jest.fn(),
  aggregateRecord: jest.fn(),
  requestPermission: jest.fn(),
  getGrantedPermissions: jest.fn(),
}));

const mocked = healthConnect as jest.Mocked<typeof healthConnect>;
const provider = () => new HealthConnectProvider(async () => mocked);

const NOW = new Date(2026, 9, 24, 8, 0);
const at = (day: number, hour: number, minute = 0, second = 0) =>
  new Date(2026, 9, day, hour, minute, second).toISOString();

const SAMSUNG = "com.sec.android.app.shealth";
const PIXEL_WATCH = "com.google.android.apps.fitness";
const metadata = (dataOrigin: string, id: string) => ({
  id,
  dataOrigin,
  lastModifiedTime: at(24, 7),
  recordingMethod: 2,
});

type Records = Partial<Record<string, unknown[]>>;

/** Serves readRecords like Health Connect: one page per type, oldest first, by origin. */
function serve(records: Records) {
  mocked.readRecords.mockImplementation(async (recordType, options) => {
    const origins = options.dataOriginFilter;
    return {
      records: (records[recordType] ?? []).filter(
        (record) =>
          !origins ||
          origins.includes(
            (record as { metadata: { dataOrigin: string } }).metadata
              .dataOrigin,
          ),
      ),
      pageToken: "",
    } as never;
  });
}

/** A staged night: light / deep / light / REM / awake / light, in minutes. */
function night(start: string, id: string, origin = SAMSUNG) {
  const stages: Array<[number, number]> = [
    [4, 60],
    [5, 75],
    [4, 90],
    [6, 45],
    [1, 10],
    [4, 120],
  ];
  let cursor = new Date(start).getTime();
  const staged = stages.map(([stage, minutes]) => {
    const startTime = new Date(cursor).toISOString();
    cursor += minutes * 60_000;
    return { stage, startTime, endTime: new Date(cursor).toISOString() };
  });
  return {
    startTime: start,
    endTime: new Date(cursor).toISOString(),
    stages: staged,
    metadata: metadata(origin, id),
  };
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.resetAllMocks();
});

afterEach(() => jest.useRealTimers());

describe("HealthConnectProvider.getSleep", () => {
  it("reads last night when the window also holds the night before", async () => {
    serve({
      SleepSession: [night(at(22, 23, 30), "n1"), night(at(23, 23, 30), "n2")],
    });

    expect(await provider().getSleep()).toEqual({
      durationMinutes: 390,
      needMinutes: 480,
      efficiency: 390 / 400,
      deepMinutes: 75,
      remMinutes: 45,
      lastSleepAt: at(24, 6, 10),
    });
  });

  it("keeps the night when a later nap was logged", async () => {
    jest.setSystemTime(new Date(2026, 9, 24, 17));
    serve({
      SleepSession: [
        night(at(23, 23, 30), "night"),
        {
          startTime: at(24, 14),
          endTime: at(24, 14, 40),
          metadata: metadata(SAMSUNG, "nap"),
        },
      ],
    });

    expect((await provider().getSleep())?.durationMinutes).toBe(390);
  });
});

describe("HealthConnectProvider daily totals", () => {
  it("uses Health Connect's aggregate for active calories from local midnight", async () => {
    mocked.aggregateRecord.mockResolvedValue({
      ACTIVE_CALORIES_TOTAL: {
        inCalories: 318_000,
        inJoules: 1_330_512,
        inKilocalories: 318,
        inKilojoules: 1330.5,
      },
      dataOrigins: [SAMSUNG, PIXEL_WATCH],
    } as never);

    expect(await provider().getActiveEnergy()).toBe(318);
    expect(mocked.aggregateRecord).toHaveBeenCalledWith({
      recordType: "ActiveCaloriesBurned",
      timeRangeFilter: {
        operator: "between",
        startTime: at(24, 0),
        endTime: NOW.toISOString(),
      },
    });
  });

  it("reads nutrition totals in kcal and grams", async () => {
    mocked.aggregateRecord.mockResolvedValue({
      ENERGY_TOTAL: { inKilocalories: 640 },
      PROTEIN_TOTAL: { inGrams: 42 },
      TOTAL_CARBOHYDRATE_TOTAL: { inGrams: 71.5 },
      TOTAL_FAT_TOTAL: { inGrams: 19 },
      dataOrigins: ["com.myfitnesspal.android"],
    } as never);

    expect(await provider().getNutrition()).toEqual({
      calories: 640,
      proteinGrams: 42,
      carbohydrateGrams: 71.5,
      fatGrams: 19,
    });
  });

  it("returns null nutrition when no app logged a meal today", async () => {
    mocked.aggregateRecord.mockResolvedValue({ dataOrigins: [] } as never);
    expect(await provider().getNutrition()).toBeNull();
  });
});

describe("HealthConnectProvider heart rate", () => {
  it("counts today's minutes once for a dense heart-rate series", async () => {
    serve({
      HeartRate: [
        {
          startTime: at(24, 7),
          endTime: at(24, 7, 30),
          samples: Array.from({ length: 360 }, (_, index) => ({
            time: new Date(
              new Date(at(24, 7)).getTime() + index * 5_000,
            ).toISOString(),
            beatsPerMinute: 150,
          })),
          metadata: metadata(PIXEL_WATCH, "hr"),
        },
      ],
      RestingHeartRate: [
        {
          time: at(23, 6),
          beatsPerMinute: 55,
          metadata: metadata(SAMSUNG, "r1"),
        },
        {
          time: at(24, 6),
          beatsPerMinute: 53,
          metadata: metadata(SAMSUNG, "r2"),
        },
      ],
    });
    mocked.aggregateRecord.mockResolvedValue({ dataOrigins: [] } as never);

    const inputs = await provider().getStrainInputs();

    expect(
      inputs.heartRateSamples.reduce(
        (total, sample) => total + sample.sampleMinutes,
        0,
      ),
    ).toBe(30);
    expect(inputs.restingHeartRate).toBe(53);
  });

  it("keeps stress neutral on HRV when the watch writes none", async () => {
    serve({
      HeartRate: [
        {
          startTime: at(24, 7, 50),
          endTime: at(24, 7, 52),
          samples: [{ time: at(24, 7, 51), beatsPerMinute: 72 }],
          metadata: metadata(SAMSUNG, "hr"),
        },
      ],
    });

    expect(await provider().getStressSamples()).toEqual([
      { timestamp: at(24, 7, 55), heartRate: 72, hrv: 48 },
    ]);
  });
});

describe("HealthConnectProvider.getWorkouts", () => {
  it("reads the recording app's heart rate and drops a copy from another app", async () => {
    serve({
      ExerciseSession: [
        {
          startTime: at(23, 7, 15),
          endTime: at(23, 8, 3),
          exerciseType: 56,
          metadata: metadata(PIXEL_WATCH, "run"),
        },
        {
          startTime: at(23, 7, 15),
          endTime: at(23, 8, 3),
          exerciseType: 56,
          title: "Morning Run",
          metadata: metadata("com.strava", "strava-run"),
        },
        {
          startTime: at(23, 18),
          endTime: at(23, 18, 50),
          exerciseType: 81,
          metadata: metadata(SAMSUNG, "lift"),
        },
      ],
      HeartRate: [
        {
          startTime: at(23, 7, 15),
          endTime: at(23, 8, 5),
          samples: [
            { time: at(23, 7, 30), beatsPerMinute: 140 },
            { time: at(23, 7, 50), beatsPerMinute: 160 },
          ],
          metadata: metadata(PIXEL_WATCH, "hr-watch"),
        },
        {
          // The phone's optical reading of the same run would skew the average.
          startTime: at(23, 7, 15),
          endTime: at(23, 8, 3),
          samples: [{ time: at(23, 7, 40), beatsPerMinute: 95 }],
          metadata: metadata(SAMSUNG, "hr-phone"),
        },
      ],
    });
    mocked.aggregateRecord.mockResolvedValue({
      ACTIVE_CALORIES_TOTAL: { inKilocalories: 455 },
      dataOrigins: [PIXEL_WATCH],
    } as never);

    const workouts = await provider().getWorkouts(new Date(2026, 9, 1));

    expect(
      workouts.map((item) => [item.id, item.activity, item.category]),
    ).toEqual([
      ["run", "Run", "cardio"],
      ["lift", "Strength", "strength"],
    ]);
    expect(workouts[0]!.heartRate.average).toBe(150);
    expect(workouts[0]!.activeEnergyKcal).toBe(455);
  });
});

describe("HealthConnectProvider.getBiomarkerHistory", () => {
  it("averages each local day and keeps percentages as 0-100", async () => {
    serve({
      BodyFat: [
        {
          time: at(22, 7),
          percentage: 18.2,
          metadata: metadata(SAMSUNG, "b1"),
        },
        {
          time: at(22, 21),
          percentage: 18.6,
          metadata: metadata(SAMSUNG, "b2"),
        },
        {
          time: at(23, 7),
          percentage: 18.1,
          metadata: metadata(SAMSUNG, "b3"),
        },
      ],
    });

    const history = await provider().getBiomarkerHistory(
      "bodyFat",
      new Date(2026, 9, 1),
    );

    expect(history.map((sample) => [sample.timestamp, sample.value])).toEqual([
      [at(22, 0), expect.closeTo(18.4)],
      [at(23, 0), 18.1],
    ]);
  });
});
