export type PermissionState =
  | "mock"
  | "unrequested"
  | "granted"
  | "partial"
  | "denied";

export type PermissionResult = {
  state: Exclude<PermissionState, "mock" | "unrequested">;
  grantedTypes: number;
  requestedTypes: number;
};

export type HealthSample = {
  value: number;
  unit: string;
  timestamp: string;
};

/** A sleep stage. `asleep` is sleep the source recorded without a stage. */
export type SleepStage = "awake" | "rem" | "light" | "deep" | "asleep";

/** One stretch of the night in a single stage, as ISO times. */
export type SleepSegment = { stage: SleepStage; start: string; end: string };

export type SleepData = {
  durationMinutes: number;
  needMinutes: number;
  efficiency: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  /** Time in bed minus time asleep. */
  awakeMinutes: number;
  /** From getting into bed to getting up, awake time included. */
  inBedMinutes: number;
  bedtime: string;
  wakeTime: string;
  /** The night from bedtime to wake time, oldest first, with no gaps. */
  stages: SleepSegment[];
  lastSleepAt: string;
};

export type StrainInputs = {
  heartRateSamples: Array<HealthSample & { sampleMinutes: number }>;
  activeEnergyKcal: number;
  restingHeartRate: number;
  maxHeartRate: number;
};

export type NutritionData = {
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
};

export type GlucoseData = {
  samples: HealthSample[];
  unit: "mg/dL" | "mmol/L";
};

export type StressSample = {
  timestamp: string;
  heartRate: number;
  hrv: number;
};

export type BiomarkerKind =
  | "weight"
  | "hrv"
  | "restingHeartRate"
  | "bodyFat"
  | "leanBodyMass"
  | "vo2Max"
  | "bloodOxygen"
  | "respiratoryRate";

export type BiologicalSex = "female" | "male";

/** Age and sex, used only on-device to rate biomarkers against reference ranges. */
export type HealthProfile = {
  /** Local YYYY-MM-DD. */
  birthDate: string | null;
  sex: BiologicalSex | null;
};

export type WorkoutCategory = "cardio" | "strength" | "mixed";

export type WorkoutHeartRate = {
  average: number | null;
  /** Heart rate at the end of the effort. */
  peak: number | null;
  /** Heart rate about one minute after the effort ended. */
  recovery: number | null;
};

export type Workout = {
  id: string;
  activity: string;
  category: WorkoutCategory;
  startedAt: string;
  endedAt: string;
  activeEnergyKcal: number | null;
  heartRate: WorkoutHeartRate;
  /** Average heart rate for each minute of the workout; 0 where there was no reading. */
  heartRateByMinute?: number[];
};

export interface HealthProvider {
  readonly kind: "mock" | "apple" | "health-connect";
  requestPermissions(): Promise<PermissionResult>;
  /** Silently reports an existing grant, or null if the user still needs to be asked. */
  getConnectionStatus(): Promise<PermissionResult | null>;
  getSleep(): Promise<SleepData | null>;
  getHeartRate(): Promise<HealthSample[]>;
  getHRV(): Promise<HealthSample[]>;
  getRestingHR(): Promise<number | null>;
  getRespiratoryRate(): Promise<number | null>;
  getActiveEnergy(): Promise<number>;
  getStrainInputs(): Promise<StrainInputs>;
  getNutrition(): Promise<NutritionData | null>;
  getGlucose(): Promise<GlucoseData | null>;
  getStressSamples(): Promise<StressSample[]>;
  getWorkouts(since: Date): Promise<Workout[]>;
  /** One value per day (the daily average), oldest first. */
  getBiomarkerHistory(
    kind: BiomarkerKind,
    since: Date,
  ): Promise<HealthSample[]>;
  /** Age and sex from the health source, where the platform shares them. */
  getProfile(): Promise<HealthProfile>;
}
