import { calculateEnergyBattery, calculateRecoveryScore, calculateSleepScore, calculateStrainScore, calculateStressTimeline } from './index';
import type { SleepData, StrainInputs } from '@/services/health/types';

const sleep: SleepData = { durationMinutes: 480, needMinutes: 480, efficiency: 1, deepMinutes: 96, remMinutes: 106, lastSleepAt: '2026-09-30T06:00:00.000Z' };
const strain: StrainInputs = { heartRateSamples: [], activeEnergyKcal: 0, restingHeartRate: 55, maxHeartRate: 190 };

describe('health metric estimates', () => {
  it('scores a full, efficient night at the top of the sleep scale', () => {
    expect(calculateSleepScore(sleep)).toBe(100);
  });

  it('returns a neutral recovery score when every input matches baseline', () => {
    expect(calculateRecoveryScore({ hrv: 50, hrvBaseline: 50, restingHeartRate: 60, restingHeartRateBaseline: 60, sleepPerformance: 50, respiratoryRate: 15, respiratoryRateBaseline: 15 })).toBe(50);
  });

  it('bounds strain to 0–21 and increases it with exertion', () => {
    expect(calculateStrainScore(strain)).toBe(0);
    expect(calculateStrainScore({ ...strain, activeEnergyKcal: 2000 })).toBe(12);
    expect(calculateStrainScore({ ...strain, activeEnergyKcal: 5000 })).toBe(21);
  });

  it('summarizes an empty stress timeline without NaN markers', () => {
    expect(calculateStressTimeline([], 60, 50)).toEqual({ samples: [], lowest: 0, highest: 0, average: 0 });
  });

  it('clamps the energy battery to its display range', () => {
    expect(calculateEnergyBattery({ sleepPerformance: 100, strain: 0, stressAverage: 0, restMinutes: 1000 })).toBe(100);
    expect(calculateEnergyBattery({ sleepPerformance: 0, strain: 21, stressAverage: 100, restMinutes: 0 })).toBe(6);
  });
});