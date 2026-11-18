import type { ReactNode } from "react";
import { Text } from "react-native";

import { BarChart } from "@/components/charts/BarChart";
import { DetailSection } from "@/components/detail/DetailLayout";
import { Card } from "@/components/ui/primitives";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import type { DailyScore } from "@/services/metrics/daily";
import { useBrowsedDay } from "@/stores/dayStore";

/** Labels the first, middle and last bars. */
export function historyLabel(index: number, count: number) {
  if (index === count - 1) return "Today";
  if (index === 0 || index === Math.floor((count - 1) / 2))
    return `${count - 1 - index}d`;
  return undefined;
}

/** "Last 14 days" bars of one score, with the browsed day outlined. */
export function ScoreHistorySection({
  width,
  pick,
  color,
  colorFor,
  trailing,
  accessibilityLabel,
  children,
}: {
  width: number;
  pick: (day: DailyScore) => number | null;
  color: string;
  /** Per-bar colour for a scored day; bars use `color` otherwise. */
  colorFor?: (score: number) => string | null;
  trailing?: (days: DailyScore[]) => ReactNode;
  accessibilityLabel: (days: DailyScore[]) => string;
  /** Shown under the chart inside the card, e.g. a legend. */
  children?: ReactNode;
}) {
  const browsed = useBrowsedDay();
  const { data: days } = useScoreHistory();
  return (
    <DetailSection title="Last 14 days" trailing={days && trailing?.(days)}>
      <Card className={children ? "gap-md" : undefined}>
        {days ? (
          <BarChart
            bars={days.map((day, index) => {
              const value = pick(day);
              return {
                value: value ?? 0,
                color:
                  value === null ? undefined : (colorFor?.(value) ?? undefined),
                label: historyLabel(index, days.length),
                selected: day.date === browsed,
              };
            })}
            width={width}
            color={color}
            accessibilityLabel={accessibilityLabel(days)}
          />
        ) : (
          <HistoryLoading />
        )}
        {children}
      </Card>
    </DetailSection>
  );
}

export function HistoryLoading() {
  return (
    <Text className="type-caption text-text-subtle">
      Reading the last two weeks…
    </Text>
  );
}
