import type { SleepSegment, StressSample } from "@/services/health/types";

import { calculateEnergyDay } from "./energy";
import { calculateStressTimeline } from "./index";

/**
 * Typical days for an adult with a resting heart rate of 55 bpm and an HRV
 * baseline of 50 ms, run through the real stress and energy pipeline. These pin
 * the hand-tuned rates to sensible outcomes.
 */
const RESTING_HR = 55;
const HRV_BASELINE = 50;
const date = "2026-11-10";
const at = (h: number, m = 0, day = 10) =>
  new Date(2026, 10, day, h, m).toISOString();

type Block = [fromHour: number, toHour: number, heartRate: number, hrv: number];

function day(blocks: Block[]) {
  const samples: StressSample[] = [];
  for (const [from, to, heartRate, hrv] of blocks)
    for (let t = from * 60 + 5; t <= to * 60; t += 5)
      samples.push({ timestamp: at(0, t), heartRate, hrv });
  return calculateStressTimeline(samples, RESTING_HR, HRV_BASELINE).samples;
}

const goodNight: SleepSegment[] = [
  { stage: "light", start: at(23, 0, 9), end: at(1) },
  { stage: "deep", start: at(1), end: at(2, 30) },
  { stage: "light", start: at(2, 30), end: at(4) },
  { stage: "rem", start: at(4), end: at(5) },
  { stage: "light", start: at(5), end: at(6, 30) },
  { stage: "rem", start: at(6, 30), end: at(7, 30) },
];
const shortNight: SleepSegment[] = [
  { stage: "light", start: at(1, 30), end: at(3) },
  { stage: "deep", start: at(3), end: at(4) },
  { stage: "light", start: at(4), end: at(6, 30) },
];
const night: Block = [0, 7.5, 52, 62];
const desk: Block = [8.5, 12, 70, 46];
const deskAfternoon: Block = [13, 17.5, 70, 46];
const commute: Block[] = [
  [7.5, 8.5, 88, 38],
  [17.5, 18, 88, 38],
];
const lunchWalk: Block = [12, 13, 82, 42];
const evening: Block = [18.5, 23, 62, 52];

const run = (blocks: Block[], stages: SleepSegment[]) =>
  calculateEnergyDay({ date, stress: day(blocks), sleepStages: stages })!;

describe("energy rates on typical days", () => {
  it("a good night fills the bank to 80–95 by waking", () => {
    const office = run([night, ...commute, desk, lunchWalk, deskAfternoon, evening], goodNight);
    expect(office.hourly[8]).toBeGreaterThanOrEqual(80);
    expect(office.hourly[8]).toBeLessThanOrEqual(95);
  });

  it("an ordinary office day ends between 35 and 60", () => {
    const office = run([night, ...commute, desk, lunchWalk, deskAfternoon, evening], goodNight);
    expect(office.close).toBeGreaterThanOrEqual(35);
    expect(office.close).toBeLessThanOrEqual(60);
  });

  it("an hour of hard training costs 10–20 more than a quiet evening hour", () => {
    const quiet = run([night, ...commute, desk, lunchWalk, deskAfternoon, evening], goodNight);
    const training = run(
      [night, ...commute, desk, lunchWalk, deskAfternoon, [18.5, 19.5, 150, 25], [19.5, 23, 62, 52]],
      goodNight,
    );
    const cost = quiet.close - training.close;
    expect(cost).toBeGreaterThanOrEqual(10);
    expect(cost).toBeLessThanOrEqual(20);
  });

  it("a short night starts the day well below a good one", () => {
    const good = run([night, ...commute, desk], goodNight);
    const short = run([[0, 7.5, 54, 55], ...commute, desk], shortNight);
    expect(good.hourly[8]! - short.hourly[8]!).toBeGreaterThanOrEqual(20);
  });

  it("a lazy rest day keeps most of the morning's charge", () => {
    const rest = run([night, [7.5, 23, 63, 50]], goodNight);
    expect(rest.close).toBeGreaterThanOrEqual(80);
  });
});
