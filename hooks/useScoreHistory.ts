import { useQuery } from "@tanstack/react-query";

import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import type { DailyScore } from "@/services/metrics/daily";
import { loadScoreHistory, scoreStorageFor } from "@/services/scores/history";
import { scoreStorage } from "@/services/scores/storage";
import { useHealthStore } from "@/stores/healthStore";

/** The last 14 days of strain and recovery, oldest first, today last. */
export function useScoreHistory() {
  const provider = useHealthStore((state) => state.provider);
  const { data } = useHealthDashboard();
  const today = data?.today;
  return useQuery({
    // Keyed by day, not by each dashboard read: the finished days don't change
    // when today's score does, so a refetch of today needn't reload them.
    queryKey: ["score-history", provider.kind, today?.date],
    queryFn: () =>
      loadScoreHistory(provider, scoreStorageFor(provider, scoreStorage), today!),
    enabled: !!today,
    placeholderData: (previous) => previous,
    // Today always comes from the live dashboard.
    select: (days: DailyScore[]) =>
      today && days.at(-1)?.date === today.date
        ? [...days.slice(0, -1), today]
        : days,
  });
}
