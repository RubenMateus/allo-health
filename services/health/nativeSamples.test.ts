import {
  buildDayStressSamples,
  buildSleepTimeline,
  stageMinutes,
} from "./nativeSamples";

const t = (hour: number, minute = 0) =>
  new Date(2026, 10, hour < 12 ? 17 : 16, hour, minute).getTime();
const iso = (hour: number, minute = 0) =>
  new Date(t(hour, minute)).toISOString();

describe("buildSleepTimeline", () => {
  it("fills uncovered time with awake, from bedtime to wake time", () => {
    const timeline = buildSleepTimeline(
      [
        { stage: "light", start: t(23, 30), end: t(1) },
        { stage: "deep", start: t(1, 10), end: t(6) },
      ],
      t(23),
      t(7),
    );

    expect(timeline).toEqual([
      { stage: "awake", start: iso(23), end: iso(23, 30) },
      { stage: "light", start: iso(23, 30), end: iso(1) },
      { stage: "awake", start: iso(1), end: iso(1, 10) },
      { stage: "deep", start: iso(1, 10), end: iso(6) },
      { stage: "awake", start: iso(6), end: iso(7) },
    ]);
  });

  it("gives overlapping time to the earlier interval and joins equal neighbours", () => {
    const timeline = buildSleepTimeline(
      [
        { stage: "light", start: t(23), end: t(1) },
        // A second writer repeats part of the night: only its tail is new.
        { stage: "deep", start: t(0), end: t(2) },
        { stage: "deep", start: t(2), end: t(3) },
      ],
      t(23),
      t(3),
    );

    expect(timeline).toEqual([
      { stage: "light", start: iso(23), end: iso(1) },
      { stage: "deep", start: iso(1), end: iso(3) },
    ]);
  });

  it("clips intervals to the bed window", () => {
    const timeline = buildSleepTimeline(
      [{ stage: "rem", start: t(22), end: t(8) }],
      t(23),
      t(7),
    );

    expect(timeline).toEqual([{ stage: "rem", start: iso(23), end: iso(7) }]);
    expect(stageMinutes(timeline).rem).toBe(480);
  });
});

describe("buildDayStressSamples", () => {
  const from = new Date(2026, 10, 10, 0, 0);
  const to = new Date(2026, 10, 11, 0, 0);
  const minuteSamples = (startHour: number, endHour: number) =>
    Array.from({ length: (endHour - startHour) * 60 }, (_, i) => ({
      value: 60,
      unit: "bpm",
      timestamp: new Date(2026, 10, 10, startHour, i + 0.5).toISOString(),
    }));

  it("keeps every bucket of the day", () => {
    const samples = buildDayStressSamples(minuteSamples(0, 12), [], from, to);
    expect(samples).toHaveLength(144);
    expect(samples[0].timestamp).toBe(new Date(2026, 10, 10, 0, 5).toISOString());
    expect(samples.at(-1)!.timestamp).toBe(
      new Date(2026, 10, 10, 12, 0).toISOString(),
    );
  });

  it("ignores readings outside the window", () => {
    const evening = {
      value: 90,
      unit: "bpm",
      timestamp: new Date(2026, 10, 9, 22, 0).toISOString(),
    };
    const samples = buildDayStressSamples(
      [evening, ...minuteSamples(8, 9)],
      [{ value: 40, unit: "ms", timestamp: new Date(2026, 10, 10, 8, 30).toISOString() }],
      from,
      to,
    );
    expect(samples).toHaveLength(12);
    expect(samples.every((s) => s.heartRate === 60 && s.hrv === 40)).toBe(true);
  });
});
