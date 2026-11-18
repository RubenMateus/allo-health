import type { DailyScore } from "@/services/metrics/daily";

import {
  daysInPeriod,
  isRecentPeriod,
  periodContaining,
  shiftPeriod,
  summarizeScores,
} from "./summary";

const signal = { value: null, baseline: 0, baselineDays: 0, building: true };

function score(
  date: string,
  recovery: number | null,
  strain: number | null,
  sleep: number | null,
): DailyScore {
  return {
    date,
    recovery,
    strain,
    sleepScore: sleep,
    strainBreakdown: null,
    recoveryInputs: {
      hrv: signal,
      restingHeartRate: signal,
      respiratoryRate: signal,
      sleepScore: sleep,
    },
    computedAt: `${date}T23:00:00.000Z`,
  };
}

describe("periodContaining", () => {
  it("weeks run Monday to Sunday across a month boundary", () => {
    expect(periodContaining("week", "2026-12-02")).toEqual({
      kind: "week",
      start: "2026-11-30",
      end: "2026-12-06",
    });
  });

  it("a Sunday belongs to the week that started the Monday before", () => {
    expect(periodContaining("week", "2026-11-22").start).toBe("2026-11-16");
  });

  it("months are calendar months, leap years included", () => {
    expect(periodContaining("month", "2028-02-10")).toEqual({
      kind: "month",
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });
});

it("shiftPeriod moves whole periods", () => {
  expect(shiftPeriod(periodContaining("month", "2026-01-15"), -1)).toEqual({
    kind: "month",
    start: "2025-12-01",
    end: "2025-12-31",
  });
  expect(shiftPeriod(periodContaining("week", "2026-11-18"), 1).start).toBe(
    "2026-11-23",
  );
});

it("isRecentPeriod is true only for this and the previous period", () => {
  const today = "2026-11-18";
  const week = periodContaining("week", today);
  expect(isRecentPeriod(week, today)).toBe(true);
  expect(isRecentPeriod(shiftPeriod(week, -1), today)).toBe(true);
  expect(isRecentPeriod(shiftPeriod(week, -2), today)).toBe(false);
  const month = periodContaining("month", today);
  expect(isRecentPeriod(shiftPeriod(month, -1), today)).toBe(true);
  expect(isRecentPeriod(shiftPeriod(month, -2), today)).toBe(false);
});

it("daysInPeriod stops at today for the current period", () => {
  expect(daysInPeriod(periodContaining("week", "2026-11-18"), "2026-11-18")).toEqual([
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
  ]);
  expect(daysInPeriod(periodContaining("week", "2026-11-04"), "2026-11-18")).toHaveLength(7);
});

describe("summarizeScores", () => {
  it("averages scored days, skips nulls, picks best and toughest by recovery", () => {
    const s = summarizeScores(
      [score("2026-11-16", 80, 10, 70), null, score("2026-11-18", 40, 14, 60)],
      [],
    );
    expect(s.scoredDays).toBe(2);
    expect(s.averages).toEqual({ recovery: 60, strain: 12, sleep: 65 });
    expect(s.best?.date).toBe("2026-11-16");
    expect(s.toughest?.date).toBe("2026-11-18");
  });

  it("days with a null recovery are not scored", () => {
    const s = summarizeScores([score("2026-11-16", null, 10, 70)], []);
    expect(s.scoredDays).toBe(0);
    expect(s.best).toBeNull();
  });

  it("deltas are null when the previous period has no scores", () => {
    expect(
      summarizeScores([score("2026-11-16", 80, 10, 70)], [null, null]).deltas,
    ).toEqual({ recovery: null, strain: null, sleep: null });
  });

  it("deltas compare with the previous period's averages", () => {
    expect(
      summarizeScores(
        [score("2026-11-16", 80, 10, 70)],
        [score("2026-11-09", 70, 12, 70)],
      ).deltas,
    ).toEqual({ recovery: 10, strain: -2, sleep: 0 });
  });
});
