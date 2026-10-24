import { useQuery } from "@tanstack/react-query";

import { loadFitnessData } from "@/services/health/fitness";
import { useHealthStore } from "@/stores/healthStore";

export function useFitnessDashboard() {
  const provider = useHealthStore((state) => state.provider);
  const permissionState = useHealthStore((state) => state.permissionState);
  // Unlike the Home tab, a failed workout read does not switch the whole app
  // to sample data: older connections may not have granted workout access yet.
  return useQuery({
    queryKey: ["fitness-dashboard", provider.kind],
    queryFn: () => loadFitnessData(provider, permissionState),
  });
}
