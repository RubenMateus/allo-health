import { Text, View } from "react-native";

import { StrainCurve } from "@/components/charts/StrainCurve";
import { usePastDayEyebrow } from "@/components/day/dayLabels";
import {
  DetailLayout,
  DetailSection,
  PrivacyNote,
  useDetailChartWidth,
} from "@/components/detail/DetailLayout";
import { ScoreHistorySection } from "@/components/detail/ScoreHistorySection";
import { LoadBalanceSection } from "@/components/loadBalance/LoadBalanceCard";
import { Card, EmptyState } from "@/components/ui/primitives";
import { useDayDashboard } from "@/hooks/useHealthDashboard";
import { fromDayKey } from "@/services/journal";
import { MAX_STRAIN, morningTargetStrain } from "@/services/coaching";
import { scoreStatusLabels, strainScoreStatus } from "@/services/metrics";
import { strainCurve, type DailyScore } from "@/services/metrics/daily";
import { averageOf } from "@/services/metrics/summary";
import { useIsToday } from "@/stores/dayStore";
import { useTheme } from "@/theme/ThemeProvider";
import { formatEnergy } from "@/utils/formatters";

const zoneNames = ["Easy", "Light", "Moderate", "Hard", "Max"] as const;

/** A day's strain (today by default): how it built up, where it came from, and the last two weeks. */
export function StrainScreen() {
  const chartWidth = useDetailChartWidth();
  const { data } = useDayDashboard();
  const isToday = useIsToday();
  const subtitle = usePastDayEyebrow();
  if (!data)
    return <DetailLayout title="Strain" value={null} status="Loading" />;

  // The morning target only means something on the day itself.
  const target = isToday ? morningTargetStrain(data) : null;
  const { today, strainInputs } = data;
  // A past day's curve runs to the end of that day, not to when it was read.
  const curveEnd = isToday
    ? new Date(today.computedAt)
    : new Date(fromDayKey(data.date).setHours(23, 59, 59, 999));
  const caption = target ? `TARGET TODAY ${target[0]}–${target[1]}` : null;
  if (today.strain === null || !today.strainBreakdown)
    return (
      <DetailLayout
        title="Strain"
        subtitle={subtitle}
        value={null}
        status={isToday ? "No strain yet today" : "No strain recorded"}
        caption={caption}
      >
        <EmptyState
          title={
            isToday ? "Nothing recorded today yet" : "Nothing recorded that day"
          }
          detail="Strain builds from your heart rate and active energy as your watch writes them to Apple Health or Health Connect."
        />
        <HistorySection width={chartWidth} />
        <LoadBalanceSection width={chartWidth} />
      </DetailLayout>
    );

  return (
    <DetailLayout
      title="Strain"
      subtitle={subtitle}
      value={`${today.strain}`}
      unit={`/ ${MAX_STRAIN}`}
      status={scoreStatusLabels[strainScoreStatus(today.strain)]}
      caption={caption}
    >
      <DetailSection title={isToday ? "Today" : "That day"}>
        <Card className="gap-sm">
          <StrainCurve
            points={strainCurve(strainInputs)}
            band={target}
            now={curveEnd}
            endLabel={isToday ? "NOW" : "24:00"}
            width={chartWidth}
            accessibilityLabel={
              target
                ? `Strain through today, now ${today.strain}, target ${target[0]} to ${target[1]}`
                : `Strain through the day, ${today.strain} at the end`
            }
          />
          {target ? (
            <Text className="type-caption text-text-subtle">
              The shaded band is today&apos;s target, set this morning from your
              recovery and sleep.
            </Text>
          ) : null}
        </Card>
      </DetailSection>

      <DetailSection title="Where it came from">
        <ZonesCard breakdown={today.strainBreakdown} />
      </DetailSection>

      <HistorySection width={chartWidth} />
      <LoadBalanceSection width={chartWidth} />

      <DetailSection title="How the score works">
        <Text className="type-caption text-text-muted -mt-xs">
          Every five minutes of heart rate counts by how hard it was, from 0.2×
          when easy to 2× near your max. Active energy adds a little on top. The
          score is capped at {MAX_STRAIN}.
        </Text>
      </DetailSection>

      <PrivacyNote />
    </DetailLayout>
  );
}

function ZonesCard({
  breakdown,
}: {
  breakdown: NonNullable<DailyScore["strainBreakdown"]>;
}) {
  const { colors } = useTheme();
  const most = Math.max(...breakdown.zones.map((zone) => zone.minutes), 1);
  const energy = formatEnergy(breakdown.activeEnergyKcal);
  return (
    <Card className="gap-md">
      {[...breakdown.zones].reverse().map((zone) => (
        <View key={zone.zone} className="gap-xs">
          <View className="flex-row items-center justify-between">
            <Text className="type-body-small text-text">
              Zone {zone.zone} · {zoneNames[zone.zone - 1]}
            </Text>
            <Text className="type-mono-small text-text-subtle tabular-nums">
              {Math.round(zone.minutes)} min · ×{zone.weight}
            </Text>
          </View>
          <View className="h-[6px] rounded-full bg-track overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${(zone.minutes / most) * 100}%`,
                backgroundColor: colors.strainStart,
                opacity: 0.4 + zone.zone * 0.12,
              }}
            />
          </View>
        </View>
      ))}
      <View className="flex-row items-center justify-between pt-xs">
        <Text className="type-body-small text-text">Active energy</Text>
        <Text className="type-mono-small text-text-subtle tabular-nums">
          {energy.value} {energy.unit}
        </Text>
      </View>
    </Card>
  );
}

function HistorySection({ width }: { width: number }) {
  const { colors } = useTheme();
  const averageFor = (days: DailyScore[]) =>
    averageOf(days.map((day) => day.strain));
  return (
    <ScoreHistorySection
      width={width}
      pick={(day) => day.strain}
      color={colors.strainStart}
      trailing={(days) => {
        const average = averageFor(days);
        return average === null ? null : (
          <Text className="type-mono-small text-text-subtle">
            AVG {average.toFixed(1)}
          </Text>
        );
      }}
      accessibilityLabel={(days) => {
        const average = averageFor(days);
        return `Strain for the last ${days.length} days${average === null ? "" : `, average ${average.toFixed(1)}`}`;
      }}
    />
  );
}
