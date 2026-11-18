import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useDayScores } from "@/hooks/useDayScores";
import { fromDayKey, shiftDayKey } from "@/services/journal";
import type { DailyScore } from "@/services/metrics/daily";
import {
  daysInPeriod,
  isRecentPeriod,
  shiftPeriod,
  suggestionsFor,
  summarizeJournal,
  summarizeScores,
  summarizeWorkouts,
  tagEffects,
  type JournalSummary,
  type Period,
  type ScoreSummary,
  type Suggestion,
  type WorkoutTotals,
} from "@/services/metrics/summary";
import { useTodayKey } from "@/stores/dayStore";
import { useHealthStore } from "@/stores/healthStore";
import { useJournalStore } from "@/stores/journalStore";

export type PeriodSummaryData = {
  /** True until every day in `days` has been scored (or found empty). */
  loading: boolean;
  /** The period's days up to today, oldest first. */
  days: string[];
  scoresByDay: Record<string, DailyScore | null>;
  scores: ScoreSummary;
  /** Null while workouts load. */
  workouts: WorkoutTotals | null;
  journal: JournalSummary;
  /** Null for periods older than the one before the current one. */
  suggestions: Suggestion[] | null;
};

/** Everything the summary page shows for one week or month, worked out on device. */
export function usePeriodSummary(period: Period): PeriodSummaryData {
  const today = useTodayKey();
  const provider = useHealthStore((s) => s.provider);
  const entries = useJournalStore((s) => s.entries);

  const days = useMemo(() => daysInPeriod(period, today), [period, today]);
  const previous = useMemo(() => shiftPeriod(period, -1), [period]);
  const last = days[days.length - 1] ?? period.start;

  const scoresByDay = useDayScores(period.start, last);
  const previousByDay = useDayScores(previous.start, previous.end);

  const { data: workoutList } = useQuery({
    queryKey: ["period-workouts", provider.kind, period.start, period.end],
    // Only the period itself: its last day ends at the next local midnight.
    queryFn: () =>
      provider.getWorkouts(
        fromDayKey(period.start),
        new Date(Math.min(fromDayKey(shiftDayKey(period.end, 1)).getTime(), Date.now())),
      ),
  });

  return useMemo(() => {
    const dayScores = days.map((day) => scoresByDay[day] ?? null);
    const previousScores = daysInPeriod(previous, today).map(
      (day) => previousByDay[day] ?? null,
    );
    const scores = summarizeScores(dayScores, previousScores);
    const recent = isRecentPeriod(period, today);
    return {
      loading: days.some((day) => !(day in scoresByDay)),
      days,
      scoresByDay,
      scores,
      workouts: workoutList ? summarizeWorkouts(workoutList, period) : null,
      journal: summarizeJournal(entries, period),
      suggestions: recent
        ? suggestionsFor({
            days: dayScores,
            scores,
            tagEffects: tagEffects(entries, scoresByDay, period),
          })
        : null,
    };
  }, [days, scoresByDay, previousByDay, previous, period, today, workoutList, entries]);
}
