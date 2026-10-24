import { ArrowRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { makeStyles, useTheme } from "@/theme/ThemeProvider";
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
  const styles = useStyles();
  const { colors } = useTheme();
  const status = gaugeStatus(gauge, colors);
  const size = width - 24;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${formatNumber(gauge.value)}, ${status.label}`}
      onPress={() => openFitnessMetric(metric)}
      style={({ pressed }) => [styles.half, pressed && styles.pressed]}
    >
      <Card style={styles.gaugeCard}>
        <Heading title={title} />
        <Text style={[styles.gaugeStatus, { color: status.color }]}>
          {status.label}
        </Text>
        <View style={styles.gaugeFrame}>
          <RangeGauge
            value={gauge.value}
            max={gaugeMax(gauge)}
            band={gauge.optimal}
            size={size}
            color={colors.primary}
            markerColor={status.color}
          />
          <View style={styles.gaugeCentre} pointerEvents="none">
            <Text style={styles.gaugeValue}>{formatNumber(gauge.value)}</Text>
          </View>
        </View>
        <Text style={styles.gaugeOptimal}>
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
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.half, pressed && styles.pressed]}
    >
      <Card style={styles.gridCard}>
        <Heading title={title} />
        <Text style={styles.gridValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text
          style={[
            styles.gridCaption,
            captionColor ? { color: captionColor } : null,
          ]}
          numberOfLines={1}
        >
          {caption}
        </Text>
        <View style={styles.gridChart}>{children}</View>
      </Card>
    </Pressable>
  );
}

function Heading({ title }: { title: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={styles.headingText} numberOfLines={1}>
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
  const styles = useStyles();
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
      <View style={styles.focusBars}>
        {rows.map((row) => (
          <View key={row.label} style={styles.focusTrack}>
            <View
              style={[
                styles.focusFill,
                {
                  width: `${Math.max(row.value, 3)}%`,
                  backgroundColor: row.color,
                },
              ]}
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

const useStyles = makeStyles(({ colors, radii, spacing, typography }) =>
  StyleSheet.create({
    half: { flex: 1 },
    pressed: { opacity: 0.75 },
    heading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.xs,
    },
    headingText: {
      ...typography.subheading,
      fontSize: 15,
      color: colors.text,
      flexShrink: 1,
    },
    gaugeCard: {
      padding: spacing.md,
      paddingTop: spacing.lg,
      alignItems: "stretch",
    },
    gaugeStatus: { ...typography.caption, marginTop: spacing["2xs"] },
    gaugeFrame: { alignItems: "center", marginTop: spacing.sm },
    gaugeCentre: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
    },
    gaugeValue: {
      ...typography.metricXL,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    gaugeOptimal: {
      ...typography.mono,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
    },
    gridCard: { flex: 1, padding: spacing.lg, gap: spacing["2xs"] },
    gridValue: {
      ...typography.metricLG,
      color: colors.text,
      fontVariant: ["tabular-nums"],
      marginTop: spacing.sm,
    },
    gridCaption: { ...typography.caption, color: colors.textMuted },
    gridChart: {
      marginTop: spacing.md,
      minHeight: 56,
      justifyContent: "flex-end",
    },
    focusBars: { gap: spacing.sm },
    focusTrack: {
      height: 8,
      borderRadius: radii.full,
      overflow: "hidden",
      backgroundColor: colors.track,
    },
    focusFill: { height: "100%", borderRadius: radii.full },
  }),
);
