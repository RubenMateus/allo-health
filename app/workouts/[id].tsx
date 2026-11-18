import { useLocalSearchParams } from "expo-router";

import { WorkoutDetailScreen } from "@/components/workouts/WorkoutDetailScreen";

export default function WorkoutDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutDetailScreen id={id} />;
}
