import { useMemo } from "react";

import { useDayScores } from "@/hooks/useDayScores";
import { shiftDayKey } from "@/services/journal";
import type { DailyScore } from "@/services/metrics/daily";
import { energyUsual, USUAL_DAYS } from "@/services/metrics/energy";
import { useHealthStore } from "@/stores/healthStore";

/**
 * The usual Energy Bank balance at `hour` (24 = the close) over the days before
 * `dayKey`. Sample data never counts as anyone's usual, so it is null there.
 */
export function useEnergyUsual(dayKey: string, hour: number): number | null {
  const isSample = useHealthStore((state) => state.provider.kind === "mock");
  const scores = useDayScores(
    shiftDayKey(dayKey, -USUAL_DAYS),
    shiftDayKey(dayKey, -1),
  );
  return useMemo(() => {
    if (isSample) return null;
    const days = Object.values(scores).filter(
      (day): day is DailyScore => !!day && day.date < dayKey,
    );
    return energyUsual(days, hour);
  }, [isSample, scores, dayKey, hour]);
}
