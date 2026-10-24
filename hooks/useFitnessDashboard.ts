import { useQuery } from "@tanstack/react-query";

import { loadFitnessData } from "@/services/health/fitness";
import { useHealthStore } from "@/stores/healthStore";
import { useProfileStore } from "@/stores/profileStore";

export function useFitnessDashboard() {
  const provider = useHealthStore((state) => state.provider);
  const permissionState = useHealthStore((state) => state.permissionState);
  const birthDate = useProfileStore((state) => state.birthDate);
  const sex = useProfileStore((state) => state.sex);
  // Unlike the Home tab, a failed workout read does not switch the whole app
  // to sample data: older connections may not have granted workout access yet.
  return useQuery({
    queryKey: ["fitness-dashboard", provider.kind, birthDate],
    queryFn: () =>
      loadFitnessData(provider, permissionState, new Date(), {
        birthDate,
        sex,
      }),
  });
}
