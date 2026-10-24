import type { RecordResult, RecordType } from "react-native-health-connect";
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
import { dailyAverages } from "@/services/metrics/biomarkers";
import {
  heartRateByMinute,
  summarizeWorkoutHeartRate,
} from "@/services/metrics/fitness";
import {
  LATEST_READING_DAYS,
  SAMPLE_BUCKET_MINUTES,
  bucketSamples,
  buildStressSamples,
  dedupeWorkouts,
  pickMainSleep,
} from "./nativeSamples";

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
  "Weight",
  "BodyFat",
  "LeanBodyMass",
  "Vo2Max",
  "OxygenSaturation",
] as const;

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

// Health Connect ExerciseSessionRecord exercise types.
const exerciseLabels: Record<number, string> = {
  8: "Ride",
  9: "Ride",
  13: "Calisthenics",
  25: "Elliptical",
  36: "Intervals",
  37: "Hike",
  48: "Pilates",
  53: "Row",
  54: "Row",
  56: "Run",
  57: "Run",
  68: "Stairs",
  69: "Stairs",
  70: "Strength",
  73: "Swim",
  74: "Swim",
  79: "Walk",
  81: "Strength",
  83: "Yoga",
};
const strengthExercises = new Set([13, 70, 81]);
const mixedExercises = new Set([48, 83]);

type HealthConnectModule = typeof import("react-native-health-connect");

export class HealthConnectProvider implements HealthProvider {
  readonly kind = "health-connect" as const;
  private healthConnect: HealthConnectModule | null = null;

  constructor(
    // Loaded lazily so other platforms never touch the native module.
    private readonly loadHealthConnect: () => Promise<HealthConnectModule> = () =>
      import("react-native-health-connect"),
  ) {}

