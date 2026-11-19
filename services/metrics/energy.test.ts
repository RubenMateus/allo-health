import type { SleepSegment } from "@/services/health/types";

import type { DailyScore } from "./daily";
import {
  calculateEnergyDay,
  ENERGY_OPENING,
  energyCoaching,
  energyUsual,
} from "./energy";

const date = "2026-11-10";
const at = (time: string, day = 10) => {
  const [h, m] = time.split(":").map(Number);
  return new Date(2026, 10, day, h, m).toISOString();
};
const minutes = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/** 5-minute readings stamped at bucket ends, from `from` (exclusive) to `to` (inclusive). */
function readings(from: string, to: string, value: number) {
  const out: { timestamp: string; value: number }[] = [];
  const start = new Date(at(from)).getTime();
  const end = new Date(at(to)).getTime();
  for (let t = start + 5 * 60_000; t <= end; t += 5 * 60_000)
    out.push({ timestamp: new Date(t).toISOString(), value });
  return out;
}

const night: SleepSegment[] = [
  { stage: "deep", start: at("00:00"), end: at("02:30") },
  { stage: "rem", start: at("02:30"), end: at("05:00") },
  { stage: "light", start: at("05:00"), end: at("07:30") },
];

describe("calculateEnergyDay", () => {
  it("returns null without stress readings", () => {
    expect(calculateEnergyDay({ date, stress: [], sleepStages: [] })).toBeNull();
  });

  it("returns null when every reading is from before midnight", () => {
    expect(
      calculateEnergyDay({
        date,
        stress: [{ timestamp: at("23:30", 9), value: 30 }],
        sleepStages: [],
      }),
    ).toBeNull();
  });

  it("opens at 20", () => {
    const day = calculateEnergyDay({
      date,
      stress: [{ timestamp: at("09:00"), value: 30 }],
      sleepStages: [],
    })!;
    expect(ENERGY_OPENING).toBe(20);
    expect(Math.abs(day.points[0].value - 20)).toBeLessThanOrEqual(1);
  });

  it("charges overnight", () => {
    const day = calculateEnergyDay({
      date,
      stress: readings("00:00", "07:30", 10),
      sleepStages: night,
    })!;
    expect(day.hourly[7]).toBeGreaterThanOrEqual(80);
    expect(day.hourly[7]).toBeLessThanOrEqual(95);
  });

  it("calm awake charges, stress drains", () => {
    const run = (value: number) =>
      calculateEnergyDay({
        date,
        stress: [
          { timestamp: at("08:00"), value: 30 },
          ...readings("08:00", "09:00", value),
        ],
        sleepStages: [],
      })!;
    const startOf = (day: ReturnType<typeof run>) => day.points[0].value;
    const calm = run(10);
    expect(calm.close).toBeGreaterThan(startOf(calm));
    const mild = run(40);
    const high = run(80);
    expect(high.close).toBeLessThan(startOf(high));
    expect(startOf(high) - high.close).toBeGreaterThan(
      startOf(mild) - mild.close,
    );
  });

  it("gaps leave the balance unchanged", () => {
    const day = calculateEnergyDay({
      date,
      stress: [
        ...readings("00:00", "07:30", 10),
        ...readings("09:00", "10:00", 40),
        ...readings("14:00", "15:00", 40),
      ],
      sleepStages: night,
    })!;
    const at10 = day.points.find((p) => p.timestamp === at("10:00"))!.value;
    expect(day.hourly[11]).toBe(at10);
    expect(day.hourly[12]).toBe(at10);
    expect(day.hourly[13]).toBe(at10);
  });

  it("clamps to 0..100", () => {
    const drained = calculateEnergyDay({
      date,
      stress: readings("01:00", "21:00", 100),
      sleepStages: [],
    })!;
    expect(Math.min(...drained.points.map((p) => p.value))).toBe(0);
    const charged = calculateEnergyDay({
      date,
      stress: readings("00:00", "12:00", 10),
      sleepStages: [{ stage: "deep", start: at("00:00"), end: at("12:00") }],
    })!;
    expect(Math.max(...charged.points.map((p) => p.value))).toBe(100);
  });

  it("totals add up", () => {
    const day = calculateEnergyDay({
      date,
      stress: [
        ...readings("00:00", "07:30", 10),
        ...readings("07:30", "18:00", 60),
      ],
      sleepStages: night,
    })!;
    expect(day.charged).toBeGreaterThan(0);
    expect(day.drained).toBeGreaterThan(0);
    expect(
      Math.abs(ENERGY_OPENING + day.charged - day.drained - day.close),
    ).toBeLessThanOrEqual(1);
  });

  it("credits pre-midnight sleep at the first point", () => {
    const early: SleepSegment[] = [
      { stage: "light", start: at("22:30", 9), end: at("06:30") },
    ];
    const late: SleepSegment[] = [
      { stage: "light", start: at("00:00"), end: at("06:30") },
    ];
    const stress = readings("00:00", "06:30", 10);
    const a = calculateEnergyDay({ date, stress, sleepStages: early })!;
    const b = calculateEnergyDay({ date, stress, sleepStages: late })!;
    expect(a.points[0].value).toBeGreaterThan(20);
    expect(a.points[0].value).toBeGreaterThan(b.points[0].value);
    expect(a.hourly[0]).toBeGreaterThan(20);
  });

  it("lastCharged is the end of the latest charging run", () => {
    const day = calculateEnergyDay({
      date,
      stress: [
        ...readings("00:00", "07:00", 10),
        ...readings("07:00", "12:00", 70),
      ],
      sleepStages: [{ stage: "deep", start: at("00:00"), end: at("07:00") }],
    })!;
    const seven = day.points.find((p) => p.timestamp === at("07:00"))!;
    expect(day.lastCharged).toEqual({ at: at("07:00"), value: seven.value });
  });

  it("hourly is null after `until`", () => {
    const day = calculateEnergyDay({
      date,
      stress: readings("08:00", "13:00", 30),
      sleepStages: [],
      until: new Date(at("13:02")),
    })!;
    expect(day.hourly).toHaveLength(25);
    expect(day.hourly[13]).not.toBeNull();
    for (let h = 14; h <= 24; h++) expect(day.hourly[h]).toBeNull();
  });

  it("a finished day keeps its close through 24:00", () => {
    const day = calculateEnergyDay({
      date,
      stress: readings("08:00", "13:00", 30),
      sleepStages: [],
    })!;
    expect(day.hourly[24]).toBe(day.close);
    expect(day.points.at(-1)!.timestamp).toBe(at("00:00", 11));
    expect(day.points.at(-1)!.value).toBe(day.close);
  });

  it("sleep charges even where no heart rate was read", () => {
    const day = calculateEnergyDay({
      date,
      stress: [
        { timestamp: at("00:05"), value: 10 },
        { timestamp: at("07:30"), value: 10 },
      ],
      sleepStages: night,
    })!;
    expect(day.hourly[7]).toBeGreaterThanOrEqual(80);
  });

  it("points run from midnight to `until`", () => {
    const day = calculateEnergyDay({
      date,
      stress: readings("08:00", "13:00", 30),
      sleepStages: [],
      until: new Date(at("15:02")),
    })!;
    expect(day.points[0]).toEqual({ timestamp: at("00:00"), value: 20 });
    expect(minutes(day.points.at(-1)!.timestamp)).toBe(15 * 60);
    expect(day.points.at(-1)!.value).toBe(day.close);
  });
});

