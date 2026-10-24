import type {
  BiologicalSex,
  BiomarkerKind,
  HealthProfile,
  HealthSample,
} from "@/services/health/types";

import { dayKey } from "./fitness";

export type BiomarkerTone = "positive" | "neutral" | "caution" | "alert";

export type TrendDirection = "increasing" | "stable" | "decreasing";

export type BiomarkerTrend = {
  direction: TrendDirection;
  /** Mean of the last 7 days minus the mean of the 30 days before them. */
  change: number;
};

export type BiomarkerStatus = {
  label: string;
  tone: BiomarkerTone;
  /** Which rule produced the label, so detail pages can explain it. */
  basis: "trend" | "rating";
};

export type BiomarkerSummary = {
  kind: BiomarkerKind;
  latest: HealthSample | null;
  trend: BiomarkerTrend | null;
  status: BiomarkerStatus | null;
};

const DAY_MS = 86_400_000;

/** Collapses readings into one average per local day, oldest first. */
export function dailyAverages(samples: HealthSample[]): HealthSample[] {
  const days = new Map<
    string,
    { total: number; count: number; unit: string }
  >();
  for (const sample of samples) {
    const key = dayKey(new Date(sample.timestamp));
    const day = days.get(key) ?? { total: 0, count: 0, unit: sample.unit };
    day.total += sample.value;
    day.count += 1;
    days.set(key, day);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, day]) => ({
      value: day.total / day.count,
      unit: day.unit,
      timestamp: new Date(`${key}T00:00:00`).toISOString(),
    }));
}

// The smallest change between the last week and the month before it that counts as
// a real move rather than day-to-day noise, in each metric's own unit.
const trendThresholds: Record<BiomarkerKind, (baseline: number) => number> = {
  weight: (baseline) => baseline * 0.01,
  leanBodyMass: (baseline) => baseline * 0.01,
  bodyFat: () => 0.5,
  hrv: (baseline) => baseline * 0.05,
  restingHeartRate: (baseline) => baseline * 0.03,
  vo2Max: (baseline) => baseline * 0.02,
  bloodOxygen: () => 1,
  respiratoryRate: () => 0.5,
};

export function calculateTrend(
  kind: BiomarkerKind,
  history: HealthSample[],
  now = new Date(),
): BiomarkerTrend | null {
  const ageInDays = (sample: HealthSample) =>
    (now.getTime() - new Date(sample.timestamp).getTime()) / DAY_MS;
  const recent = history.filter((sample) => ageInDays(sample) < 7);
  const baseline = history.filter((sample) => {
    const age = ageInDays(sample);
    return age >= 7 && age < 37;
  });
  if (recent.length === 0 || baseline.length < 2) return null;
  const mean = (samples: HealthSample[]) =>
    samples.reduce((total, sample) => total + sample.value, 0) / samples.length;
  const baselineMean = mean(baseline);
  const change = mean(recent) - baselineMean;
  const threshold = trendThresholds[kind](baselineMean);
  return {
    direction:
      change > threshold
        ? "increasing"
        : change < -threshold
          ? "decreasing"
          : "stable",
    change,
  };
}

/** Whole years between a YYYY-MM-DD birth date and `now`. */
export function ageOn(birthDate: string, now = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  let age = now.getFullYear() - year;
  if (
    now.getMonth() + 1 < month ||
    (now.getMonth() + 1 === month && now.getDate() < day)
  )
    age -= 1;
  return age;
}

// FRIEND registry treadmill reference standards (Kaminsky et al., Mayo Clinic
// Proceedings, 2022): 10th, 50th and 90th percentile VO2 max in ml/kg/min for each
// age decade, keyed by the decade's midpoint.
type Percentiles = readonly [p10: number, p50: number, p90: number];
const vo2MaxReference: Record<BiologicalSex, Array<[number, Percentiles]>> = {
  male: [
    [25, [28.6, 46.5, 58.6]],
    [35, [24.9, 39.7, 55.5]],
    [45, [22.1, 35.3, 50.8]],
    [55, [18.6, 29.2, 43.4]],
    [65, [15.8, 24.6, 37.1]],
    [75, [13.6, 20.6, 29.4]],
    [85, [12.9, 17.6, 22.8]],
  ],
  female: [
    [25, [22.5, 36.6, 49.0]],
    [35, [18.6, 28.3, 42.1]],
    [45, [17.2, 25.7, 37.8]],
    [55, [16.5, 22.9, 32.4]],
    [65, [13.4, 19.6, 27.3]],
    [75, [12.3, 17.2, 22.8]],
    [85, [11.4, 15.4, 20.8]],
  ],
};

function referenceAt(sex: BiologicalSex, age: number): Percentiles {
  const table = vo2MaxReference[sex];
  const first = table[0]!;
  const last = table.at(-1)!;
  if (age <= first[0]) return first[1];
  if (age >= last[0]) return last[1];
  const upperIndex = table.findIndex(([midpoint]) => midpoint >= age);
  const [lowAge, low] = table[upperIndex - 1]!;
  const [highAge, high] = table[upperIndex]!;
  const t = (age - lowAge) / (highAge - lowAge);
  return low.map((value, index) => value + (high[index]! - value) * t) as [
    number,
    number,
    number,
  ];
}

