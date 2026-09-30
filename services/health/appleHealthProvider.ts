import type {
  GlucoseData,
  HealthProvider,
  HealthSample,
  NutritionData,
  PermissionResult,
  SleepData,
  StrainInputs,
  StressSample,
} from "./types";

const now = () => new Date();
const todayStart = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

type QuantitySample = {
  quantity: number;
  unit: string;
  startDate: Date;
  endDate: Date;
};

export class AppleHealthProvider implements HealthProvider {
  readonly kind = "apple" as const;

  async requestPermissions(): Promise<PermissionResult> {
    const healthKit = await import("@kingstinct/react-native-healthkit");
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
    ] as const;
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

  private async quantity<
    T extends Parameters<
      (typeof import("@kingstinct/react-native-healthkit"))["queryQuantitySamples"]
    >[0],
  >(identifier: T, unit?: string): Promise<QuantitySample[]> {
    const healthKit = await import("@kingstinct/react-native-healthkit");
    const result = await healthKit.queryQuantitySamples(identifier, {
      limit: 0,
      ascending: false,
      ...(unit ? { unit } : {}),
    } as never);
    return result as unknown as QuantitySample[];
  }

  async getSleep(): Promise<SleepData | null> {
    const healthKit = await import("@kingstinct/react-native-healthkit");
    const samples = await healthKit.queryCategorySamples(
      "HKCategoryTypeIdentifierSleepAnalysis",
      { limit: 0, ascending: false },
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
    );
    return samples[0]?.quantity ?? null;
  }

  async getRespiratoryRate(): Promise<number | null> {
    const samples = await this.quantity(
      "HKQuantityTypeIdentifierRespiratoryRate",
      "count/min",
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
}