const stored = (day: number, at9: number | null, withEnergy = true) =>
  ({
    date: `2026-11-${String(day).padStart(2, "0")}`,
    energy: withEnergy
      ? {
          hourly: Array.from({ length: 25 }, (_, h) => (h === 9 ? at9 : 50)),
          charged: 0,
          drained: 0,
          close: 50,
          lastCharged: null,
        }
      : null,
  }) as DailyScore;

describe("energyUsual", () => {
  it("usual is null with fewer than 5 days", () => {
    const days = [1, 2, 3, 4].map((d) => stored(d, 60));
    days.push(stored(5, 60, false), stored(6, 60, false));
    expect(energyUsual(days, 9)).toBeNull();
  });

  it("usual is the median at that hour", () => {
    const days = [40, 50, 60, 70, 90].map((v, i) => stored(i + 1, v));
    expect(energyUsual(days, 9)).toBe(60);
  });

  it("uses only the latest 14 days", () => {
    const days = Array.from({ length: 16 }, (_, i) =>
      stored(i + 1, i < 2 ? 0 : 70),
    );
    expect(energyUsual(days, 9)).toBe(70);
  });
});

describe("energyCoaching", () => {
  const today = { at: "14:00", isToday: true };
  it("is still learning without a usual", () => {
    expect(energyCoaching({ ...today, value: 42, usual: null })).toBe(
      "Still learning your usual pattern. Check back after a few more days.",
    );
  });
  it("compares today with usual at that time", () => {
    expect(energyCoaching({ ...today, value: 42, usual: 55 })).toBe(
      "Your Energy Bank is 13% lower than usual for 14:00.",
    );
    expect(energyCoaching({ ...today, value: 70, usual: 60 })).toBe(
      "Your Energy Bank is 10% higher than usual for 14:00.",
    );
    expect(energyCoaching({ ...today, value: 62, usual: 60 })).toBe(
      "Your Energy Bank is about the same as usual for 14:00.",
    );
  });
  it("compares a past day's close", () => {
    const past = { at: "24:00", isToday: false };
    expect(energyCoaching({ ...past, value: 30, usual: 45 })).toBe(
      "You ended the day 15% lower than usual.",
    );
    expect(energyCoaching({ ...past, value: 53, usual: 45 })).toBe(
      "You ended the day 8% higher than usual.",
    );
    expect(energyCoaching({ ...past, value: 47, usual: 45 })).toBe(
      "You ended the day about the same as usual.",
    );
  });
});
