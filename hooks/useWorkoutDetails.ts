import { useQuery } from "@tanstack/react-query";

import { useFitnessDashboard } from "@/hooks/useFitnessDashboard";
import { useHealthStore } from "@/stores/healthStore";

/** One workout from the Fitness data, plus its heavier detail reads on demand. */
export function useWorkoutDetails(id: string) {
  const provider = useHealthStore((state) => state.provider);
  const fitness = useFitnessDashboard();
  const workout = fitness.data?.workouts.find((item) => item.id === id) ?? null;
  const details = useQuery({
    queryKey: ["workout-details", provider.kind, id],
    queryFn: () => provider.getWorkoutDetails(workout!),
    enabled: workout !== null,
  });
  return { fitness, workout, details };
}
