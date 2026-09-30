import {
  averageSamples,
  calculateEnergyBattery,
  calculateRecoveryScore,
  calculateSleepScore,
  calculateStrainScore,
  calculateStressTimeline,
} from "@/services/metrics";

import type {
  GlucoseData,
  HealthProvider,
  NutritionData,
  PermissionState,
  SleepData,
  StrainInputs,
  StressSample,
} from "./types";

export type DashboardData = {
  source: HealthProvider["kind"];
  permissionState: PermissionState;
  sleep: SleepData | null;
  sleepScore: number | null;
  recoveryScore: number | null;
  strainScore: number | null;
  stress: ReturnType<typeof calculateStressTimeline> | null;
  energyBattery: number | null;
  activeEnergyKcal: number;
  hrv: number | null;
  restingHeartRate: number | null;
  respiratoryRate: number | null;
  nutrition: NutritionData | null;
  glucose: GlucoseData | null;
  sectionErrors: {
    sleep: boolean;
    recovery: boolean;
    strain: boolean;
    stress: boolean;
    nutrition: boolean;
    glucose: boolean;
  };
};

const fallbackStrain: StrainInputs = {
  heartRateSamples: [],
  activeEnergyKcal: 0,
  restingHeartRate: 60,
  maxHeartRate: 190,
};

export async function loadDashboardData(
  provider: HealthProvider,
  permissionState: PermissionState = provider.kind === "mock"
    ? "mock"
    : "granted",
): Promise<DashboardData> {
  const results = await Promise.allSettled([
    provider.getSleep(),
    provider.getHRV(),
    provider.getRestingHR(),
    provider.getRespiratoryRate(),
    provider.getStrainInputs(),
    provider.getNutrition(),
    provider.getGlucose(),
    provider.getStressSamples(),
  ]);
  const fulfilled = results.filter(
    (result) => result.status === "fulfilled",
  ).length;
  if (fulfilled === 0) throw new Error("No health data could be read.");

  const get = <T>(index: number, fallback: T): T => {
    const result = results[index];
    return result?.status === "fulfilled" ? (result.value as T) : fallback;
  };
  const sleep = get<SleepData | null>(0, null);
  const hrvSamples = get<Awaited<ReturnType<HealthProvider["getHRV"]>>>(
    1,
    [],
  ).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const restingHeartRate = get<number | null>(2, null);
  const respiratoryRate = get<number | null>(3, null);
  const strainInputs = get<StrainInputs>(4, fallbackStrain);
  const nutrition = get<NutritionData | null>(5, null);
  const glucose = get<GlucoseData | null>(6, null);
  const stressSamples = get<StressSample[]>(7, []).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const hrv = hrvSamples.at(-1)?.value ?? null;
  const sleepScore = sleep ? calculateSleepScore(sleep) : null;
  const strainScore =
    strainInputs.heartRateSamples.length || strainInputs.activeEnergyKcal > 0
      ? calculateStrainScore(strainInputs)
      : null;
  const stress = stressSamples.length
    ? calculateStressTimeline(
        stressSamples,
        restingHeartRate ?? strainInputs.restingHeartRate,
        48,
      )
    : null;
  const recoveryScore =
    hrv !== null &&
    restingHeartRate !== null &&
    sleepScore !== null &&
    respiratoryRate !== null
      ? calculateRecoveryScore({
          hrv,
          hrvBaseline: 48,
          restingHeartRate,
          restingHeartRateBaseline: 58,
          sleepPerformance: sleepScore,
          respiratoryRate,
          respiratoryRateBaseline: 15,
        })
      : null;
  const restorativeMinutes = stress
    ? stress.samples.filter((sample) => sample.value <= 25).length * 5
    : 0;
  const energyBattery =
    stress && strainScore !== null && sleepScore !== null
      ? calculateEnergyBattery({
          sleepPerformance: sleepScore,
          strain: strainScore,
          stressAverage: stress.average,
          restMinutes: restorativeMinutes,
        })
      : null;

  return {
    source: provider.kind,
    permissionState:
      provider.kind === "mock"
        ? permissionState
        : fulfilled < results.length
          ? "partial"
          : permissionState,
    sleep,
    sleepScore,
    recoveryScore,
    strainScore,
    stress,
    energyBattery,
    activeEnergyKcal: strainInputs.activeEnergyKcal,
    hrv: hrv ?? (hrvSamples.length ? averageSamples(hrvSamples, 0) : null),
    restingHeartRate,
    respiratoryRate,
    nutrition,
    glucose,
    sectionErrors: {
      sleep: results[0]?.status === "rejected",
      recovery:
        results[1]?.status === "rejected" ||
        results[2]?.status === "rejected" ||
        results[3]?.status === "rejected",
      strain: results[4]?.status === "rejected",
      stress: results[7]?.status === "rejected",
      nutrition: results[5]?.status === "rejected",
      glucose: results[6]?.status === "rejected",
    },
  };
}
