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

// A repeating two-week training block: [days ago % 14, activity, minutes, avg HR].
const trainingBlock = [
  [0, "Run", 48, 148],
  [1, "Strength", 55, 118],
  [2, "Ride", 70, 136],
  [4, "Intervals", 38, 166],
  [4, "Strength", 45, 115],
  [5, "Run", 42, 152],
  [7, "Long run", 95, 142],
  [8, "Strength", 60, 120],
  [9, "Run", 35, 150],
  [10, "Ride", 80, 134],
  [11, "Intervals", 32, 170],
  [11, "Mobility", 25, 96],
  [12, "Strength", 50, 117],
  [13, "Run", 40, 146],
] as const;

function mockWorkouts(since: Date): Workout[] {
  const workouts: Workout[] = [];
  const days = Math.ceil((Date.now() - since.getTime()) / 86_400_000);
  for (let daysAgo = 0; daysAgo <= days; daysAgo += 1) {
    trainingBlock.forEach(
      ([slot, activity, minutes, averageHeartRate], index) => {
        if (slot !== daysAgo % 14) return;
        // Earlier weeks are slightly lighter so the block shows progression.
        const scale = 1 - Math.floor(daysAgo / 14) * 0.04;
        const start = new Date();
        start.setDate(start.getDate() - daysAgo);
        start.setHours(index % 2 ? 18 : 7, 15, 0, 0);
        if (start.getTime() > Date.now() || start < since) return;
        const duration = Math.round(minutes * scale);
        const strength = activity === "Strength";
        const peak = averageHeartRate + (strength ? 14 : 22);
        workouts.push({
          id: `mock-${daysAgo}-${index}`,
          activity,
          category: strength
            ? "strength"
            : activity === "Mobility"
              ? "mixed"
              : "cardio",
          startedAt: start.toISOString(),
          endedAt: new Date(start.getTime() + duration * 60_000).toISOString(),
          activeEnergyKcal: Math.round(
            duration * (averageHeartRate - 50) * 0.09,
          ),
          heartRate: {
            average: Math.round(averageHeartRate * (0.97 + scale * 0.03)),
            peak,
            recovery: peak - (38 + ((daysAgo * 7) % 13)),
          },
        });
      },
    );
  }
  return workouts;
}

// [value a year ago, value today, day-to-day wobble, days between readings, unit]
const biomarkerShapes: Record<
  BiomarkerKind,
  [start: number, end: number, wobble: number, every: number, unit: string]
> = {
  weight: [87.6, 84.8, 0.35, 1, "kg"],
  hrv: [58, 66, 6, 1, "ms"],
  restingHeartRate: [56, 52, 1.5, 1, "bpm"],
  bodyFat: [20.4, 17.2, 0.4, 7, "%"],
  leanBodyMass: [66.1, 67.4, 0.3, 7, "kg"],
  vo2Max: [46.2, 49.8, 0.4, 3, "ml/kg/min"],
  bloodOxygen: [97.4, 97.8, 0.6, 1, "%"],
  respiratoryRate: [14.6, 14.2, 0.4, 1, "br/min"],
};

function mockBiomarkerHistory(
  kind: BiomarkerKind,
  since: Date,
): HealthSample[] {
  const [start, end, wobble, every, unit] = biomarkerShapes[kind];
  const days = Math.min(
    365,
    Math.ceil((Date.now() - since.getTime()) / 86_400_000),
  );
  const samples: HealthSample[] = [];
  for (let daysAgo = days; daysAgo >= 0; daysAgo -= 1) {
    if (daysAgo % every !== 0) continue;
    const progress = 1 - daysAgo / 365;
    // Two out-of-step sine waves give repeatable noise without a random seed.
    const noise =
      Math.sin(daysAgo * 1.7) * 0.6 + Math.sin(daysAgo * 0.37) * 0.4;
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    day.setHours(0, 0, 0, 0);
    samples.push({
      value: start + (end - start) * progress + noise * wobble,
      unit,
      timestamp: day.toISOString(),
    });
  }
  return samples;
}

export class MockHealthProvider implements HealthProvider {
  readonly kind = "mock" as const;

  async requestPermissions(): Promise<PermissionResult> {
    return { state: "granted", grantedTypes: 8, requestedTypes: 8 };
  }

  async getConnectionStatus(): Promise<PermissionResult> {
    return this.requestPermissions();
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

  async getWorkouts(since: Date): Promise<Workout[]> {
    return mockWorkouts(since);
  }

  async getBiomarkerHistory(
    kind: BiomarkerKind,
    since: Date,
  ): Promise<HealthSample[]> {
    return mockBiomarkerHistory(kind, since);
  }

  async getProfile(): Promise<HealthProfile> {
    return { birthDate: "1990-03-14", sex: "male" };
  }
}
