import type { ColorTokens } from "@/theme/tokens";

/** Dot colour for a day's recovery, matching the recovery ring's bands; null means no dot. */
export function recoveryDotColor(
  score: number | null,
  colors: ColorTokens,
): string | null {
  if (score === null) return null;
  if (score >= 75) return colors.primary;
  if (score >= 50) return colors.stress;
  return colors.error;
}
