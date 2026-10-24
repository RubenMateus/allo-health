import type {
  BiomarkerKind,
  GlucoseData,
  HealthProfile,
  HealthProvider,
  HealthSample,
  NutritionData,
  PermissionResult,
  SleepData,
  StrainInputs,
  StressSample,
  Workout,
  WorkoutCategory,
} from "./types";
import {
  dayKey,
  heartRateByMinute,
  summarizeWorkoutHeartRate,
} from "@/services/metrics/fitness";
import {
  LATEST_READING_DAYS,
  SAMPLE_BUCKET_MINUTES,
  bucketSamples,
  buildStressSamples,
  clusterIntervals,
  dedupeWorkouts,
  pickMainSleep,
  unionMinutes,
} from "./nativeSamples";

const now = () => new Date();
const recentWindow = () => ({
  startDate: new Date(Date.now() - 36 * 60 * 60_000),
  endDate: now(),
});
const todayStart = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

// HKWorkoutActivityType raw values.
const workoutLabels: Record<number, string> = {
  11: "Cross training",
  13: "Ride",
  20: "Strength",
  24: "Hike",
  29: "Mind & body",
  33: "Recovery",
  35: "Row",
  37: "Run",
  46: "Swim",
  50: "Strength",
  52: "Walk",
  57: "Yoga",
  59: "Core",
  62: "Flexibility",
  63: "Intervals",
  66: "Pilates",
  73: "Mixed cardio",
  80: "Cooldown",
};
const strengthTypes = new Set([20, 50, 59]);
const mixedTypes = new Set([29, 33, 57, 62, 66, 80]);

type QuantitySample = {
  quantity: number;
  unit: string;
  startDate: Date;
  endDate: Date;
};

// HKCategoryValueSleepAnalysis raw values.
const sleepValues = {
  inBed: 0,
  asleepUnspecified: 1,
  awake: 2,
  asleepCore: 3,
  asleepDeep: 4,
  asleepREM: 5,
} as const;
const asleepValues = new Set<number>([
  sleepValues.asleepUnspecified,
  sleepValues.asleepCore,
  sleepValues.asleepDeep,
  sleepValues.asleepREM,
]);
const stagedValues = new Set<number>([
  sleepValues.asleepCore,
  sleepValues.asleepDeep,
  sleepValues.asleepREM,
]);

// The types the app has asked for since the first release. A launch only re-attaches
// when these were answered, so adding new types never drops an existing connection.
const coreReadTypes = [
  "HKCategoryTypeIdentifierSleepAnalysis",
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierDietaryEnergyConsumed",
  "HKQuantityTypeIdentifierDietaryProtein",
  "HKQuantityTypeIdentifierDietaryCarbohydrates",
  "HKQuantityTypeIdentifierDietaryFatTotal",
  "HKQuantityTypeIdentifierBloodGlucose",
  "HKQuantityTypeIdentifierRespiratoryRate",
  "HKWorkoutTypeIdentifier",
] as const;

const biomarkerTypes = {
  weight: { identifier: "HKQuantityTypeIdentifierBodyMass", unit: "kg" },
  hrv: {
    identifier: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
    unit: "ms",
  },
  restingHeartRate: {
    identifier: "HKQuantityTypeIdentifierRestingHeartRate",
    unit: "count/min",
  },
  bodyFat: {
    identifier: "HKQuantityTypeIdentifierBodyFatPercentage",
    unit: "%",
  },
  leanBodyMass: {
    identifier: "HKQuantityTypeIdentifierLeanBodyMass",
    unit: "kg",
  },
  vo2Max: { identifier: "HKQuantityTypeIdentifierVO2Max", unit: "ml/(kg*min)" },
  bloodOxygen: {
    identifier: "HKQuantityTypeIdentifierOxygenSaturation",
    unit: "%",
  },
  respiratoryRate: {
    identifier: "HKQuantityTypeIdentifierRespiratoryRate",
    unit: "count/min",
  },
} as const satisfies Record<
  BiomarkerKind,
  { identifier: string; unit: string }
>;

const biomarkerUnits: Record<BiomarkerKind, string> = {
  weight: "kg",
  hrv: "ms",
  restingHeartRate: "bpm",
  bodyFat: "%",
  leanBodyMass: "kg",
  vo2Max: "ml/kg/min",
  bloodOxygen: "%",
  respiratoryRate: "br/min",
};

// HealthKit reports percentages as fractions (0.278 for 27.8%).
const fractionKinds = new Set<BiomarkerKind>(["bodyFat", "bloodOxygen"]);

