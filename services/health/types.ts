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

export type SleepData = {
  durationMinutes: number;
  needMinutes: number;
  efficiency: number;
  deepMinutes: number;
  remMinutes: number;
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

export interface HealthProvider {
  readonly kind: "mock" | "apple" | "health-connect";
  requestPermissions(): Promise<PermissionResult>;
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
}
