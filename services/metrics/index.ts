import type {
  HealthSample,
  SleepData,
  StrainInputs,
  StressSample,
} from "@/services/health/types";

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

export type RecoveryInputs = {
  hrv: number;
  hrvBaseline: number;
  restingHeartRate: number;
  restingHeartRateBaseline: number;
  sleepPerformance: number;
  respiratoryRate: number;
  respiratoryRateBaseline: number;
};

export type StressSummary = {
  samples: Array<{ timestamp: string; value: number }>;
  lowest: number;
  highest: number;
  average: number;
};

export function calculateSleepScore(sleep: SleepData): number {
  const durationScore = clamp(
    (sleep.durationMinutes / Math.max(sleep.needMinutes, 1)) * 100,
  );
  const deepRatio = sleep.deepMinutes / Math.max(sleep.durationMinutes, 1);
  const remRatio = sleep.remMinutes / Math.max(sleep.durationMinutes, 1);
  const stageScore = clamp(
    100 - Math.abs(deepRatio - 0.2) * 180 - Math.abs(remRatio - 0.22) * 140,
  );
  // Sleep estimate weights duration (50%), efficiency (30%), and stage balance (20%).
  return Math.round(
    clamp(
      durationScore * 0.5 + sleep.efficiency * 100 * 0.3 + stageScore * 0.2,
    ),
  );
}

export function calculateRecoveryScore(inputs: RecoveryInputs): number {
  const hrvScore = clamp(
    50 +
      ((inputs.hrv - inputs.hrvBaseline) / Math.max(inputs.hrvBaseline, 1)) *
        100,
  );
  const restingScore = clamp(
    50 +
      ((inputs.restingHeartRateBaseline - inputs.restingHeartRate) /
        Math.max(inputs.restingHeartRateBaseline, 1)) *
        160,
  );
  const respiratoryScore = clamp(
    50 +
      ((inputs.respiratoryRateBaseline - inputs.respiratoryRate) /
        Math.max(inputs.respiratoryRateBaseline, 1)) *
        180,
  );
  // Recovery weights HRV (35%), resting HR (30%), sleep performance (25%), and respiratory rate (10%).
  return Math.round(
    clamp(
      hrvScore * 0.35 +
        restingScore * 0.3 +
        inputs.sleepPerformance * 0.25 +
        respiratoryScore * 0.1,
    ),
  );
}

export function calculateStrainScore(inputs: StrainInputs): number {
  const reserve = Math.max(inputs.maxHeartRate - inputs.restingHeartRate, 1);
  const weightedZoneMinutes = inputs.heartRateSamples.reduce(
    (total, sample) => {
      const intensity = (sample.value - inputs.restingHeartRate) / reserve;
      const zoneWeight =
        intensity >= 0.9
          ? 2
          : intensity >= 0.8
            ? 1.4
            : intensity >= 0.7
              ? 0.9
              : intensity >= 0.6
                ? 0.5
                : 0.2;
      return total + sample.sampleMinutes * zoneWeight;
    },
    0,
  );
  // Strain estimates weighted heart-rate-zone minutes plus a small active-energy contribution, capped at 21.
  return (
    Math.round(
      clamp(
        weightedZoneMinutes * 0.075 + inputs.activeEnergyKcal * 0.006,
        0,
        21,
      ) * 10,
    ) / 10
  );
}

export function calculateStressTimeline(
  samples: StressSample[],
  restingHeartRate: number,
  hrvBaseline: number,
): StressSummary {
  const timeline = samples.map((sample) => {
    const heartRateLoad = clamp(
      ((sample.heartRate - restingHeartRate) / Math.max(restingHeartRate, 1)) *
        170,
    );
    const hrvLoad = clamp(
      ((hrvBaseline - sample.hrv) / Math.max(hrvBaseline, 1)) * 150,
    );
    return {
      timestamp: sample.timestamp,
      value: Math.round(clamp(heartRateLoad * 0.55 + hrvLoad * 0.45)),
    };
  });
  const values = timeline.map((sample) => sample.value);
  // Stress is an intraday estimate: 55% heart-rate elevation and 45% HRV suppression versus personal baselines.
  return {
    samples: timeline,
    lowest: values.length ? Math.min(...values) : 0,
    highest: values.length ? Math.max(...values) : 0,
    average: Math.round(average(values)),
  };
}

export function calculateEnergyBattery(input: {
  sleepPerformance: number;
  strain: number;
  stressAverage: number;
  restMinutes: number;
}): number {
  // The battery starts at 45 points, gains from sleep/rest, and drains with daily strain and average stress.
  return Math.round(
    clamp(
      45 +
        input.sleepPerformance * 0.35 +
        input.restMinutes * 0.025 -
        input.strain * 1.15 -
        input.stressAverage * 0.15,
    ),
  );
}

export function averageSamples(
  samples: HealthSample[],
  fallback: number,
): number {
  return samples.length
    ? average(samples.map((sample) => sample.value))
    : fallback;
}
