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
  /** Total distance in meters, where the activity records one. */
  distanceMeters?: number | null;
  /** The app or device that recorded the workout, e.g. "Apple Watch". */
  source?: string | null;
  /** Internal id of the recording app, used to read its own samples back. */
  sourceId?: string | null;
  /** True for treadmill, trainer or pool sessions, where the platform says so. */
  indoor?: boolean | null;
};

/** One interval sample of distance covered, as watches write it during a workout. */
export type DistanceSample = {
  startedAt: string;
  endedAt: string;
  meters: number;
};

/** Running form averages. Only Apple Watch records stride, oscillation and contact time. */
export type RunDynamics = {
  /** Steps per minute. */
  cadence: number | null;
  strideLengthMeters: number | null;
  verticalOscillationCm: number | null;
  groundContactMs: number | null;
};

/** The heavier reads behind one workout's detail page, fetched only when it opens. */
export type WorkoutDetails = {
  distanceSamples: DistanceSample[];
  elevationGainMeters: number | null;
  dynamics: RunDynamics | null;
};

export interface HealthProvider {
  readonly kind: "mock" | "apple" | "health-connect";
  requestPermissions(): Promise<PermissionResult>;
  /** Silently reports an existing grant, or null if the user still needs to be asked. */
  getConnectionStatus(): Promise<PermissionResult | null>;
  /** The main sleep that ended in the 24 hours before `asOf` (default now). */
  getSleep(asOf?: Date): Promise<SleepData | null>;
  getHeartRate(day?: Date): Promise<HealthSample[]>;
  getHRV(day?: Date): Promise<HealthSample[]>;
  getRestingHR(day?: Date): Promise<number | null>;
  getRespiratoryRate(day?: Date): Promise<number | null>;
  getActiveEnergy(day?: Date): Promise<number>;
  /** Strain inputs for one local day (default today). */
  getStrainInputs(day?: Date): Promise<StrainInputs>;
  getNutrition(day?: Date): Promise<NutritionData | null>;
  getGlucose(day?: Date): Promise<GlucoseData | null>;
  getStressSamples(day?: Date): Promise<StressSample[]>;
  /** Every 5-minute stress bucket of the calendar day (today: up to now). */
  getDayStressSamples(day?: Date): Promise<StressSample[]>;
  /** Workouts from `since` up to `until` (default now). */
  getWorkouts(since: Date, until?: Date): Promise<Workout[]>;
  /** Distance samples, elevation and running form for one workout. */
  getWorkoutDetails(workout: Workout): Promise<WorkoutDetails>;
  /** One value per day (the daily average) from `since` up to `until` (default now), oldest first. */
  getBiomarkerHistory(
    kind: BiomarkerKind,
    since: Date,
    until?: Date,
  ): Promise<HealthSample[]>;
  /** Age and sex from the health source, where the platform shares them. */
  getProfile(): Promise<HealthProfile>;
}