  private async api() {
    this.healthConnect ??= await this.loadHealthConnect();
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
    dataOriginFilter?: string[],
  ): Promise<RecordResult<T>[]> {
    const api = await this.api();
    const records: RecordResult<T>[] = [];
    let pageToken: string | undefined;
    // readRecords returns at most one page (1,000 records by default), oldest first.
    do {
      const page = await api.readRecords(recordType, {
        timeRangeFilter: {
          operator: "between",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        ascendingOrder: true,
        ...(dataOriginFilter ? { dataOriginFilter } : {}),
        ...(pageToken ? { pageToken } : {}),
      });
      records.push(...page.records);
      pageToken = page.pageToken || undefined;
    } while (pageToken);
    return records;
  }

  /** Health Connect's own total, which applies the user's app priority instead of adding every app's copy. */
  private async activeCalories(startTime: Date, endTime = now()) {
    const api = await this.api();
    const result = await api.aggregateRecord({
      recordType: "ActiveCaloriesBurned",
      timeRangeFilter: {
        operator: "between",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });
    return {
      kcal: result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0,
      hasData: result.dataOrigins.length > 0,
    };
  }

  private async latest<T extends "RestingHeartRate" | "RespiratoryRate">(
    recordType: T,
  ): Promise<RecordResult<T> | null> {
    const records = await this.read(
      recordType,
      new Date(Date.now() - LATEST_READING_DAYS * 86_400_000),
    );
    return records.at(-1) ?? null;
  }

  async getSleep(): Promise<SleepData | null> {
    const minutesBetween = (start: string, end: string) =>
      Math.max(
        0,
        (new Date(end).getTime() - new Date(start).getTime()) / 60_000,
      );
    const sessions = (await this.read("SleepSession")).map((session) => {
      const asleep = (session.stages ?? []).filter((stage) =>
        [2, 4, 5, 6].includes(stage.stage),
      );
      return {
        session,
        end: new Date(session.endTime).getTime(),
        // A session without stages counts as asleep from start to end.
        asleepMinutes: asleep.length
          ? asleep.reduce(
              (sum, stage) =>
                sum + minutesBetween(stage.startTime, stage.endTime),
              0,
            )
          : minutesBetween(session.startTime, session.endTime),
      };
    });
    // A 36-hour window can hold a nap or, in the morning, the night before too.
    const main = pickMainSleep(sessions, now());
    if (!main) return null;
    const { session } = main;
    const stages = session.stages ?? [];
    const duration = (stage: (typeof stages)[number]) =>
      minutesBetween(stage.startTime, stage.endTime);
    const durationMinutes = main.asleepMinutes;
    return {
      durationMinutes,
      needMinutes: 480,
      efficiency: Math.min(
        durationMinutes /
          Math.max(minutesBetween(session.startTime, session.endTime), 1),
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
    return (await this.latest("RestingHeartRate"))?.beatsPerMinute ?? null;
  }

  async getRespiratoryRate(): Promise<number | null> {
    return (await this.latest("RespiratoryRate"))?.rate ?? null;
  }

  async getActiveEnergy(): Promise<number> {
    return (await this.activeCalories(todayStart())).kcal;
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
    const api = await this.api();
    const result = await api.aggregateRecord({
      recordType: "Nutrition",
      timeRangeFilter: {
        operator: "between",
        startTime: todayStart().toISOString(),
        endTime: now().toISOString(),
      },
    });
    if (result.dataOrigins.length === 0) return null;
    return {
      calories: result.ENERGY_TOTAL?.inKilocalories ?? 0,
      proteinGrams: result.PROTEIN_TOTAL?.inGrams ?? 0,
      carbohydrateGrams: result.TOTAL_CARBOHYDRATE_TOTAL?.inGrams ?? 0,
      fatGrams: result.TOTAL_FAT_TOTAL?.inGrams ?? 0,
    };
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
    return buildStressSamples(heartRate, hrv, now());
  }

  async getWorkouts(since: Date): Promise<Workout[]> {
    const sessions = await this.read("ExerciseSession", since);
    const workouts = await Promise.all(
      sessions.map(async (session): Promise<Workout> => {
        const start = new Date(session.startTime);
        const end = new Date(session.endTime);
        const heartRateUntil = new Date(end.getTime() + 120_000);
        const origin = session.metadata?.dataOrigin;
        const [ownHeartRate, calories] = await Promise.all([
          // The app that recorded the session usually recorded its heart rate too;
          // reading only that app avoids mixing in a second device's readings.
          origin
            ? this.read("HeartRate", start, heartRateUntil, [origin]).catch(
                () => [],
              )
            : Promise.resolve([]),
          this.activeCalories(start, end).catch(() => null),
        ]);
        const heartRate = ownHeartRate.length
          ? ownHeartRate
          : await this.read("HeartRate", start, heartRateUntil).catch(() => []);
        const heartRateSamples = heartRate.flatMap((record) =>
          record.samples.map((sample) => ({
            value: sample.beatsPerMinute,
            unit: "bpm",
            timestamp: sample.time,
          })),
        );
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
          activeEnergyKcal: calories?.hasData ? calories.kcal : null,
          heartRate: summarizeWorkoutHeartRate(
            heartRateSamples,
            session.startTime,
            session.endTime,
          ),
          heartRateByMinute: heartRateByMinute(
            heartRateSamples,
            session.startTime,
            session.endTime,
          ),
        };
      }),
    );
    return dedupeWorkouts(workouts);
  }

  private async readBiomarker(
    kind: BiomarkerKind,
    since: Date,
  ): Promise<Array<{ time: string; value: number }>> {
    switch (kind) {
      case "weight":
        return (await this.read("Weight", since)).map((record) => ({
          time: record.time,
          value: record.weight.inKilograms,
        }));
      case "hrv":
        return (await this.read("HeartRateVariabilityRmssd", since)).map(
          (record) => ({
            time: record.time,
            value: record.heartRateVariabilityMillis,
          }),
        );
      case "restingHeartRate":
        return (await this.read("RestingHeartRate", since)).map((record) => ({
          time: record.time,
          value: record.beatsPerMinute,
        }));
      case "bodyFat":
        return (await this.read("BodyFat", since)).map((record) => ({
          time: record.time,
          value: record.percentage,
        }));
      case "leanBodyMass":
        return (await this.read("LeanBodyMass", since)).map((record) => ({
          time: record.time,
          value: record.mass.inKilograms,
        }));
      case "vo2Max":
        return (await this.read("Vo2Max", since)).map((record) => ({
          time: record.time,
          value: record.vo2MillilitersPerMinuteKilogram,
        }));
      case "bloodOxygen":
        return (await this.read("OxygenSaturation", since)).map((record) => ({
          time: record.time,
          value: record.percentage,
        }));
      case "respiratoryRate":
        return (await this.read("RespiratoryRate", since)).map((record) => ({
          time: record.time,
          value: record.rate,
        }));
    }
  }

  async getBiomarkerHistory(
    kind: BiomarkerKind,
    since: Date,
  ): Promise<HealthSample[]> {
    const readings = await this.readBiomarker(kind, since);
    return dailyAverages(
      readings.map((reading) => ({
        value: reading.value,
        unit: biomarkerUnits[kind],
        timestamp: reading.time,
      })),
    );
  }

  async getProfile(): Promise<HealthProfile> {
    // Health Connect has no date of birth or sex record; the app asks once instead.
    return { birthDate: null, sex: null };
  }
}
