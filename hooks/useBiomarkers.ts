import { useQuery } from "@tanstack/react-query";

import { loadBiomarkers } from "@/services/health/biomarkers";
import { useHealthStore } from "@/stores/healthStore";
import { useProfileStore } from "@/stores/profileStore";

export function useBiomarkers() {
  const provider = useHealthStore((state) => state.provider);
  const birthDate = useProfileStore((state) => state.birthDate);
  const sex = useProfileStore((state) => state.sex);
  const hydrated = useProfileStore((state) => state.hydrated);
  return useQuery({
    queryKey: ["biomarkers", provider.kind, birthDate, sex],
    queryFn: () => loadBiomarkers(provider, { birthDate, sex }),
    // Wait for the saved profile so ratings don't flash from trend to rating.
    enabled: hydrated,
  });
}