const readTypes = [
  ...coreReadTypes,
  "HKQuantityTypeIdentifierBodyMass",
  "HKQuantityTypeIdentifierBodyFatPercentage",
  "HKQuantityTypeIdentifierLeanBodyMass",
  "HKQuantityTypeIdentifierVO2Max",
  "HKQuantityTypeIdentifierOxygenSaturation",
  "HKCharacteristicTypeIdentifierDateOfBirth",
  "HKCharacteristicTypeIdentifierBiologicalSex",
] as const;

type HealthKitModule = typeof import("@kingstinct/react-native-healthkit");

export class AppleHealthProvider implements HealthProvider {
  readonly kind = "apple" as const;

  constructor(
    // Loaded lazily so other platforms never touch the native module.
    private readonly loadHealthKit: () => Promise<HealthKitModule> = () =>
      import("@kingstinct/react-native-healthkit"),
  ) {}

  async requestPermissions(): Promise<PermissionResult> {
    const healthKit = await this.loadHealthKit();
    if (!(await healthKit.isHealthDataAvailableAsync()))
      return {
        state: "denied",
        grantedTypes: 0,
        requestedTypes: readTypes.length,
      };
    const completed = await healthKit.requestAuthorization({
      toRead: readTypes,
    });
    // HealthKit intentionally does not reveal per-type read grants to apps.
    return {
      state: completed ? "granted" : "denied",
      grantedTypes: completed ? readTypes.length : 0,
      requestedTypes: readTypes.length,
    };
  }

  async getConnectionStatus(): Promise<PermissionResult | null> {
    const healthKit = await this.loadHealthKit();
    if (!(await healthKit.isHealthDataAvailableAsync())) return null;
    // "unnecessary" means the prompt was already answered; HealthKit hides read grants,
    // so re-attaching is safe and simply returns no samples for declined types.
    const status = await healthKit.getRequestStatusForAuthorization({
      toRead: coreReadTypes,
    });
    return status === healthKit.AuthorizationRequestStatus.unnecessary
      ? {
          state: "granted",
          grantedTypes: readTypes.length,
          requestedTypes: readTypes.length,
        }
      : null;
  }

  private async quantity<
    T extends Parameters<
      (typeof import("@kingstinct/react-native-healthkit"))["queryQuantitySamples"]
    >[0],
  >(
    identifier: T,
    unit?: string,
    {
      date = recentWindow(),
      limit = 0,
      ascending = true,
    }: {
      date?: { startDate: Date; endDate: Date };
      limit?: number;
      ascending?: boolean;
    } = {},
  ): Promise<QuantitySample[]> {
    const healthKit = await this.loadHealthKit();
    // Always bound queries: an unfiltered heart-rate query returns years of samples.
    const result = await healthKit.queryQuantitySamples(identifier, {
      limit,
      ascending,
      ...(unit ? { unit } : {}),
      filter: { date },
    } as never);
    return result as unknown as QuantitySample[];
  }

  /** HealthKit's own sum for the window, which counts iPhone and Watch overlap once. */
  private async sum(
    identifier: Parameters<
      (typeof import("@kingstinct/react-native-healthkit"))["queryStatisticsForQuantity"]
    >[0],
    unit: string,
    startDate: Date,
    endDate = now(),
  ): Promise<number> {
    const healthKit = await this.loadHealthKit();
    const result = await healthKit.queryStatisticsForQuantity(
      identifier,
      ["cumulativeSum"],
      { unit, filter: { date: { startDate, endDate } } } as never,
    );
    return result.sumQuantity?.quantity ?? 0;
  }

  /** The newest reading from the last week; an older one isn't today's value. */
  private async latest(
    identifier: Parameters<
      (typeof import("@kingstinct/react-native-healthkit"))["queryQuantitySamples"]
    >[0],
    unit: string,
  ): Promise<number | null> {
    const samples = await this.quantity(identifier, unit, {
      date: {
        startDate: new Date(Date.now() - LATEST_READING_DAYS * 86_400_000),
        endDate: now(),
      },
      limit: 1,
      ascending: false,
    });
    return samples[0]?.quantity ?? null;
  }

