import { buildSleepTimeline, stageMinutes } from "./nativeSamples";

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
