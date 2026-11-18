import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { DailyScore } from "@/services/metrics/daily";
import { loadScoreRange } from "@/services/scores/history";
import { scoreStorage } from "@/services/scores/storage";
import { useHealthStore } from "@/stores/healthStore";

type DayScores = Record<string, DailyScore | null>;
const EMPTY: DayScores = {};

/** Scores for each day in [from, to]; fills in day by day while loading. */
export function useDayScores(from: string, to: string): DayScores {
  const provider = useHealthStore((state) => state.provider);
  const queryClient = useQueryClient();
  const queryKey = ["day-scores", provider.kind, from, to];
  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      loadScoreRange(provider, scoreStorage, from, to, new Date(), (score) =>
        queryClient.setQueryData<DayScores>(queryKey, (previous) => ({
          ...previous,
          [score.date]: score,
        })),
      ),
  });
  return data ?? EMPTY;
}