  async getSleep(): Promise<SleepData | null> {
    const healthKit = await this.loadHealthKit();
    const samples = await healthKit.queryCategorySamples(
      "HKCategoryTypeIdentifierSleepAnalysis",
      { limit: 0, ascending: true, filter: { date: recentWindow() } },
    );
    const intervals = samples.map((sample) => ({
      start: sample.startDate.getTime(),
      end: sample.endDate.getTime(),
      value: Number(sample.value),
      source: sample.sourceRevision?.source?.bundleIdentifier ?? "",
    }));
    // The Watch, the iPhone and sleep apps each write the same night. Adding them up
    // doubled the total, so read one source: the one with stages, else the most sleep.
    const sources = new Map<string, typeof intervals>();
    for (const interval of intervals)
      sources.set(interval.source, [
        ...(sources.get(interval.source) ?? []),
        interval,
      ]);
    const nights = [...sources.values()].flatMap((sourceIntervals) =>
      clusterIntervals(sourceIntervals).map((night) => {
        const asleep = night.filter((interval) =>
          asleepValues.has(interval.value),
        );
        return {
          night,
          asleep,
          staged: asleep.some((interval) => stagedValues.has(interval.value)),
          start: Math.min(...night.map((interval) => interval.start)),
          end: Math.max(...night.map((interval) => interval.end)),
          asleepMinutes: unionMinutes(asleep),
        };
      }),
    );
    const main = pickMainSleep(nights, now());
    if (!main) return null;
    // Prefer staged data (Watch) for the same night over another source's summary.
    const chosen =
      nights
        .filter(
          (night) =>
            night.staged &&
            night.start < main.end &&
            night.end > main.start &&
            night.asleepMinutes >= main.asleepMinutes * 0.5,
        )
        .sort((a, b) => b.asleepMinutes - a.asleepMinutes)[0] ?? main;
    const stageMinutes = (value: number) =>
      unionMinutes(
        chosen.asleep.filter((interval) => interval.value === value),
      );
    return {
      durationMinutes: chosen.asleepMinutes,
      needMinutes: 480,
      // Time asleep over the whole night, in bed and awake included.
      efficiency: Math.min(
        chosen.asleepMinutes /
          Math.max((chosen.end - chosen.start) / 60_000, 1),
        1,
      ),
      deepMinutes: stageMinutes(sleepValues.asleepDeep),
      remMinutes: stageMinutes(sleepValues.asleepREM),
      lastSleepAt: new Date(
        Math.max(...chosen.asleep.map((interval) => interval.end)),
      ).toISOString(),
    };
  }

  async getHeartRate(): Promise<HealthSample[]> {
    const samples = await this.quantity(
      "HKQuantityTypeIdentifierHeartRate",
      "count/min",
    );
    return samples.map((sample) => ({
      value: sample.quantity,
      unit: "bpm",
      timestamp: sample.endDate.toISOString(),
    }));
  }

  async getHRV(): Promise<HealthSample[]> {
    const samples = await this.quantity(
      "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
      "ms",
    );
    return samples.map((sample) => ({
      value: sample.quantity,
      unit: "ms",
      timestamp: sample.endDate.toISOString(),
    }));
  }

  async getRestingHR(): Promise<number | null> {
    return this.latest("HKQuantityTypeIdentifierRestingHeartRate", "count/min");
  }

  async getRespiratoryRate(): Promise<number | null> {
    return this.latest("HKQuantityTypeIdentifierRespiratoryRate", "count/min");
  }

  async getActiveEnergy(): Promise<number> {
    return this.sum(
      "HKQuantityTypeIdentifierActiveEnergyBurned",
      "kcal",
      todayStart(),
    );
  }

  async getStrainInputs(): Promise<StrainInputs> {
    const [heartRateSamples, activeEnergyKcal, resting] = await Promise.all([
      this.getHeartRate(),
      this.getActiveEnergy(),
      this.getRestingHR(),
    ]);
    return {
      // Today's heart rate only, in five-minute buckets.
      heartRateSamples: bucketSamples(
        heartRateSamples,
        todayStart(),
        now(),
      ).map((sample) => ({ ...sample, sampleMinutes: SAMPLE_BUCKET_MINUTES })),
      activeEnergyKcal,
      restingHeartRate: resting ?? 60,
      maxHeartRate: 190,
    };
  }

  async getNutrition(): Promise<NutritionData | null> {
    const start = todayStart();
    const [calories, proteinGrams, carbohydrateGrams, fatGrams] =
      await Promise.all([
        this.sum(
          "HKQuantityTypeIdentifierDietaryEnergyConsumed",
          "kcal",
          start,
        ),
        this.sum("HKQuantityTypeIdentifierDietaryProtein", "g", start),
        this.sum("HKQuantityTypeIdentifierDietaryCarbohydrates", "g", start),
        this.sum("HKQuantityTypeIdentifierDietaryFatTotal", "g", start),
      ]);
    return calories || proteinGrams || carbohydrateGrams || fatGrams
      ? { calories, proteinGrams, carbohydrateGrams, fatGrams }
      : null;
  }

