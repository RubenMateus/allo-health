import type {
  HealthSample,
  SleepData,
  StrainInputs,
  StressSample,
} from "@/services/health/types";
import { fromDayKey, toDayKey } from "@/services/journal";

import {
  calculateEnergyDay,
  energySleepStages,
  type EnergyPoint,
  type EnergySummary,
} from "./energy";
import {
  calculateRecoveryScore,
  calculateStressTimeline,
  calculateSleepScore,
  calculateStrainScore,
  strainFromWeightedMinutes,
} from "./index";

/** Recovery compares a day to the average of the days before it. */
export const BASELINE_DAYS = 30;
/**
 * When to read a past day's sleep: late afternoon picks the night that ended
 * that morning, not a later nap.
 */
export function sleepAsOf(day: Date): Date {
  const asOf = new Date(day);
  asOf.setHours(18, 0, 0, 0);
  return asOf;
}
/** Fewer days than this and the baseline isn't trusted yet. */
export const MIN_BASELINE_DAYS = 7;
/** Used while a personal baseline is still building. */
export const FALLBACK_BASELINES = {
  hrv: 48,
  restingHeartRate: 58,
  respiratoryRate: 15,
} as const;

export type SignalKind = keyof typeof FALLBACK_BASELINES;

export type RecoverySignal = {
  value: number | null;
  baseline: number;
  baselineDays: number;
  building: boolean;
};

export type StrainZone = {
  zone: 1 | 2 | 3 | 4 | 5;
  minutes: number;
  weight: number;
};

export type DailyScore = {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  strain: number | null;
  recovery: number | null;
  sleepScore: number | null;
  strainBreakdown: { zones: StrainZone[]; activeEnergyKcal: number } | null;
  recoveryInputs: {
    hrv: RecoverySignal;
    restingHeartRate: RecoverySignal;
    respiratoryRate: RecoverySignal;
    sleepScore: number | null;
  };
  /** The day's Energy Bank; null without stress readings (and for days stored before it existed). */
  energy: EnergySummary | null;
  computedAt: string;
};

const ZONES: readonly { zone: StrainZone["zone"]; from: number; weight: number }[] =
  [
    { zone: 5, from: 0.9, weight: 2 },
    { zone: 4, from: 0.8, weight: 1.4 },
    { zone: 3, from: 0.7, weight: 0.9 },
    { zone: 2, from: 0.6, weight: 0.5 },
    { zone: 1, from: -Infinity, weight: 0.2 },
  ];

/** The zone and weight for a heart-rate-reserve fraction (0 = resting, 1 = max). */
export function strainZoneOf(intensity: number): {
  zone: StrainZone["zone"];
  weight: number;
} {
  const match = ZONES.find((zone) => intensity >= zone.from) ?? ZONES[4]!;
  return { zone: match.zone, weight: match.weight };
}

const intensityOf = (inputs: StrainInputs, bpm: number) =>
  (bpm - inputs.restingHeartRate) /
  Math.max(inputs.maxHeartRate - inputs.restingHeartRate, 1);

const shiftDay = (date: string, days: number) => {
  const shifted = fromDayKey(date);
  shifted.setDate(shifted.getDate() + days);
  return toDayKey(shifted);
};

const dayOf = (sample: HealthSample) => toDayKey(new Date(sample.timestamp));

/** The average of the daily values in the 30 days before `date`. */
export function baselineFor(
  kind: SignalKind,
  history: HealthSample[],
  date: string,
): { baseline: number; baselineDays: number; building: boolean } {
  const from = shiftDay(date, -BASELINE_DAYS);
  const values = history
    .filter((sample) => {
      const key = dayOf(sample);
      return key >= from && key < date;
    })
    .map((sample) => sample.value);
  if (values.length < MIN_BASELINE_DAYS)
    return {
      baseline: FALLBACK_BASELINES[kind],
      baselineDays: values.length,
      building: true,
    };
  return {
    baseline: values.reduce((sum, value) => sum + value, 0) / values.length,
    baselineDays: values.length,
    building: false,
  };
}

/** One day's value from a daily-average series. */
export function dailyValue(history: HealthSample[], date: string) {
  return history.find((sample) => dayOf(sample) === date)?.value ?? null;
}

/**
 * The recovery signals for `date`: the platform's daily average, else
 * `latest` (today's live readings, so a day without an average yet still
 * scores). Past days pass no `latest`, so every past-day score is worked out
 * the same way, whether for its own page or for the history.
 */
export function signalsFor(
  histories: Record<SignalKind, HealthSample[]>,
  date: string,
  latest?: Record<SignalKind, number | null>,
): Record<SignalKind, number | null> {
  return {
    hrv: dailyValue(histories.hrv, date) ?? latest?.hrv ?? null,
    restingHeartRate:
      dailyValue(histories.restingHeartRate, date) ??
      latest?.restingHeartRate ??
      null,
    respiratoryRate:
      dailyValue(histories.respiratoryRate, date) ??
      latest?.respiratoryRate ??
      null,
  };
}

