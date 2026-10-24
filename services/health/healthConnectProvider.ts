import type { RecordResult, RecordType } from "react-native-health-connect";
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
const todayStart = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

const requestedRecords = [
  "SleepSession",
  "HeartRate",
  "HeartRateVariabilityRmssd",
  "RestingHeartRate",
  "ActiveCaloriesBurned",
  "Nutrition",
  "BloodGlucose",
  "RespiratoryRate",
  "ExerciseSession",
] as const;

// Health Connect ExerciseSessionRecord exercise types.
const exerciseLabels: Record<number, string> = {
  8: "Ride",
  13: "Calisthenics",
  36: "Intervals",
  53: "Row",
  56: "Run",
  70: "Strength",
  74: "Swim",
  79: "Walk",
  81: "Strength",
  83: "Yoga",
  48: "Pilates",
  37: "Hike",
};
const strengthExercises = new Set([13, 70, 81]);
const mixedExercises = new Set([48, 83]);

type HealthConnectModule = typeof import("react-native-health-connect");

export class HealthConnectProvider implements HealthProvider {
  readonly kind = "health-connect" as const;
  private healthConnect: HealthConnectModule | null = null;

  private async api() {
    this.healthConnect ??= await import("react-native-health-connect");
    return this.healthConnect;
  }

  async requestPermissions(): Promise<PermissionResult> {
    const api = await this.api();
    const initialized = await api.initialize();
    if (!initialized)
      return {
        state: "denied",
        grantedTypes: 0,
        requestedTypes: requestedRecords.length,
      };
    const permissions = await api.requestPermission([
      ...requestedRecords.map((recordType) => ({
        accessType: "read" as const,
        recordType,
      })),
      // Without this, Health Connect only returns data from 30 days before the first grant,
      // which would cut off the Fitness tab's previous-period comparison.
      {
        accessType: "read" as const,
        recordType: "ReadHealthDataHistory" as const,
      },
    ]);
    return this.toResult(permissions);
  }

  async getConnectionStatus(): Promise<PermissionResult | null> {
    const api = await this.api();
    if (!(await api.initialize())) return null;
    const result = this.toResult(await api.getGrantedPermissions());
    return result.grantedTypes > 0 ? result : null;
  }

  private toResult(
    permissions: Array<{ accessType: string; recordType: string }>,
  ): PermissionResult {
    const count = new Set(
      permissions
        .filter(
          (permission) =>
            permission.accessType === "read" &&
            (requestedRecords as readonly string[]).includes(
              permission.recordType,
            ),
        )
        .map((permission) => permission.recordType),
    ).size;
    return {
      state:
        count === 0
          ? "denied"
          : count === requestedRecords.length
            ? "granted"
            : "partial",
      grantedTypes: count,
      requestedTypes: requestedRecords.length,
    };
  }

