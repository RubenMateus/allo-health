import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import { useTodayKey } from "@/stores/dayStore";
import type { DailyScore } from "@/services/metrics/daily";
import { loadScoreRange, scoreStorageFor } from "@/services/scores/history";
import { scoreStorage } from "@/services/scores/storage";
import { useHealthStore } from "@/stores/healthStore";

type DayScores = Record<string, DailyScore | null>;
const EMPTY: DayScores = {};

/**
 * Scores for each day in [from, to]; stored days show at once and the rest fill
 * in day by day. Today's score comes from the live dashboard.
 */
export function useDayScores(from: string, to: string): DayScores {
  const provider = useHealthStore((state) => state.provider);
  const queryClient = useQueryClient();
  const { data: dashboard } = useHealthDashboard();
  const todayKey = useTodayKey();
  const queryKey = ["day-scores", provider.kind, todayKey, from, to];
  const { data } = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      loadScoreRange(
        provider,
        scoreStorageFor(provider, scoreStorage),
        from,
        to,
        new Date(),
        (score) =>
          queryClient.setQueryData<DayScores>(queryKey, (previous) => ({
            ...previous,
            [score.date]: score,
          })),
        {
          signal,
          onStored: (days) =>
            queryClient.setQueryData<DayScores>(queryKey, (previous) => ({
              ...days,
              ...previous,
            })),
        },
      ),
  });
  const today = dashboard?.today;
  return useMemo(() => {
    if (!today || today.date < from || today.date > to) return data ?? EMPTY;
    return { ...data, [today.date]: today };
  }, [data, today, from, to]);
}
