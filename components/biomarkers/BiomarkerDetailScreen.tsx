import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import {
  biomarkerMeta,
  chartValues,
  displayValue,
  toneColor,
} from "@/components/biomarkers/meta";
import { TrendChart } from "@/components/charts/TrendChart";
import {
  DetailLayout,
  DetailSection,
  RangeToggle,
  StatGrid,
} from "@/components/detail/DetailLayout";
import { Card, EmptyState } from "@/components/ui/primitives";
import { useBiomarkers } from "@/hooks/useBiomarkers";
import type { BiomarkersData } from "@/services/health/biomarkers";
import type { BiomarkerKind } from "@/services/health/types";
import {
  bucketAverages,
  dayKey,
  personalBaseline,
  rangeStats,
} from "@/services/metrics";
import { makeStyles, useTheme } from "@/theme/ThemeProvider";
import { formatDay, formatNumber } from "@/utils/formatters";

type Range = "7" | "30" | "90" | "365";

const ranges: { value: Range; label: string }[] = [
  { value: "7", label: "1W" },
  { value: "30", label: "1M" },
  { value: "90", label: "3M" },
  { value: "365", label: "1Y" },
];

// Metrics people track against their own normal rather than a population range.
const baselineKinds = new Set<BiomarkerKind>([
  "hrv",
  "restingHeartRate",
  "respiratoryRate",
]);

const sourceNames: Record<BiomarkersData["source"], string> = {
  mock: "sample data",
  apple: "Apple Health",
  "health-connect": "Health Connect",
};

export function BiomarkerDetailScreen({ kind }: { kind: BiomarkerKind }) {
  const { data } = useBiomarkers();
  const { colors } = useTheme();
  const meta = biomarkerMeta[kind];
  const biomarker = data?.biomarkers[kind];
  const latest = biomarker?.latest ?? null;
  const latestDisplay = latest ? displayValue(kind, latest) : null;

  return (
    <DetailLayout
      title={meta.title}
      value={latestDisplay?.value ?? null}
      unit={latestDisplay?.unit}
      status={biomarker?.status?.label}
      statusColor={
        biomarker?.status ? toneColor(biomarker.status.tone, colors) : undefined
      }
      caption={
        latest
          ? `Last reading ${formatDay(dayKey(new Date(latest.timestamp)))}`
          : null
      }
    >
      {data && biomarker && latest ? (
        <DetailBody kind={kind} data={data} />
      ) : data ? (
        <Card>
          <EmptyState
            title="No readings yet"
            detail={`${meta.title} will appear here once your health app records it.`}
          />
        </Card>
      ) : null}
    </DetailLayout>
  );
}

