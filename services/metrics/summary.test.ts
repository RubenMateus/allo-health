import type { Workout } from "@/services/health/types";
import type { JournalEntry, JournalTag } from "@/services/journal/types";
import type { DailyScore } from "@/services/metrics/daily";

import {
  daysInPeriod,
  isRecentPeriod,
  periodContaining,
  shiftPeriod,
  suggestionsFor,
  summarizeJournal,
  summarizeScores,
  summarizeWorkouts,
  tagEffects,
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
    energy: null,
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

function workout(startedAt: string, minutes: number, kcal: number | null): Workout {
  const end = new Date(new Date(startedAt).getTime() + minutes * 60_000);
  return {
    id: startedAt,
    activity: "Running",
    category: "cardio",
    startedAt,
    endedAt: end.toISOString(),
    activeEnergyKcal: kcal,
    heartRate: { average: null, max: null, peak: null, recovery: null },
  } as Workout;
}

function entry(date: string, tags: JournalTag[] = [], mood = 3, energy = 3): JournalEntry {
  return {
    date,
    mood: mood as JournalEntry["mood"],
    energy: energy as JournalEntry["energy"],
    tags,
    note: "",
    updatedAt: `${date}T20:00:00`,
  };
}

const week = periodContaining("week", "2026-11-18"); // 16–22 Nov

describe("summarizeWorkouts", () => {
  it("counts only workouts that start inside the period", () => {
    const totals = summarizeWorkouts(
      [
        workout("2026-11-15T10:00:00", 30, 200),
        workout("2026-11-16T10:00:00", 45, 300),
        workout("2026-11-20T18:00:00", 30, null),
      ],
      week,
    );
    expect(totals).toEqual({
      count: 2,
      minutes: 75,
      activeEnergyKcal: 300,
      byCategory: { cardio: 2, strength: 0, mixed: 0 },
    });
  });
});

describe("summarizeJournal", () => {
  it("is empty when nothing was logged", () => {
    expect(summarizeJournal([entry("2026-11-10")], week)).toEqual({
      loggedDays: 0,
      averageMood: null,
      averageEnergy: null,
      topTags: [],
    });
  });

  it("averages mood and energy and ranks tags by days", () => {
    const s = summarizeJournal(
      [
        entry("2026-11-16", ["alcohol", "caffeine"], 4, 2),
        entry("2026-11-17", ["caffeine"], 2, 4),
      ],
      week,
    );
    expect(s.loggedDays).toBe(2);
    expect(s.averageMood).toBe(3);
    expect(s.averageEnergy).toBe(3);
    expect(s.topTags).toEqual([
      { tag: "caffeine", days: 2 },
      { tag: "alcohol", days: 1 },
    ]);
  });
});

const byDay = (days: DailyScore[]) =>
  Object.fromEntries(days.map((d) => [d.date, d])) as Record<string, DailyScore | null>;

describe("tagEffects", () => {
  it("compares next-day recovery with the period average", () => {
    const scores = byDay([
      score("2026-11-16", 70, 10, 70),
      score("2026-11-17", 50, 10, 70),
      score("2026-11-18", 70, 10, 70),
      score("2026-11-19", 50, 10, 70),
    ]);
    // average recovery 60; days after alcohol (17, 19) average 50.
    const effects = tagEffects(
      [entry("2026-11-16", ["alcohol"]), entry("2026-11-18", ["alcohol"])],
      scores,
      week,
    );
    expect(effects).toEqual([{ tag: "alcohol", days: 2, recoveryDifference: -10 }]);
  });

  it("skips a tag whose next day falls outside the period", () => {
    const scores = byDay([
      score("2026-11-21", 70, 10, 70),
      score("2026-11-22", 50, 10, 70),
    ]);
    expect(
      tagEffects(
        [entry("2026-11-21", ["alcohol"]), entry("2026-11-22", ["alcohol"])],
        scores,
        week,
      ),
    ).toEqual([]);
  });
});

describe("suggestionsFor", () => {
  const scoresOf = (days: (DailyScore | null)[], previous: (DailyScore | null)[] = []) =>
    summarizeScores(days, previous);

  it("gives nothing with fewer than 3 scored days", () => {
    const days = [score("2026-11-16", 40, 14, 40), score("2026-11-17", 40, 14, 40)];
    expect(suggestionsFor({ days, scores: scoresOf(days), tagEffects: [] })).toEqual([]);
  });

  it("flags over-reaching for hard days on low recovery", () => {
    const days = [
      score("2026-11-16", 40, 14, 80),
      score("2026-11-17", 40, 14, 80),
      score("2026-11-18", 60, 10, 80),
    ];
    expect(suggestionsFor({ days, scores: scoresOf(days), tagEffects: [] })).toEqual([
      {
        id: "over-reaching",
        text: "Several hard days came on low recovery. Plan an easier day after a hard one.",
      },
    ]);
  });

  it("caps at three in priority order", () => {
    const days = [
      score("2026-11-16", 40, 14, 50),
      score("2026-11-17", 40, 14, 50),
      score("2026-11-18", 40, 10, 50),
    ];
    const previous = [score("2026-11-09", 80, 10, 80)];
    const out = suggestionsFor({
      days,
      scores: scoresOf(days, previous),
      tagEffects: [{ tag: "late-meal", days: 2, recoveryDifference: -12.4 }],
    });
    expect(out.map((s) => s.id)).toEqual(["over-reaching", "sleep", "tag"]);
    expect(out[2]!.text).toBe("Recovery was 12 lower the day after late meal.");
  });

  it("suggests pushing when easy days came on high recovery", () => {
    const days = [
      score("2026-11-16", 80, 8, 80),
      score("2026-11-17", 80, 8, 80),
      score("2026-11-18", 80, 8, 80),
    ];
    expect(suggestionsFor({ days, scores: scoresOf(days), tagEffects: [] })[0]!.id).toBe(
      "room-to-push",
    );
  });

  it("notes a recovery drop against the period before", () => {
    const days = [
      score("2026-11-16", 60, 10, 80),
      score("2026-11-17", 60, 10, 80),
      score("2026-11-18", 60, 10, 80),
    ];
    const out = suggestionsFor({
      days,
      scores: scoresOf(days, [score("2026-11-09", 70, 10, 80)]),
      tagEffects: [],
    });
    expect(out).toEqual([
      {
        id: "recovery-drop",
        text: "Recovery averaged 10 lower than the period before. Keep an eye on load and sleep.",
      },
    ]);
  });
});
