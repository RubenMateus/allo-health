import { Text, useWindowDimensions, View } from "react-native";

import { BarChart } from "@/components/charts/BarChart";
import { StrainCurve } from "@/components/charts/StrainCurve";
import { DetailLayout, DetailSection } from "@/components/detail/DetailLayout";
import { LoadBalanceSection } from "@/components/loadBalance/LoadBalanceCard";
import { PrivacyNote } from "@/components/sleep/SleepScreen";
import { Card, EmptyState } from "@/components/ui/primitives";
import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import { MAX_STRAIN, morningTargetStrain } from "@/services/coaching";
import { strainCurve, type DailyScore } from "@/services/metrics/daily";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { formatEnergy } from "@/utils/formatters";

/** Same thresholds as the Home ring. */
export function strainStatus(score: number | null) {
  if (score === null) return "No data";
  return score >= 15 ? "High" : score >= 9 ? "Moderate" : "Low";
}

const zoneNames = ["Easy", "Light", "Moderate", "Hard", "Max"] as const;

/** Today's strain: how it built up, where it came from, and the last two weeks. */
export function StrainScreen() {
  const { width } = useWindowDimensions();
  const chartWidth = width - spacing.margin * 2 - spacing.lg * 2;
  const { data } = useHealthDashboard();
  if (!data)
    return <DetailLayout title="Strain" value={null} status="Loading" />;

  const target = morningTargetStrain(data);
  const { today, strainInputs } = data;
  const caption = `TARGET TODAY ${target[0]}–${target[1]}`;
  if (today.strain === null || !today.strainBreakdown)
    return (
      <DetailLayout
        title="Strain"
        value={null}
        status="No strain yet today"
        caption={caption}
      >
        <EmptyState
          title="Nothing recorded today yet"
          detail="Strain builds from your heart rate and active energy as your watch writes them to Apple Health or Health Connect."
        />
        <HistorySection width={chartWidth} />
        <LoadBalanceSection width={chartWidth} />
        <LoadBalanceSection width={chartWidth} />
      </DetailLayout>
    );

  return (
    <DetailLayout
      title="Strain"
      value={`${today.strain}`}
      unit={`/ ${MAX_STRAIN}`}
      status={strainStatus(today.strain)}
      caption={caption}
    >
      <DetailSection title="Today">
        <Card className="gap-sm">
          <StrainCurve
            points={strainCurve(strainInputs)}
            band={target}
            now={new Date(today.computedAt)}
            width={chartWidth}
            accessibilityLabel={`Strain through today, now ${today.strain}, target ${target[0]} to ${target[1]}`}
          />
          <Text className="type-caption text-text-subtle">
            The shaded band is today&apos;s target, set this morning from your
            recovery and sleep.
          </Text>
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
  const { data: days } = useScoreHistory();
  const scored = days?.filter((day) => day.strain !== null) ?? [];
  const average = scored.length
    ? scored.reduce((sum, day) => sum + (day.strain ?? 0), 0) / scored.length
    : null;
  return (
    <DetailSection
      title="Last 14 days"
      trailing={
        average === null ? null : (
          <Text className="type-mono-small text-text-subtle">
            AVG {average.toFixed(1)}
          </Text>
        )
      }
    >
      <Card>
        {days ? (
          <BarChart
            bars={days.map((day, index) => ({
              value: day.strain ?? 0,
              label: historyLabel(index, days.length),
            }))}
            width={width}
            color={colors.strainStart}
            accessibilityLabel={`Strain for the last ${days.length} days${average === null ? "" : `, average ${average.toFixed(1)}`}`}
          />
        ) : (
          <Text className="type-caption text-text-subtle">
            Reading the last two weeks…
          </Text>
        )}
      </Card>
    </DetailSection>
  );
}

/** Labels the first, middle and last bars. */
export function historyLabel(index: number, count: number) {
  if (index === count - 1) return "Today";
  if (index === 0 || index === Math.floor((count - 1) / 2))
    return `${count - 1 - index}d`;
  return undefined;
}
