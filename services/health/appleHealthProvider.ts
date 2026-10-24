import type {
  GlucoseData,
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
import { summarizeWorkoutHeartRate } from "@/services/metrics/fitness";

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
};
const strengthTypes = new Set([20, 50, 59]);
const mixedTypes = new Set([29, 33, 57, 62, 66, 80]);

type QuantitySample = {
  quantity: number;
  unit: string;
  startDate: Date;
  endDate: Date;
};

const readTypes = [
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

export class AppleHealthProvider implements HealthProvider {
  readonly kind = "apple" as const;

  async requestPermissions(): Promise<PermissionResult> {
    const healthKit = await import("@kingstinct/react-native-healthkit");
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
    const healthKit = await import("@kingstinct/react-native-healthkit");
    if (!(await healthKit.isHealthDataAvailableAsync())) return null;
    // "unnecessary" means the prompt was already answered; HealthKit hides read grants,
    // so re-attaching is safe and simply returns no samples for declined types.
    const status = await healthKit.getRequestStatusForAuthorization({
      toRead: readTypes,
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
    }: {
      date?: { startDate: Date; endDate: Date } | null;
      limit?: number;
    } = {},
  ): Promise<QuantitySample[]> {
    const healthKit = await import("@kingstinct/react-native-healthkit");
    // Always bound queries: an unfiltered heart-rate query returns years of samples.
    const result = await healthKit.queryQuantitySamples(identifier, {
      limit,
      ascending: false,
      ...(unit ? { unit } : {}),
      ...(date ? { filter: { date } } : {}),
    } as never);
    return result as unknown as QuantitySample[];
  }

  async getSleep(): Promise<SleepData | null> {
    const healthKit = await import("@kingstinct/react-native-healthkit");
    const samples = await healthKit.queryCategorySamples(
      "HKCategoryTypeIdentifierSleepAnalysis",
      { limit: 0, ascending: false, filter: { date: recentWindow() } },
    );
    const cutoff = new Date(Date.now() - 36 * 60 * 60_000);
    const recent = samples.filter(
      (sample) => sample.endDate >= cutoff && sample.endDate <= now(),
    );
    const asleep = recent.filter((sample) =>
      [1, 3, 4, 5].includes(Number(sample.value)),
    );
    if (asleep.length === 0) return null;
    const minutes = (sample: (typeof asleep)[number]) =>
      Math.max(
        0,
        (sample.endDate.getTime() - sample.startDate.getTime()) / 60_000,
      );
    const durationMinutes = asleep.reduce(
      (sum, sample) => sum + minutes(sample),
      0,
    );
    const inBed = recent
      .filter((sample) => Number(sample.value) === 0)
      .reduce((sum, sample) => sum + minutes(sample), 0);
    return {
      durationMinutes,
      needMinutes: 480,
      efficiency: inBed > 0 ? Math.min(durationMinutes / inBed, 1) : 0.88,
      deepMinutes: asleep
        .filter((sample) => Number(sample.value) === 4)
        .reduce((sum, sample) => sum + minutes(sample), 0),
      remMinutes: asleep
        .filter((sample) => Number(sample.value) === 5)
        .reduce((sum, sample) => sum + minutes(sample), 0),
      lastSleepAt: asleep.at(-1)?.endDate.toISOString() ?? now().toISOString(),
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
    const samples = await this.quantity(
      "HKQuantityTypeIdentifierRestingHeartRate",
      "count/min",
      { date: null, limit: 1 },
    );
    return samples[0]?.quantity ?? null;
  }

  async getRespiratoryRate(): Promise<number | null> {
    const samples = await this.quantity(
      "HKQuantityTypeIdentifierRespiratoryRate",
      "count/min",
      { date: null, limit: 1 },
    );
    return samples[0]?.quantity ?? null;
  }

  async getActiveEnergy(): Promise<number> {
    const samples = await this.quantity(
      "HKQuantityTypeIdentifierActiveEnergyBurned",
      "kcal",
    );
    const start = todayStart().getTime();
    return samples
      .filter((sample) => sample.endDate.getTime() >= start)
      .reduce((total, sample) => total + sample.quantity, 0);
  }

  async getStrainInputs(): Promise<StrainInputs> {
    const [heartRateSamples, activeEnergyKcal, resting] = await Promise.all([
      this.getHeartRate(),
      this.getActiveEnergy(),
      this.getRestingHR(),
    ]);
    return {
      heartRateSamples: heartRateSamples.map((sample) => ({
        ...sample,
        sampleMinutes: 5,
      })),
      activeEnergyKcal,
      restingHeartRate: resting ?? 60,
      maxHeartRate: 190,
    };
  }

  async getNutrition(): Promise<NutritionData | null> {
    const [calories, protein, carbs, fat] = await Promise.all([
      this.quantity("HKQuantityTypeIdentifierDietaryEnergyConsumed", "kcal"),
      this.quantity("HKQuantityTypeIdentifierDietaryProtein", "g"),
      this.quantity("HKQuantityTypeIdentifierDietaryCarbohydrates", "g"),
      this.quantity("HKQuantityTypeIdentifierDietaryFatTotal", "g"),
    ]);
    const start = todayStart().getTime();
    const sumToday = (samples: QuantitySample[]) =>
      samples
        .filter((sample) => sample.endDate.getTime() >= start)
        .reduce((total, sample) => total + sample.quantity, 0);
    const result = {
      calories: sumToday(calories),
      proteinGrams: sumToday(protein),
      carbohydrateGrams: sumToday(carbs),
      fatGrams: sumToday(fat),
    };
    return result.calories ||
      result.proteinGrams ||
      result.carbohydrateGrams ||
      result.fatGrams
      ? result
      : null;
  }

  async getGlucose(): Promise<GlucoseData | null> {
    const samples = await this.quantity(
      "HKQuantityTypeIdentifierBloodGlucose",
      "mg/dL",
    );
    const recent = samples
      .slice(0, 48)
      .reverse()
      .map((sample) => ({
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
    return heartRate.slice(0, 48).map((sample, index) => ({
      timestamp: sample.timestamp,
      heartRate: sample.value,
      hrv: hrv[Math.min(index, Math.max(hrv.length - 1, 0))]?.value ?? 0,
    }));
  }

  async getWorkouts(since: Date): Promise<Workout[]> {
    const healthKit = await import("@kingstinct/react-native-healthkit");
    const workouts = await healthKit.queryWorkoutSamples({
      limit: 0,
      ascending: true,
      filter: { date: { startDate: since, endDate: now() } },
    });
    return Promise.all(
      workouts.map(async (workout): Promise<Workout> => {
        const type = Number(workout.workoutActivityType);
        const category: WorkoutCategory = strengthTypes.has(type)
          ? "strength"
          : mixedTypes.has(type)
            ? "mixed"
            : "cardio";
        const [average, endSamples] = await Promise.all([
          workout
            .getStatistic("HKQuantityTypeIdentifierHeartRate", "count/min")
            .catch(() => undefined),
          // Only the minute before and two minutes after the end are needed for recovery.
          this.quantity("HKQuantityTypeIdentifierHeartRate", "count/min", {
            date: {
              startDate: new Date(workout.endDate.getTime() - 60_000),
              endDate: new Date(workout.endDate.getTime() + 120_000),
            },
          }).catch(() => []),
        ]);
        const endHeartRate = summarizeWorkoutHeartRate(
          endSamples.map((sample) => ({
            value: sample.quantity,
            unit: "bpm",
            timestamp: sample.endDate.toISOString(),
          })),
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
          activeEnergyKcal: energy
            ? energy.unit === "kJ"
              ? energy.quantity / 4.184
              : energy.quantity
            : null,
          heartRate: {
            average: average?.averageQuantity?.quantity ?? null,
            peak: endHeartRate.peak,
            recovery: endHeartRate.recovery,
          },
        };
      }),
    );
  }
}