  private async read<T extends RecordType>(
    recordType: T,
    startTime = new Date(Date.now() - 36 * 60 * 60_000),
    endTime = now(),
  ): Promise<RecordResult<T>[]> {
    const api = await this.api();
    const records: RecordResult<T>[] = [];
    let pageToken: string | undefined;
    // readRecords returns at most one page (1,000 records by default).
    do {
      const page = await api.readRecords(recordType, {
        timeRangeFilter: {
          operator: "between",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        ...(pageToken ? { pageToken } : {}),
      });
      records.push(...page.records);
      pageToken = page.pageToken || undefined;
    } while (pageToken);
    return records;
  }

  async getSleep(): Promise<SleepData | null> {
    const sessions = await this.read("SleepSession");
    const session = sessions.at(-1);
    if (!session) return null;
    const stages = session.stages ?? [];
    const duration = (stage: (typeof stages)[number]) =>
      Math.max(
        0,
        (new Date(stage.endTime).getTime() -
          new Date(stage.startTime).getTime()) /
          60_000,
      );
    const asleep = stages.filter((stage) => [2, 4, 5, 6].includes(stage.stage));
    const durationMinutes =
      asleep.reduce((sum, stage) => sum + duration(stage), 0) ||
      (new Date(session.endTime).getTime() -
        new Date(session.startTime).getTime()) /
        60_000;
    return {
      durationMinutes,
      needMinutes: 480,
      efficiency: Math.min(
        durationMinutes /
          Math.max(
            (new Date(session.endTime).getTime() -
              new Date(session.startTime).getTime()) /
              60_000,
            1,
          ),
        1,
      ),
      deepMinutes: stages
        .filter((stage) => stage.stage === 5)
        .reduce((sum, stage) => sum + duration(stage), 0),
      remMinutes: stages
        .filter((stage) => stage.stage === 6)
        .reduce((sum, stage) => sum + duration(stage), 0),
      lastSleepAt: session.endTime,
    };
  }

  async getHeartRate(): Promise<HealthSample[]> {
    const records = await this.read("HeartRate");
    return records.flatMap((record) =>
      record.samples.map((sample) => ({
        value: sample.beatsPerMinute,
        unit: "bpm",
        timestamp: sample.time,
      })),
    );
  }

  async getHRV(): Promise<HealthSample[]> {
    const records = await this.read("HeartRateVariabilityRmssd");
    return records.map((record) => ({
      value: record.heartRateVariabilityMillis,
      unit: "ms",
      timestamp: record.time,
    }));
  }

  async getRestingHR(): Promise<number | null> {
    const records = await this.read("RestingHeartRate");
    return records.at(-1)?.beatsPerMinute ?? null;
  }

  async getRespiratoryRate(): Promise<number | null> {
    const records = await this.read("RespiratoryRate");
    return records.at(-1)?.rate ?? null;
  }

  async getActiveEnergy(): Promise<number> {
    const records = await this.read("ActiveCaloriesBurned");
    const start = todayStart().getTime();
    return records
      .filter((record) => new Date(record.endTime).getTime() >= start)
      .reduce((sum, record) => sum + record.energy.inKilocalories, 0);
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
    const records = await this.read("Nutrition");
    const start = todayStart().getTime();
    const today = records.filter(
      (record) => new Date(record.endTime).getTime() >= start,
    );
    if (today.length === 0) return null;
    return today.reduce<NutritionData>(
      (total, record) => ({
        calories: total.calories + (record.energy?.inKilocalories ?? 0),
        proteinGrams: total.proteinGrams + (record.protein?.inGrams ?? 0),
        carbohydrateGrams:
          total.carbohydrateGrams + (record.totalCarbohydrate?.inGrams ?? 0),
        fatGrams: total.fatGrams + (record.totalFat?.inGrams ?? 0),
      }),
      { calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0 },
    );
  }

  async getGlucose(): Promise<GlucoseData | null> {
    const records = await this.read("BloodGlucose");
    if (!records.length) return null;
    const unit = "mg/dL" as const;
    return {
      unit,
      samples: records.slice(-48).map((record) => ({
        value: record.level.inMilligramsPerDeciliter,
        unit,
        timestamp: record.time,
      })),
    };
  }

  async getStressSamples(): Promise<StressSample[]> {
    const [heartRate, hrv] = await Promise.all([
      this.getHeartRate(),
      this.getHRV(),
    ]);
    return heartRate.slice(-48).map((sample, index) => ({
      timestamp: sample.timestamp,
      heartRate: sample.value,
      hrv: hrv[Math.min(index, Math.max(hrv.length - 1, 0))]?.value ?? 0,
    }));
  }

  async getWorkouts(since: Date): Promise<Workout[]> {
    const sessions = await this.read("ExerciseSession", since);
    return Promise.all(
      sessions.map(async (session): Promise<Workout> => {
        const start = new Date(session.startTime);
        const end = new Date(session.endTime);
        const [heartRate, calories] = await Promise.all([
          this.read(
            "HeartRate",
            start,
            new Date(end.getTime() + 120_000),
          ).catch(() => []),
          this.read("ActiveCaloriesBurned", start, end).catch(() => []),
        ]);
        const category: WorkoutCategory = strengthExercises.has(
          session.exerciseType,
        )
          ? "strength"
          : mixedExercises.has(session.exerciseType)
            ? "mixed"
            : "cardio";
        return {
          id: session.metadata?.id ?? session.startTime,
          activity:
            session.title ?? exerciseLabels[session.exerciseType] ?? "Workout",
          category,
          startedAt: session.startTime,
          endedAt: session.endTime,
          activeEnergyKcal: calories.length
            ? calories.reduce(
                (total, record) => total + record.energy.inKilocalories,
                0,
              )
            : null,
          heartRate: summarizeWorkoutHeartRate(
            heartRate.flatMap((record) =>
              record.samples.map((sample) => ({
                value: sample.beatsPerMinute,
                unit: "bpm",
                timestamp: sample.time,
              })),
            ),
            session.startTime,
            session.endTime,
          ),
        };
      }),
    );
  }
}