/** Minutes spent in each of the five zones, zone 1 first. */
export function strainZones(inputs: StrainInputs): StrainZone[] {
  const minutes = new Map<StrainZone["zone"], number>();
  for (const sample of inputs.heartRateSamples) {
    const { zone } = strainZoneOf(intensityOf(inputs, sample.value));
    minutes.set(zone, (minutes.get(zone) ?? 0) + sample.sampleMinutes);
  }
  return [...ZONES].reverse().map(({ zone, weight }) => ({
    zone,
    minutes: minutes.get(zone) ?? 0,
    weight,
  }));
}

/**
 * Strain after each heart-rate bucket. Active energy is spread evenly over the
 * buckets, so the last point equals the day's score.
 */
export function strainCurve(
  inputs: StrainInputs,
): { timestamp: string; strain: number }[] {
  const count = inputs.heartRateSamples.length;
  let weighted = 0;
  return inputs.heartRateSamples.map((sample, index) => {
    weighted +=
      sample.sampleMinutes *
      strainZoneOf(intensityOf(inputs, sample.value)).weight;
    return {
      timestamp: sample.timestamp,
      strain: strainFromWeightedMinutes(
        weighted,
        (inputs.activeEnergyKcal * (index + 1)) / count,
      ),
    };
  });
}

const signal = (
  kind: SignalKind,
  value: number | null,
  history: HealthSample[],
  date: string,
): RecoverySignal => ({ value, ...baselineFor(kind, history, date) });

/** Strain, sleep and recovery for one day, recovery against personal baselines. */
type ScoreDayInput = {
  date: string;
  sleep: SleepData | null;
  strainInputs: StrainInputs | null;
  signals: Record<SignalKind, number | null>;
  histories: Record<SignalKind, HealthSample[]>;
  now: Date;
  /** Every 5-minute stress bucket of the day, for the Energy Bank. */
  dayStress?: StressSample[];
};

export function scoreDay(input: ScoreDayInput): DailyScore {
  return scoreDayWithEnergy(input).score;
}

/** `scoreDay`, plus the Energy Bank's 5-minute points (which aren't stored). */
export function scoreDayWithEnergy(input: ScoreDayInput): {
  score: DailyScore;
  energyPoints: EnergyPoint[];
} {
  const { date, sleep, strainInputs, signals, histories } = input;
  const sleepScore = sleep ? calculateSleepScore(sleep) : null;
  const hasStrain =
    !!strainInputs &&
    (strainInputs.heartRateSamples.length > 0 ||
      strainInputs.activeEnergyKcal > 0);
  const recoveryInputs = {
    hrv: signal("hrv", signals.hrv, histories.hrv, date),
    restingHeartRate: signal(
      "restingHeartRate",
      signals.restingHeartRate,
      histories.restingHeartRate,
      date,
    ),
    respiratoryRate: signal(
      "respiratoryRate",
      signals.respiratoryRate,
      histories.respiratoryRate,
      date,
    ),
    sleepScore,
  };
  const { hrv, restingHeartRate, respiratoryRate } = recoveryInputs;
  const recovery =
    hrv.value !== null &&
    restingHeartRate.value !== null &&
    respiratoryRate.value !== null &&
    sleepScore !== null
      ? calculateRecoveryScore({
          hrv: hrv.value,
          hrvBaseline: hrv.baseline,
          restingHeartRate: restingHeartRate.value,
          restingHeartRateBaseline: restingHeartRate.baseline,
          sleepPerformance: sleepScore,
          respiratoryRate: respiratoryRate.value,
          respiratoryRateBaseline: respiratoryRate.baseline,
        })
      : null;
  const stress = input.dayStress?.length
    ? calculateStressTimeline(
        input.dayStress,
        restingHeartRate.value ?? restingHeartRate.baseline,
        hrv.baseline,
      ).samples
    : [];
  const energyDay = calculateEnergyDay({
    date,
    stress,
    sleepStages: energySleepStages(sleep, date),
    // Today stops at now. A finished day runs to midnight; a past day scored as
    // of its last millisecond (23:59:59.999) counts as finished too.
    until:
      toDayKey(new Date(input.now.getTime() + 1)) === date
        ? input.now
        : undefined,
  });
  const { points: energyPoints = [], ...energy } = energyDay ?? {};
  const score: DailyScore = {
    date,
    strain: hasStrain ? calculateStrainScore(strainInputs) : null,
    recovery,
    sleepScore,
    strainBreakdown: hasStrain
      ? {
          zones: strainZones(strainInputs),
          activeEnergyKcal: strainInputs.activeEnergyKcal,
        }
      : null,
    recoveryInputs,
    energy: energyDay ? (energy as EnergySummary) : null,
    computedAt: input.now.toISOString(),
  };
  return { score, energyPoints };
}

/** Lower is better for resting heart rate and breathing rate. */
const higherIsBetter: Record<SignalKind, boolean> = {
  hrv: true,
  restingHeartRate: false,
  respiratoryRate: false,
};

/** Today's value against the baseline, or null while there is nothing to compare. */
export function compareToBaseline(
  kind: SignalKind,
  value: RecoverySignal,
): { percent: number; better: boolean } | null {
  if (value.building || value.value === null) return null;
  const difference = value.value - value.baseline;
  return {
    percent: Math.round((difference / Math.max(value.baseline, 1)) * 100),
    better: higherIsBetter[kind] ? difference >= 0 : difference <= 0,
  };
}