  async getGlucose(): Promise<GlucoseData | null> {
    const samples = await this.quantity(
      "HKQuantityTypeIdentifierBloodGlucose",
      "mg/dL",
    );
    const recent = samples.slice(-48).map((sample) => ({
      value: sample.quantity,
      unit: "mg/dL",
      timestamp: sample.endDate.toISOString(),
    }));
    return recent.length ? { samples: recent, unit: "mg/dL" } : null;
  }

  async getStressSamples(): Promise<StressSample[]> {
    const [heartRate, hrv] = await Promise.all([
      this.getHeartRate(),
      this.getHRV(),
    ]);
    return buildStressSamples(heartRate, hrv, now());
  }

  async getWorkouts(since: Date): Promise<Workout[]> {
    const healthKit = await this.loadHealthKit();
    const workouts = await healthKit.queryWorkoutSamples({
      limit: 0,
      ascending: true,
      filter: { date: { startDate: since, endDate: now() } },
    });
    const results = await Promise.all(
      workouts.map(async (workout): Promise<Workout> => {
        const type = Number(workout.workoutActivityType);
        const category: WorkoutCategory = strengthTypes.has(type)
          ? "strength"
          : mixedTypes.has(type)
            ? "mixed"
            : "cardio";
        const [average, samples] = await Promise.all([
          workout
            .getStatistic("HKQuantityTypeIdentifierHeartRate", "count/min")
            .catch(() => undefined),
          // The whole session for time in zones, plus two minutes after for recovery.
          this.quantity("HKQuantityTypeIdentifierHeartRate", "count/min", {
            date: {
              startDate: workout.startDate,
              endDate: new Date(workout.endDate.getTime() + 120_000),
            },
          }).catch(() => []),
        ]);
        const heartRateSamples = samples.map((sample) => ({
          value: sample.quantity,
          unit: "bpm",
          timestamp: sample.endDate.toISOString(),
        }));
        const endHeartRate = summarizeWorkoutHeartRate(
          heartRateSamples,
          new Date(workout.endDate.getTime() - 60_000).toISOString(),
          workout.endDate.toISOString(),
        );
        const energy = workout.totalEnergyBurned;
        return {
          id: workout.uuid,
          activity: workoutLabels[type] ?? "Workout",
          category,
          startedAt: workout.startDate.toISOString(),
          endedAt: workout.endDate.toISOString(),
          // The library always reports workout energy in kcal.
          activeEnergyKcal: energy ? energy.quantity : null,
          heartRate: {
            average: average?.averageQuantity?.quantity ?? null,
            peak: endHeartRate.peak,
            recovery: endHeartRate.recovery,
          },
          heartRateByMinute: heartRateByMinute(
            heartRateSamples,
            workout.startDate.toISOString(),
            workout.endDate.toISOString(),
          ),
        };
      }),
    );
    return dedupeWorkouts(results);
  }

  async getBiomarkerHistory(
    kind: BiomarkerKind,
    since: Date,
  ): Promise<HealthSample[]> {
    const healthKit = await this.loadHealthKit();
    const { identifier, unit } = biomarkerTypes[kind];
    const anchor = new Date(since);
    anchor.setHours(0, 0, 0, 0);
    // Daily statistics keep a year of HRV or respiratory rate to ~365 values.
    const days = await healthKit.queryStatisticsCollectionForQuantity(
      identifier,
      ["discreteAverage"],
      anchor,
      { day: 1 },
      {
        unit,
        filter: { date: { startDate: anchor, endDate: now() } },
      } as never,
    );
    const scale = fractionKinds.has(kind) ? 100 : 1;
    return days.flatMap((day) =>
      day.averageQuantity && day.startDate
        ? [
            {
              value: day.averageQuantity.quantity * scale,
              unit: biomarkerUnits[kind],
              timestamp: day.startDate.toISOString(),
            },
          ]
        : [],
    );
  }

  async getProfile(): Promise<HealthProfile> {
    const healthKit = await this.loadHealthKit();
    const [birthDate, sex] = await Promise.all([
      healthKit.getDateOfBirthAsync().catch(() => undefined),
      healthKit.getBiologicalSexAsync().catch(() => undefined),
    ]);
    return {
      birthDate: birthDate ? dayKey(birthDate) : null,
      sex:
        sex === healthKit.BiologicalSex.female
          ? "female"
          : sex === healthKit.BiologicalSex.male
            ? "male"
            : null,
    };
  }
}
