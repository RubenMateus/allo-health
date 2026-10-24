export type Rating = 1 | 2 | 3 | 4 | 5;

export const JOURNAL_TAGS = [
  "caffeine",
  "alcohol",
  "late-meal",
  "stress",
  "travel",
  "meditation",
  "sauna",
  "sick",
] as const;

export type JournalTag = (typeof JOURNAL_TAGS)[number];

export type JournalEntry = {
  /** Local calendar day, `YYYY-MM-DD`. One entry per day. */
  date: string;
  mood: Rating;
  energy: Rating;
  tags: JournalTag[];
  note: string;
  updatedAt: string;
};

export type JournalDraft = Omit<JournalEntry, "updatedAt">;

export type JournalWeekDay = {
  date: string;
  entry: JournalEntry | null;
};

export type JournalWeekSummary = {
  days: JournalWeekDay[];
  loggedDays: number;
  averageMood: number | null;
  averageEnergy: number | null;
  streak: number;
};
