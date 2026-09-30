import { useQuery } from "@tanstack/react-query";

import { loadDashboardData } from "@/services/health/dashboard";
import { mockHealthProvider } from "@/services/health/provider";
import { useHealthStore } from "@/stores/healthStore";

export function useHealthDashboard() {
  const provider = useHealthStore((state) => state.provider);
  const permissionState = useHealthStore((state) => state.permissionState);
  return useQuery({
    queryKey: ["health-dashboard", provider.kind],
    queryFn: async () => {
      try {
        return await loadDashboardData(provider, permissionState);
      } catch {
        useHealthStore.getState().fallbackToMock();
        return loadDashboardData(mockHealthProvider, "denied");
      }
    },
  });
}