// Standard normal CDF (Abramowitz and Stegun 7.1.26), accurate to ~1e-7.
function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Estimated population percentile (0–100) of a VO2 max for an age and sex. */
export function vo2MaxPercentile(
  vo2Max: number,
  age: number,
  sex: BiologicalSex,
): number {
  const [p10, p50, p90] = referenceAt(sex, age);
  // The spread differs above and below the median, so each side gets its own SD.
  const spread = (vo2Max >= p50 ? p90 - p50 : p50 - p10) / 1.2816;
  return normalCdf((vo2Max - p50) / spread) * 100;
}

export function vo2MaxRating(percentile: number): BiomarkerStatus {
  const [label, tone]: [string, BiomarkerTone] =
    percentile >= 80
      ? ["Superior", "positive"]
      : percentile >= 60
        ? ["Excellent", "positive"]
        : percentile >= 40
          ? ["Good", "positive"]
          : percentile >= 20
            ? ["Fair", "caution"]
            : ["Poor", "alert"];
  return { label, tone, basis: "rating" };
}

/**
 * The age at which this VO2 max is the median for the person's sex, from the
 * same reference standards. Clamped to the 20–89 range the standards cover.
 */
export function fitnessAge(vo2Max: number, sex: BiologicalSex): number {
  const medians = vo2MaxReference[sex].map(
    ([midpoint, [, p50]]) => [midpoint, p50] as const,
  );
  if (vo2Max >= medians[0]![1]) {
    // Above the youngest median: extend the first decade's slope, down to 20.
    const [[a1, m1], [a2, m2]] = [medians[0]!, medians[1]!];
    return Math.max(20, a1 - ((vo2Max - m1) / (m1 - m2)) * (a2 - a1));
  }
  for (let index = 1; index < medians.length; index += 1) {
    const [lowAge, lowMedian] = medians[index - 1]!;
    const [highAge, highMedian] = medians[index]!;
    if (vo2Max >= highMedian)
      return (
        lowAge +
        ((lowMedian - vo2Max) / (lowMedian - highMedian)) * (highAge - lowAge)
      );
  }
  return 89;
}

/** General adult ranges; resting heart rate has no meaningful sex split. */
export function restingHeartRateRating(bpm: number): BiomarkerStatus {
  const [label, tone]: [string, BiomarkerTone] =
    bpm < 55
      ? ["Excellent", "positive"]
      : bpm < 65
        ? ["Good", "positive"]
        : bpm < 75
          ? ["Fair", "caution"]
          : ["Elevated", "alert"];
  return { label, tone, basis: "rating" };
}

// American Council on Exercise body fat categories.
export function bodyFatRating(
  percent: number,
  sex: BiologicalSex,
): BiomarkerStatus {
  const [athletic, fit, average] =
    sex === "female" ? [21, 25, 32] : [14, 18, 25];
  const [label, tone]: [string, BiomarkerTone] =
    percent < athletic
      ? ["Athletic", "positive"]
      : percent < fit
        ? ["Fit", "positive"]
        : percent < average
          ? ["Average", "neutral"]
          : ["High", "caution"];
  return { label, tone, basis: "rating" };
}

export function bloodOxygenRating(percent: number): BiomarkerStatus {
  const [label, tone]: [string, BiomarkerTone] =
    percent >= 95
      ? ["Normal", "positive"]
      : percent >= 90
        ? ["Low", "caution"]
        : ["Very low", "alert"];
  return { label, tone, basis: "rating" };
}

const trendLabels: Partial<
  Record<BiomarkerKind, Record<TrendDirection, [string, BiomarkerTone]>>
> = {
  hrv: {
    increasing: ["Above baseline", "positive"],
    stable: ["Within baseline", "neutral"],
    decreasing: ["Below baseline", "caution"],
  },
  respiratoryRate: {
    increasing: ["Above baseline", "caution"],
    stable: ["Within baseline", "neutral"],
    decreasing: ["Below baseline", "neutral"],
  },
};

function trendStatus(
  kind: BiomarkerKind,
  trend: BiomarkerTrend,
): BiomarkerStatus {
  const [label, tone] = trendLabels[kind]?.[trend.direction] ?? [
    trend.direction === "increasing"
      ? "Increasing"
      : trend.direction === "decreasing"
        ? "Decreasing"
        : "Stable",
    "neutral",
  ];
  return { label, tone, basis: "trend" };
}

export function summarizeBiomarker(
  kind: BiomarkerKind,
  history: HealthSample[],
  profile: HealthProfile,
  now = new Date(),
): BiomarkerSummary {
  const latest = history.at(-1) ?? null;
  const trend = calculateTrend(kind, history, now);
  const age = profile.birthDate ? ageOn(profile.birthDate, now) : null;
  let status: BiomarkerStatus | null = null;
  if (latest) {
    if (kind === "vo2Max" && age !== null && profile.sex)
      status = vo2MaxRating(vo2MaxPercentile(latest.value, age, profile.sex));
    else if (kind === "restingHeartRate")
      status = restingHeartRateRating(latest.value);
    else if (kind === "bodyFat" && profile.sex)
      status = bodyFatRating(latest.value, profile.sex);
    else if (kind === "bloodOxygen") status = bloodOxygenRating(latest.value);
  }
  status ??= trend ? trendStatus(kind, trend) : null;
  return { kind, latest, trend, status };
}
