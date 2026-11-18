import { useQuery } from "@tanstack/react-query";

import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import { loadScoreHistory } from "@/services/scores/history";
import { scoreStorage } from "@/services/scores/storage";
import { useHealthStore } from "@/stores/healthStore";

/** The last 14 days of strain and recovery, oldest first, today last. */
export function useScoreHistory() {
  const provider = useHealthStore((state) => state.provider);
  const { data } = useHealthDashboard();
  const today = data?.today;
  return useQuery({
    queryKey: ["score-history", provider.kind, today?.computedAt],
    queryFn: () => loadScoreHistory(provider, scoreStorage, today!),
    enabled: !!today,
    placeholderData: (previous) => previous,
  });
}
