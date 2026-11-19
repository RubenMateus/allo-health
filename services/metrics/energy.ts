import type { SleepSegment, SleepStage } from "@/services/health/types";
import { fromDayKey } from "@/services/journal";

/** Every day opens here at 00:00 and is computed on its own. */
export const ENERGY_OPENING = 20;

// Rates are points per 5-minute step. Tuned so a good ~7.5 h night takes the
// bank from about 20 to about 90, a calm waking hour adds ~2, a mildly stressed
// hour costs 3, and a hard hour (stress 80) costs about 10.
const SLEEP_RATES: Record<Exclude<SleepStage, "awake">, number> = {
  deep: 0.95,
  rem: 0.85,
  light: 0.6,
  asleep: 0.6,
};
const CALM_RATE = 0.15;
const CALM_MAX_STRESS = 25;
const MILD_MAX_STRESS = 50;
const MILD_DRAIN_RATE = 0.25;
/** Above MILD_MAX_STRESS: MILD_DRAIN_RATE plus this per stress point. */
const STRESS_DRAIN_PER_POINT = 0.02;
const STEP_MS = 5 * 60_000;
const HOUR_MS = 60 * 60_000;

export type EnergyPoint = { timestamp: string; value: number };
export type EnergySummary = {
  /** Balance at each hour 00:00..24:00; null for hours after `until`. */
  hourly: (number | null)[];
  charged: number;
  drained: number;
  /** Balance at the last reading. */
  close: number;
  lastCharged: { at: string; value: number } | null;
};
export type EnergyDay = EnergySummary & { points: EnergyPoint[] };

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function sleepRateAt(time: number, stages: SleepSegment[]): number | null {
  for (const segment of stages) {
    if (segment.stage === "awake") continue;
    if (
      new Date(segment.start).getTime() <= time &&
      time < new Date(segment.end).getTime()
    )
      return SLEEP_RATES[segment.stage];
  }
  return null;
}

function awakeDelta(stress: number): number {
  if (stress <= CALM_MAX_STRESS) return CALM_RATE;
  if (stress <= MILD_MAX_STRESS) return -MILD_DRAIN_RATE;
  return -(MILD_DRAIN_RATE + (stress - MILD_MAX_STRESS) * STRESS_DRAIN_PER_POINT);
}

/** Sleep before midnight of the night that ended this morning, as a charge. */
function preMidnightCredit(midnight: number, stages: SleepSegment[]): number {
  let credit = 0;
  for (const segment of stages) {
    if (segment.stage === "awake") continue;
    const start = new Date(segment.start).getTime();
    const end = Math.min(new Date(segment.end).getTime(), midnight);
    if (end > start) credit += ((end - start) / STEP_MS) * SLEEP_RATES[segment.stage];
  }
  return credit;
}

/**
 * The day's running energy balance from its 5-minute stress readings and the
 * night that ended that morning. Sleep charges (deep and REM most), calm waking
 * stretches charge a little, stress drains; a step with no reading changes
 * nothing. `until` (default the end of the day) is when the day is read as of.
 */
export function calculateEnergyDay(input: {
  date: string;
  stress: { timestamp: string; value: number }[];
  sleepStages: SleepSegment[];
  until?: Date;
}): EnergyDay | null {
  if (!input.stress.length) return null;
  const midnight = fromDayKey(input.date).getTime();
  const until = input.until?.getTime() ?? midnight + 24 * HOUR_MS;
  const stress = [...input.stress].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  let balance = ENERGY_OPENING;
  let charged = 0;
  let drained = 0;
  const apply = (delta: number) => {
    const next = clamp(balance + delta);
    if (next > balance) charged += next - balance;
    else drained += balance - next;
    balance = next;
    return next;
  };
  apply(preMidnightCredit(midnight, input.sleepStages));
  const opening = balance;

  const points: EnergyPoint[] = [];
  const times: number[] = [];
  let lastCharged: EnergySummary["lastCharged"] = null;
  for (const reading of stress) {
    const time = new Date(reading.timestamp).getTime();
    // Readings are stamped at their bucket's end; judge sleep at its middle.
    const rate = sleepRateAt(time - STEP_MS / 2, input.sleepStages);
    const before = balance;
    const value = Math.round(apply(rate ?? awakeDelta(reading.value)));
    points.push({ timestamp: reading.timestamp, value });
    times.push(time);
    if (balance > before) lastCharged = { at: reading.timestamp, value };
  }

  const hourly: (number | null)[] = [];
  let index = -1;
  for (let hour = 0; hour <= 24; hour++) {
    const time = midnight + hour * HOUR_MS;
    if (time > until) {
      hourly.push(null);
      continue;
    }
    while (index + 1 < times.length && times[index + 1] <= time) index++;
    hourly.push(index < 0 ? Math.round(opening) : points[index].value);
  }

  return {
    points,
    hourly,
    charged: Math.round(charged),
    drained: Math.round(drained),
    close: points[points.length - 1].value,
    lastCharged,
  };
}
