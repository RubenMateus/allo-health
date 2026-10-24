import {
  JOURNAL_TAGS,
  type JournalDraft,
  type JournalEntry,
  type JournalWeekSummary,
  type Rating,
} from "./types";

export * from "./types";

export const NOTE_MAX_LENGTH = 1000;

export const moodLabels: Record<Rating, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

export const energyLabels: Record<Rating, string> = {
  1: "Drained",
  2: "Tired",
  3: "Steady",
  4: "Charged",
  5: "Peak",
};

export const tagLabels: Record<(typeof JOURNAL_TAGS)[number], string> = {
  caffeine: "Caffeine",
  alcohol: "Alcohol",
  "late-meal": "Late meal",
  stress: "Stress",
  travel: "Travel",
  meditation: "Meditation",
  sauna: "Sauna",
  sick: "Sick",
};

const pad = (value: number) => value.toString().padStart(2, "0");

/** Local calendar day as `YYYY-MM-DD`, so entries follow the user's own midnight. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function shiftDayKey(key: string, days: number): string {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

function sortNewestFirst(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function upsertEntry(
  entries: JournalEntry[],
  draft: JournalDraft,
  now = new Date(),
): JournalEntry[] {
  const tags = JOURNAL_TAGS.filter((tag) => draft.tags.includes(tag));
  const entry: JournalEntry = {
    date: draft.date,
    mood: draft.mood,
    energy: draft.energy,
    tags,
    note: draft.note.trim().slice(0, NOTE_MAX_LENGTH),
    updatedAt: now.toISOString(),
  };
  return sortNewestFirst([
    ...entries.filter((existing) => existing.date !== draft.date),
    entry,
  ]);
}

export function removeEntry(
  entries: JournalEntry[],
  date: string,
): JournalEntry[] {
  return entries.filter((entry) => entry.date !== date);
}

/** Consecutive logged days ending today, or yesterday if today isn't logged yet. */
export function calculateStreak(
  entries: JournalEntry[],
  today: string,
): number {
  const logged = new Set(entries.map((entry) => entry.date));
  let cursor = logged.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (logged.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

const average = (values: number[]) =>
  values.length
    ? Math.round(
        (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
      ) / 10
    : null;

/** The last seven days ending today, oldest first. */
export function summarizeWeek(
  entries: JournalEntry[],
  today: string,
): JournalWeekSummary {
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDayKey(today, index - 6);
    return { date, entry: byDate.get(date) ?? null };
  });
  const logged = days.flatMap((day) => (day.entry ? [day.entry] : []));
  return {
    days,
    loggedDays: logged.length,
    averageMood: average(logged.map((entry) => entry.mood)),
    averageEnergy: average(logged.map((entry) => entry.energy)),
    streak: calculateStreak(entries, today),
  };
}
