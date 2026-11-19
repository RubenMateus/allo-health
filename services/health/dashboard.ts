import { toDayKey } from "@/services/journal";
import {
  averageSamples,
  calculateStressTimeline,
} from "@/services/metrics";
import {
  BASELINE_DAYS,
  scoreDayWithEnergy,
  signalsFor,
  sleepAsOf,
  type DailyScore,
  type SignalKind,
} from "@/services/metrics/daily";
import type { EnergyPoint } from "@/services/metrics/energy";

import type {
  GlucoseData,
  HealthProvider,
  HealthSample,
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
  /** The day's scores (its `date` names the day) with what went into them; the same shape as stored history. */
  today: DailyScore;
  strainInputs: StrainInputs;
  stress: ReturnType<typeof calculateStressTimeline> | null;
  /** The day's Energy Bank in 5-minute steps; `today.energy` has the totals. */
  energyPoints: EnergyPoint[];
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
  day?: Date,
): Promise<DashboardData> {
  const now = new Date();
  const past = !!day && toDayKey(day) !== toDayKey(now);
  const asOf = past ? sleepAsOf(day) : undefined;
  const anchor = past ? new Date(day) : undefined;
  anchor?.setHours(23, 59, 59, 999);
  // The baseline histories don't depend on the day's reads, so both go at once,
  // even though they are wasted when every read below fails.
  const [results, histories] = await Promise.all([
    Promise.allSettled([
      provider.getSleep(asOf),
      provider.getHRV(day),
      provider.getRestingHR(day),
      provider.getRespiratoryRate(day),
      provider.getStrainInputs(day),
      provider.getNutrition(day),
      provider.getGlucose(day),
      provider.getStressSamples(day),
      provider.getDayStressSamples(day),
    ]),
    readSignalHistories(provider, BASELINE_DAYS + 1, anchor),
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
  const date = toDayKey(past ? day : now);
  const dayStress = get<StressSample[]>(8, []);
  const { score: today, energyPoints } = scoreDayWithEnergy({
    date,
    sleep,
    strainInputs,
    signals: signalsFor(
      histories,
      date,
      past ? undefined : { hrv, restingHeartRate, respiratoryRate },
    ),
    histories,
    // A past day is scored as of its end, which also ends its strain curve there.
    now: anchor ?? now,
    dayStress,
  });
  const { sleepScore, strain: strainScore } = today;
  const stress = stressSamples.length
    ? calculateStressTimeline(
        stressSamples,
        restingHeartRate ?? strainInputs.restingHeartRate,
        today.recoveryInputs.hrv.baseline,
      )
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
    today,
    strainInputs,
    stress,
    energyPoints,
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

const SIGNALS: SignalKind[] = ["hrv", "restingHeartRate", "respiratoryRate"];

/**
 * Daily averages for the recovery signals over the `days` before `anchor`'s day,
 * through the end of that day. A history that can't be read leaves that signal
 * on its fixed baseline.
 */
export async function readSignalHistories(
  provider: HealthProvider,
  days = BASELINE_DAYS + 1,
  anchor: Date = new Date(),
): Promise<Record<SignalKind, HealthSample[]>> {
  const since = new Date(anchor);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - days);
  // No later than now: today's window is still open.
  const endOfDay = new Date(anchor);
  endOfDay.setHours(23, 59, 59, 999);
  const until = new Date(Math.min(endOfDay.getTime(), Date.now()));
  const results = await Promise.allSettled(
    SIGNALS.map((kind) =>
      Promise.resolve().then(() =>
        provider.getBiomarkerHistory(kind, since, until),
      ),
    ),
  );
  return Object.fromEntries(
    SIGNALS.map((kind, index) => {
      const result = results[index];
      return [kind, result?.status === "fulfilled" ? result.value : []];
    }),
  ) as Record<SignalKind, HealthSample[]>;
}
