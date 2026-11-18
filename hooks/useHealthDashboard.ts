import { useQuery } from "@tanstack/react-query";

import { loadDashboardData } from "@/services/health/dashboard";
import { mockHealthProvider } from "@/services/health/provider";
import { fromDayKey, toDayKey } from "@/services/journal";
import { REFRESH_RECENT_DAYS } from "@/services/scores/history";
import { useSelectedDayKey } from "@/stores/dayStore";
import { useHealthStore } from "@/stores/healthStore";

const FIVE_MINUTES = 5 * 60_000;

function daysBetween(dayKey: string, now: Date) {
  return Math.round(
    (fromDayKey(toDayKey(now)).getTime() - fromDayKey(dayKey).getTime()) /
      86_400_000,
  );
}

function useDashboardQuery(dayKey: string) {
  const provider = useHealthStore((state) => state.provider);
  const permissionState = useHealthStore((state) => state.permissionState);
  const now = new Date();
  const isToday = dayKey === toDayKey(now);
  return useQuery({
    queryKey: ["health-dashboard", provider.kind, dayKey],
    queryFn: async () => {
      if (!isToday) {
        // A past day that cannot be read is an error, never a switch to demo data.
        return loadDashboardData(provider, permissionState, fromDayKey(dayKey));
      }
      try {
        return await loadDashboardData(provider, permissionState);
      } catch {
        useHealthStore.getState().fallbackToMock();
        return loadDashboardData(mockHealthProvider, "denied");
      }
    },
    ...(isToday
      ? {}
      : {
          staleTime:
            daysBetween(dayKey, now) <= REFRESH_RECENT_DAYS
              ? FIVE_MINUTES
              : Infinity,
        }),
  });
}

/** Today's dashboard. Rolls over at midnight and shares its cache with `useDayDashboard`. */
export function useHealthDashboard() {
  return useDashboardQuery(toDayKey(new Date()));
}

/** The dashboard for the selected day (today unless a past day is chosen). */
export function useDayDashboard() {
  return useDashboardQuery(useSelectedDayKey());
}
