import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import type { LoadGauge } from "@/services/metrics";
import type { ColorTokens } from "@/theme/tokens";

export const fitnessMetrics = [
  "cardio-load",
  "muscular-load",
  "active-duration",
  "active-energy",
  "heart-rate-recovery",
  "cardio-focus",
  "heart-rate-zones",
] as const;

export type FitnessMetric = (typeof fitnessMetrics)[number];

export const fitnessMetricTitles: Record<FitnessMetric, string> = {
  "cardio-load": "Cardio load",
  "muscular-load": "Muscular load",
  "active-duration": "Active duration",
  "active-energy": "Active energy",
  "heart-rate-recovery": "Heart rate recovery",
  "cardio-focus": "Cardio focus",
  "heart-rate-zones": "Heart rate zones",
};

export function openFitnessMetric(metric: FitnessMetric) {
  void Haptics.selectionAsync();
  router.push({ pathname: "/fitness/[metric]", params: { metric } });
}

/** Zones 1–5, cool to hot. */
export function zoneColors(colors: ColorTokens): string[] {
  return [
    colors.blue,
    colors.sleep,
    colors.primary,
    colors.stress,
    colors.strainEnd,
  ];
}

export const zoneNames = [
  "Zone 1 · Recovery",
  "Zone 2 · Endurance",
  "Zone 3 · Tempo",
  "Zone 4 · Threshold",
  "Zone 5 · Maximum",
];

export function gaugeStatus(
  gauge: LoadGauge,
  colors: ColorTokens,
): { label: string; color: string } {
  switch (gauge.status) {
    case "OPTIMAL":
      return { label: "Optimal", color: colors.primary };
    case "BELOW":
      return { label: "Below optimal", color: colors.blue };
    case "ABOVE":
      return { label: "Above optimal", color: colors.stress };
    case "BUILDING":
      return { label: "Calibrating", color: colors.textMuted };
    default:
      return { label: "No data", color: colors.textSubtle };
  }
}

/** Top of the gauge scale: room above both the value and the optimal range. */
export function gaugeMax(gauge: LoadGauge): number {
  return Math.max(
    Math.ceil(Math.max(gauge.value, gauge.optimal?.[1] ?? 0) * 1.3),
    10,
  );
}
