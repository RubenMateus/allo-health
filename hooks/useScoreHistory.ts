import { useQuery } from "@tanstack/react-query";

import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import type { DailyScore } from "@/services/metrics/daily";
import { loadScoreHistory } from "@/services/scores/history";
import { scoreStorage } from "@/services/scores/storage";
import { useHealthStore } from "@/stores/healthStore";

/** The last 14 days of strain and recovery, oldest first, today last. */
export function useScoreHistory() {
  const provider = useHealthStore((state) => state.provider);
  const { data } = useHealthDashboard();
  const today = data?.today;
  return useQuery({
    // Keyed by day, not by each dashboard read, so every dashboard refetch
    // doesn't re-read the last finished days from Health. Sync and Home's
    // pull-to-refresh refresh them (see HEALTH_QUERY_KEYS), as does the
    // usual stale time.
    queryKey: ["score-history", provider.kind, today?.date],
    queryFn: () => loadScoreHistory(provider, scoreStorage, today!),
    enabled: !!today,
    placeholderData: (previous) => previous,
    // Today always comes from the live dashboard.
    select: (days: DailyScore[]) =>
      today && days.at(-1)?.date === today.date
        ? [...days.slice(0, -1), today]
        : days,
  });
}