function DetailBody({
  kind,
  data,
}: {
  kind: BiomarkerKind;
  data: BiomarkersData;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<Range>("90");
  const [now] = useState(() => Date.now());
  const meta = biomarkerMeta[kind];
  const biomarker = data.biomarkers[kind];
  const accent = colors[meta.accent];
  const cutoff = now - Number(range) * 86_400_000;
  const inRange = biomarker.history.filter(
    (sample) => new Date(sample.timestamp).getTime() >= cutoff,
  );
  // Daily points get too dense to read past a month, so longer ranges plot weekly.
  const plotted = Number(range) > 30 ? bucketAverages(inRange, 7) : inRange;
  const daily = rangeStats(inRange);
  const stats = daily && {
    ...daily,
    change: plotted.at(-1)!.value - plotted[0]!.value,
  };
  const baseline = baselineKinds.has(kind)
    ? personalBaseline(biomarker.history, new Date(now))
    : null;
  const toChart = (value: number) => meta.chartValue?.(value) ?? value;
  const fmt = (value: number) => meta.format(value).value;
  const unit = meta.format(0).unit;
  const chartWidth = width - 32 * 2;
  const recent = biomarker.history.slice(-10).reverse();

  return (
    <>
      <RangeToggle options={ranges} value={range} onChange={setRange} />

      <Card>
        {inRange.length ? (
          <>
            <TrendChart
              points={chartValues(kind, plotted).map((value, index) => ({
                time: new Date(plotted[index]!.timestamp).getTime(),
                value,
              }))}
              color={accent}
              width={chartWidth}
              band={
                baseline ? [toChart(baseline[0]), toChart(baseline[1])] : null
              }
              formatValue={(value) =>
                formatNumber(value, Math.abs(value) < 100 ? 1 : 0)
              }
              accessibilityLabel={`${meta.title} for the selected range`}
            />
            <View style={styles.axisRow}>
              <Text style={styles.axisText}>
                {formatDay(dayKey(new Date(inRange[0]!.timestamp)))}
              </Text>
              <Text style={styles.axisText}>
                {formatDay(dayKey(new Date(inRange.at(-1)!.timestamp)))}
              </Text>
            </View>
            {baseline ? (
              <View style={styles.legend}>
                <View
                  style={[styles.legendSwatch, { backgroundColor: accent }]}
                />
                <Text style={styles.legendText}>
                  Your usual range: {fmt(baseline[0])}–{fmt(baseline[1])} {unit}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No readings in this range"
            detail="Pick a longer range to see earlier readings."
          />
        )}
      </Card>

      {stats ? (
        <Card>
          <StatGrid
            stats={[
              { label: "Average", value: fmt(stats.average), unit },
              {
                label: "Change",
                value: signed(fmt(stats.change), stats.change),
                unit,
              },
              { label: "Low", value: fmt(stats.min), unit },
              { label: "High", value: fmt(stats.max), unit },
            ]}
          />
        </Card>
      ) : null}

      {kind === "vo2Max" && data.fitnessAge ? (
        <DetailSection title="Fitness Age">
          <Card>
            <Text style={styles.bigLine}>
              {formatNumber(data.fitnessAge.value, 1)}{" "}
              <Text style={styles.bigUnit}>years</Text>
            </Text>
            <Text style={styles.body}>
              The age at which your latest VO₂ max would be the typical (median)
              value for your sex, using the FRIEND registry reference standards
              (Kaminsky et al., 2022).
              {data.fitnessAge.chronologicalAge !== null
                ? ` You are ${data.fitnessAge.chronologicalAge}.`
                : ""}{" "}
              Raising VO₂ max through regular aerobic training lowers it.
            </Text>
          </Card>
        </DetailSection>
      ) : null}

      <DetailSection title="What this means">
        <Card>
          <Text style={styles.body}>{meta.about}</Text>
          <Text style={[styles.body, styles.note]}>
            {biomarker.status?.basis === "rating" && meta.ratingNote
              ? meta.ratingNote
              : "The status compares your average over the last 7 days with the 30 days before."}
          </Text>
        </Card>
      </DetailSection>

      <DetailSection title="Recent readings">
        <Card style={styles.listCard}>
          {recent.map((sample, index) => {
            const { value, unit: sampleUnit } = displayValue(kind, sample);
            return (
              <View
                key={sample.timestamp}
                style={[styles.listRow, index > 0 && styles.listDivider]}
              >
                <Text style={styles.listDate}>
                  {formatDay(dayKey(new Date(sample.timestamp)))}
                </Text>
                <Text style={styles.listValue}>
                  {value} <Text style={styles.listUnit}>{sampleUnit}</Text>
                </Text>
              </View>
            );
          })}
        </Card>
        <Text style={styles.source}>
          Daily averages from {sourceNames[data.source]}, read on this phone.
        </Text>
      </DetailSection>
    </>
  );
}

function signed(formatted: string, value: number) {
  return value > 0 && !formatted.startsWith("+") ? `+${formatted}` : formatted;
}

const useStyles = makeStyles(({ colors, radii, spacing, typography }) =>
  StyleSheet.create({
    axisRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.sm,
      paddingRight: 40,
    },
    axisText: { ...typography.monoSmall, color: colors.textSubtle },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    legendSwatch: {
      width: 12,
      height: 8,
      borderRadius: radii.sm,
      opacity: 0.35,
    },
    legendText: { ...typography.caption, color: colors.textMuted },
    bigLine: {
      ...typography.metricXL,
      color: colors.text,
      fontVariant: ["tabular-nums"],
      marginBottom: spacing.sm,
    },
    bigUnit: { ...typography.mono, color: colors.textSubtle },
    body: { ...typography.bodySmall, color: colors.textMuted },
    note: { marginTop: spacing.md, color: colors.textSubtle },
    listCard: { paddingVertical: spacing.xs },
    listRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
    },
    listDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineSoft,
    },
    listDate: { ...typography.caption, color: colors.textMuted },
    listValue: {
      ...typography.mono,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    listUnit: { color: colors.textSubtle },
    source: {
      ...typography.caption,
      color: colors.textSubtle,
      textAlign: "center",
    },
  }),
);
