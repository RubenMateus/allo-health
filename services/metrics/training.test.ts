import {
  breakdownByActivity,
  compareWeeks,
  estimateMaxHeartRate,
  heartRateByMinute,
  heartRateZone,
  loadGauge,
  weeklyZoneMinutes,
  workoutZoneMinutes,
  type FitnessDay,
} from "./index";
import type { Workout } from "@/services/health/types";

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w",
    activity: "Run",
    category: "cardio",
    startedAt: "2026-10-24T08:00:00.000",
    endedAt: "2026-10-24T08:10:00.000",
    activeEnergyKcal: 100,
    heartRate: { average: 150, peak: null, recovery: null },
    ...overrides,
  };
}

const day = (minutes: number): FitnessDay => ({
  date: "",
  minutes,
  sessions: 1,
  load: 0,
  cardioLoad: 0,
  muscularLoad: 0,
  energyKcal: minutes * 10,
});

describe("training metrics", () => {
  it("compares the last 7 days with its 28-day history", () => {
    const steady = loadGauge(Array(28).fill(10));
    expect(steady.value).toBe(70);
    expect(steady.optimal).toEqual([56, 91]);
    expect(steady.status).toBe("OPTIMAL");
    expect(loadGauge([...Array(21).fill(0), ...Array(7).fill(30)]).status).toBe(
      "ABOVE",
    );
    expect(loadGauge(Array(28).fill(0)).status).toBe("NO DATA");
  });

  it("builds running totals for this week and last", () => {
    const days = [...Array(7).fill(day(10)), ...Array(7).fill(day(20))];
    const minutes = compareWeeks(days, (d) => d.minutes);
    expect(minutes.previous.at(-1)).toBe(70);
    expect(minutes.current).toEqual([20, 40, 60, 80, 100, 120, 140]);
    expect(minutes.total).toBe(140);
  });

  it("groups workouts by activity, longest first", () => {
    const result = breakdownByActivity([
      workout(),
      workout({ activity: "Ride", endedAt: "2026-10-24T09:00:00.000" }),
      workout(),
    ]);
    expect(result.map((entry) => [entry.activity, entry.sessions])).toEqual([
      ["Ride", 1],
      ["Run", 2],
    ]);
  });

  it("places heart rates in zones of max heart rate", () => {
    expect(estimateMaxHeartRate(36)).toBe(183);
    expect(estimateMaxHeartRate(null)).toBe(190);
    expect(heartRateZone(90, 200)).toBe(0);
    expect(heartRateZone(130, 200)).toBe(2);
    expect(heartRateZone(185, 200)).toBe(5);
  });

  it("counts zone minutes from the per-minute trace, or the average", () => {
    const traced = workout({ heartRateByMinute: [110, 130, 130, 0, 175] });
    expect(workoutZoneMinutes(traced, 200)).toEqual([1, 2, 0, 1, 0]);
    expect(workoutZoneMinutes(workout(), 200)).toEqual([0, 0, 10, 0, 0]);
  });

  it("averages samples into minutes", () => {
    const trace = heartRateByMinute(
      [
        { value: 100, unit: "bpm", timestamp: "2026-10-24T08:00:10.000" },
        { value: 110, unit: "bpm", timestamp: "2026-10-24T08:00:50.000" },
        { value: 140, unit: "bpm", timestamp: "2026-10-24T08:02:30.000" },
      ],
      "2026-10-24T08:00:00.000",
      "2026-10-24T08:03:00.000",
    );
    expect(trace).toEqual([105, 0, 140]);
  });

  it("splits zone minutes into rolling weeks", () => {
    const weeks = weeklyZoneMinutes(
      [
        workout(),
        workout({
          startedAt: "2026-10-10T08:00:00.000",
          endedAt: "2026-10-10T08:10:00.000",
        }),
      ],
      200,
      new Date("2026-10-24T20:00:00"),
      3,
    );
    expect(weeks.map((week) => week.minutes[2])).toEqual([10, 0, 10]);
  });
});
