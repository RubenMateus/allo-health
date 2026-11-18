import { recoveryScoreStatus } from "@/services/metrics";
import type { ColorTokens } from "@/theme/tokens";

/** Colour for a day's recovery, matching the recovery ring's bands; null means no score. */
export function recoveryDotColor(
  score: number | null,
  colors: ColorTokens,
): string | null {
  switch (recoveryScoreStatus(score)) {
    case "NO DATA":
      return null;
    case "HIGH":
      return colors.primary;
    case "MODERATE":
      return colors.stress;
    case "LOW":
      return colors.error;
  }
}
