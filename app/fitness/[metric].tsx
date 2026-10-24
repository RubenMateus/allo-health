import { Redirect, useLocalSearchParams } from "expo-router";

import { FitnessDetailScreen } from "@/components/fitness/FitnessDetailScreen";
import {
  fitnessMetrics,
  type FitnessMetric,
} from "@/components/fitness/fitnessMetrics";

export default function FitnessDetailRoute() {
  const { metric } = useLocalSearchParams<{ metric: string }>();
  if (!fitnessMetrics.includes(metric as FitnessMetric))
    return <Redirect href="/fitness" />;
  return <FitnessDetailScreen metric={metric as FitnessMetric} />;
}
