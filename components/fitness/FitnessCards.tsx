import { ArrowRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { openBiomarker } from "@/components/biomarkers/BiomarkersScreen";
import { biomarkerMeta, toneColor } from "@/components/biomarkers/meta";
import { BarChart } from "@/components/charts/BarChart";
import { RangeGauge } from "@/components/charts/RangeGauge";
import { Sparkline } from "@/components/charts/Sparkline";
import { WeekCompareChart } from "@/components/charts/WeekCompareChart";
import {
  gaugeMax,
  gaugeStatus,
  openFitnessMetric,
  zoneColors,
  type FitnessMetric,
} from "@/components/fitness/fitnessMetrics";
import { Card } from "@/components/ui/primitives";
import type { Biomarker } from "@/services/health/biomarkers";
import type { FitnessData } from "@/services/health/fitness";
import {
  bucketAverages,
  heartRateRecoveryRating,
  type LoadGauge,
} from "@/services/metrics";
import { useTheme } from "@/theme/ThemeProvider";
import { formatDuration, formatEnergy, formatNumber } from "@/utils/formatters";

export function LoadGaugeCard({
  title,
  gauge,
  metric,
  width,
}: {
  title: string;
  gauge: LoadGauge;
  metric: FitnessMetric;
  width: number;
}) {
  const { colors } = useTheme();
  const status = gaugeStatus(gauge, colors);
  const size = width - 24;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${formatNumber(gauge.value)}, ${status.label}`}
      onPress={() => openFitnessMetric(metric)}
      className="flex-1 active:opacity-75"
    >
      <Card className="p-md pt-lg items-stretch">
        <Heading title={title} />
        <Text className="type-caption mt-2xs" style={{ color: status.color }}>
          {status.label}
        </Text>
        <View className="items-center mt-sm">
          <RangeGauge
            value={gauge.value}
            max={gaugeMax(gauge)}
            band={gauge.optimal}
            size={size}
            color={colors.primary}
            markerColor={status.color}
          />
          <View
            className="items-center justify-center absolute inset-0"
            pointerEvents="none"
          >
            <Text className="type-metric-xl text-text tabular-nums">
              {formatNumber(gauge.value)}
            </Text>
          </View>
        </View>
        <Text className="type-mono text-text-muted text-center text-[11px]">
          {gauge.optimal
            ? `Optimal: ${formatNumber(gauge.optimal[0])}–${formatNumber(gauge.optimal[1])}`
            : "Needs a few weeks of training"}
        </Text>
      </Card>
    </Pressable>
  );
}

function GridCard({
  title,
  value,
  caption,
  captionColor,
  onPress,
  accessibilityLabel,
  children,
}: {
  title: string;
  value: string;
  caption: string;
  captionColor?: string;
  onPress: () => void;
  accessibilityLabel: string;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="flex-1 active:opacity-75"
    >
      <Card className="flex-1 p-lg gap-2xs">
        <Heading title={title} />
        <Text
          className="type-metric-lg text-text tabular-nums mt-sm"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        <Text
          className="type-caption text-text-muted"
          style={captionColor ? { color: captionColor } : null}
          numberOfLines={1}
        >
          {caption}
        </Text>
        <View className="mt-md min-h-[56px] justify-end">{children}</View>
      </Card>
    </Pressable>
  );
}

function Heading({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center justify-between gap-xs">
      <Text
        className="type-subheading text-text shrink text-[15px]"
        numberOfLines={1}
      >
        {title}
      </Text>
      <ArrowRight color={colors.textSubtle} size={16} />
    </View>
  );
}

export function ActiveDurationCard({
  data,
  width,
}: {
  data: FitnessData;
  width: number;
}) {
  const { colors } = useTheme();
  const week = data.activeMinutes;
  return (
    <GridCard
      title="Active duration"
      value={formatDuration(week.total)}
      caption={`Last week ${formatDuration(week.previousTotal)}`}
      onPress={() => openFitnessMetric("active-duration")}
      accessibilityLabel={`Active duration this week ${formatDuration(week.total)}, last week ${formatDuration(week.previousTotal)}`}
    >
      <WeekCompareChart
        current={week.current}
        previous={week.previous}
        width={width - 32}
        height={56}
        color={colors.blue}
        accessibilityLabel="Active minutes this week against last week"
      />
    </GridCard>
  );
}

export function ActiveEnergyCard({
  data,
  width,
}: {
  data: FitnessData;
  width: number;
}) {
  const { colors } = useTheme();
  const week = data.activeEnergy;
  const total = formatEnergy(week.total);
  const previous = formatEnergy(week.previousTotal);
  return (
    <GridCard
      title="Active energy"
      value={`${total.value} ${total.unit}`}
      caption={`Last week ${previous.value} ${previous.unit}`}
      onPress={() => openFitnessMetric("active-energy")}
      accessibilityLabel={`Workout energy this week ${total.value} ${total.unit}`}
    >
      <WeekCompareChart
        current={week.current}
        previous={week.previous}
        width={width - 32}
        height={56}
        color={colors.stress}
        accessibilityLabel="Workout energy this week against last week"
      />
    </GridCard>
  );
}

export function Vo2MaxCard({
  vo2Max,
  width,
}: {
  vo2Max: Biomarker | null;
  width: number;
}) {
  const { colors } = useTheme();
  const latest = vo2Max?.latest;
  const status = vo2Max?.status;
  const cutoff = latest
    ? new Date(latest.timestamp).getTime() - 90 * 86_400_000
    : 0;
  const recent = vo2Max
    ? bucketAverages(
        vo2Max.history.filter(
          (sample) => new Date(sample.timestamp).getTime() >= cutoff,
        ),
        7,
      )
    : [];
  return (
    <GridCard
      title="VO₂ max"
      value={latest ? formatNumber(latest.value, 1) : "—"}
      caption={status?.label ?? (latest ? "ml/kg/min" : "No readings yet")}
      captionColor={status ? toneColor(status.tone, colors) : undefined}
      onPress={() => openBiomarker("vo2Max")}
      accessibilityLabel={`VO2 max ${latest ? formatNumber(latest.value, 1) : "no readings"}`}
    >
      {recent.length > 1 ? (
        <Sparkline
          values={recent.map((sample) => sample.value)}
          color={colors[biomarkerMeta.vo2Max.accent]}
          width={width - 32}
          height={56}
          accessibilityLabel="VO2 max over the last 90 days"
        />
      ) : null}
    </GridCard>
  );
}

export function HeartRateRecoveryCard({
  data,
  width,
}: {
  data: FitnessData;
  width: number;
}) {
  const { colors } = useTheme();
  const values = data.heartRateRecovery;
  const latest = values.at(-1);
  return (
    <GridCard
      title="HR recovery"
      value={latest === undefined ? "—" : `${latest} bpm`}
      caption={
        latest === undefined
          ? "Needs post-workout HR"
          : heartRateRecoveryRating(latest)
      }
      captionColor={latest === undefined ? undefined : colors.salmon}
      onPress={() => openFitnessMetric("heart-rate-recovery")}
      accessibilityLabel={`Heart rate recovery ${latest ?? "no data"}`}
    >
      {values.length > 1 ? (
        <Sparkline
          values={values}
          color={colors.salmon}
          width={width - 32}
          height={56}
          step
          accessibilityLabel="One-minute heart rate recovery for recent workouts"
        />
      ) : null}
    </GridCard>
  );
}

export function CardioFocusCard({ data }: { data: FitnessData }) {
  const { colors } = useTheme();
  const focus = data.cardioFocus;
  const rows = focus
    ? [
        { label: "Low aerobic", value: focus.aerobic, color: colors.primary },
        { label: "High aerobic", value: focus.threshold, color: colors.sleep },
        { label: "Anaerobic", value: focus.anaerobic, color: colors.salmon },
      ]
    : [];
  const top = [...rows].sort((a, b) => b.value - a.value)[0];
  return (
    <GridCard
      title="Cardio focus"
      value={top ? `${top.value}%` : "—"}
      caption={top?.label ?? "Needs cardio with HR"}
      captionColor={top?.color}
      onPress={() => openFitnessMetric("cardio-focus")}
      accessibilityLabel={
        top
          ? `Cardio focus ${top.value} percent ${top.label}`
          : "Cardio focus, no data"
      }
    >
      <View className="gap-sm">
        {rows.map((row) => (
          <View
            key={row.label}
            className="h-2 rounded-full overflow-hidden bg-track"
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.max(row.value, 3)}%`,
                backgroundColor: row.color,
              }}
            />
          </View>
        ))}
      </View>
    </GridCard>
  );
}

export function HeartRateZonesCard({
  data,
  width,
}: {
  data: FitnessData;
  width: number;
}) {
  const { colors } = useTheme();
  const palette = zoneColors(colors);
  const week = data.zoneWeeks.at(-1)?.minutes ?? [0, 0, 0, 0, 0];
  const topMinutes = Math.max(...week);
  const topZone = week.indexOf(topMinutes);
  return (
    <GridCard
      title="HR zones"
      value={topMinutes > 0 ? `Zone ${topZone + 1}` : "—"}
      caption={
        topMinutes > 0
          ? `${formatDuration(topMinutes)} this week`
          : "No zone time this week"
      }
      captionColor={topMinutes > 0 ? palette[topZone] : undefined}
      onPress={() => openFitnessMetric("heart-rate-zones")}
      accessibilityLabel={`Most time this week in zone ${topZone + 1}`}
    >
      <BarChart
        bars={week.map((minutes, zone) => ({
          value: minutes,
          color: palette[zone],
        }))}
        width={width - 32}
        height={56}
        color={colors.primary}
        accessibilityLabel="Minutes in each heart rate zone this week"
      />
    </GridCard>
  );
}
