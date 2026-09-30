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

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

function makeSeries(
  values: number[],
  spacingMinutes: number,
  unit: string,
): HealthSample[] {
  return values.map((value, index) => ({
    value,
    unit,
    timestamp: minutesAgo((values.length - index - 1) * spacingMinutes),
  }));
}

const heartRates = makeSeries(
  [
    61, 64, 67, 71, 76, 82, 88, 94, 91, 86, 80, 74, 71, 77, 85, 92, 88, 79, 73,
    68, 71, 76, 72, 66,
  ],
  22,
  "bpm",
);
const hrvValues = makeSeries(
  [53, 56, 51, 48, 50, 46, 43, 45, 47, 49, 44, 48, 52, 50, 46, 43, 47, 51],
  29,
  "ms",
);
const glucoseValues = makeSeries(
  [
    94, 99, 104, 101, 110, 117, 112, 106, 102, 108, 114, 111, 104, 98, 101, 107,
    103, 96,
  ],
  16,
  "mg/dL",
);

export class MockHealthProvider implements HealthProvider {
  readonly kind = "mock" as const;

  async requestPermissions(): Promise<PermissionResult> {
    return { state: "granted", grantedTypes: 8, requestedTypes: 8 };
  }

  async getSleep(): Promise<SleepData> {
    return {
      durationMinutes: 7 * 60 + 42,
      needMinutes: 8 * 60,
      efficiency: 0.91,
      deepMinutes: 92,
      remMinutes: 108,
      lastSleepAt: new Date(Date.now() - 8 * 60 * 60_000).toISOString(),
    };
  }

  async getHeartRate() {
    return heartRates;
  }
  async getHRV() {
    return hrvValues;
  }
  async getRestingHR() {
    return 54;
  }
  async getRespiratoryRate() {
    return 14.2;
  }
  async getActiveEnergy() {
    return 468;
  }

  async getStrainInputs(): Promise<StrainInputs> {
    return {
      heartRateSamples: heartRates.map((sample) => ({
        ...sample,
        sampleMinutes: 5,
      })),
      activeEnergyKcal: 468,
      restingHeartRate: 54,
      maxHeartRate: 190,
    };
  }

  async getNutrition(): Promise<NutritionData> {
    return {
      calories: 1840,
      proteinGrams: 112,
      carbohydrateGrams: 186,
      fatGrams: 61,
    };
  }

  async getGlucose(): Promise<GlucoseData> {
    return { samples: glucoseValues, unit: "mg/dL" };
  }

  async getStressSamples(): Promise<StressSample[]> {
    return heartRates.map((sample, index) => ({
      timestamp: sample.timestamp,
      heartRate: sample.value,
      hrv: hrvValues[Math.min(index, hrvValues.length - 1)]?.value ?? 48,
    }));
  }
}
