import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

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
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
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
            <View className="flex-row justify-between mt-sm pr-10">
              <Text className="type-mono-small text-text-subtle">
                {formatDay(dayKey(new Date(inRange[0]!.timestamp)))}
              </Text>
              <Text className="type-mono-small text-text-subtle">
                {formatDay(dayKey(new Date(inRange.at(-1)!.timestamp)))}
              </Text>
            </View>
            {baseline ? (
              <View className="flex-row items-center gap-sm mt-md">
                <View
                  className="w-3 h-2 rounded-sm opacity-35"
                  style={{ backgroundColor: accent }}
                />
                <Text className="type-caption text-text-muted">
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
            <Text className="type-metric-xl text-text tabular-nums mb-sm">
              {formatNumber(data.fitnessAge.value, 1)}{" "}
              <Text className="type-mono text-text-subtle">years</Text>
            </Text>
            <Text className="type-body-small text-text-muted">
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
          <Text className="type-body-small text-text-muted">{meta.about}</Text>
          <Text className="type-body-small mt-md text-text-subtle">
            {biomarker.status?.basis === "rating" && meta.ratingNote
              ? meta.ratingNote
              : "The status compares your average over the last 7 days with the 30 days before."}
          </Text>
        </Card>
      </DetailSection>

      <DetailSection title="Recent readings">
        <Card className="py-xs">
          {recent.map((sample, index) => {
            const { value, unit: sampleUnit } = displayValue(kind, sample);
            return (
              <View
                key={sample.timestamp}
                className={cn(
                  "flex-row justify-between py-md",
                  index > 0 && "border-t-hairline border-t-outline-soft",
                )}
              >
                <Text className="type-caption text-text-muted">
                  {formatDay(dayKey(new Date(sample.timestamp)))}
                </Text>
                <Text className="type-mono text-text tabular-nums">
                  {value} <Text className="text-text-subtle">{sampleUnit}</Text>
                </Text>
              </View>
            );
          })}
        </Card>
        <Text className="type-caption text-text-subtle text-center">
          Daily averages from {sourceNames[data.source]}, read on this phone.
        </Text>
      </DetailSection>
    </>
  );
}

function signed(formatted: string, value: number) {
  return value > 0 && !formatted.startsWith("+") ? `+${formatted}` : formatted;
}
