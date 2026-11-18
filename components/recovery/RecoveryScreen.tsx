import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { BarChart } from "@/components/charts/BarChart";
import { DetailLayout, DetailSection } from "@/components/detail/DetailLayout";
import { LoadBalanceSection } from "@/components/loadBalance/LoadBalanceCard";
import { PrivacyNote } from "@/components/sleep/SleepScreen";
import { historyLabel } from "@/components/strain/StrainScreen";
import { Card, Hairline } from "@/components/ui/primitives";
import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import {
  compareToBaseline,
  MIN_BASELINE_DAYS,
  type DailyScore,
  type RecoverySignal,
  type SignalKind,
} from "@/services/metrics/daily";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { cn } from "@/utils/cn";

/** Same thresholds as the Home ring. */
export function recoveryStatus(score: number | null) {
  if (score === null) return "No data";
  return score >= 75 ? "High" : score >= 50 ? "Moderate" : "Low";
}

const signalRows: {
  kind: SignalKind;
  label: string;
  unit: string;
  weight: string;
  digits: number;
}[] = [
  { kind: "hrv", label: "HRV", unit: "ms", weight: "35%", digits: 0 },
  {
    kind: "restingHeartRate",
    label: "Resting HR",
    unit: "bpm",
    weight: "30%",
    digits: 0,
  },
  {
    kind: "respiratoryRate",
    label: "Breathing",
    unit: "/min",
    weight: "10%",
    digits: 1,
  },
];

/** Today's recovery: what moved it against your own normal, and the last two weeks. */
export function RecoveryScreen() {
  const { width } = useWindowDimensions();
  const chartWidth = width - spacing.margin * 2 - spacing.lg * 2;
  const { data } = useHealthDashboard();
  if (!data)
    return <DetailLayout title="Recovery" value={null} status="Loading" />;

  const { today } = data;
  const missing = missingInputs(today);
  return (
    <DetailLayout
      title="Recovery"
      value={today.recovery === null ? null : `${today.recovery}`}
      unit={today.recovery === null ? undefined : "%"}
      status={recoveryStatus(today.recovery)}
      caption={
        missing.length
          ? `WAITING FOR ${missing.join(", ").toUpperCase()}`
          : "TODAY / AGAINST YOUR 30-DAY AVERAGE"
      }
    >
      <DetailSection title="What moved it">
        <InputsCard today={today} />
      </DetailSection>

      <HistorySection width={chartWidth} />
      <LoadBalanceSection width={chartWidth} />

      <DetailSection title="How the score works">
        <Text className="type-caption text-text-muted -mt-xs">
          Recovery compares this morning to your own average over the last 30
          days. HRV counts for 35%, resting heart rate 30%, sleep 25% and
          breathing rate 10%. Higher HRV and lower resting heart rate and
          breathing rate than usual mean you&apos;ve recovered well. Until there
          are {MIN_BASELINE_DAYS} days of a signal, it&apos;s compared to a
          typical adult value instead.
        </Text>
      </DetailSection>

      <PrivacyNote />
    </DetailLayout>
  );
}

function missingInputs(today: DailyScore) {
  const { recoveryInputs } = today;
  return [
    ...signalRows
      .filter((row) => recoveryInputs[row.kind].value === null)
      .map((row) => row.label),
    ...(recoveryInputs.sleepScore === null ? ["Sleep"] : []),
  ];
}

function InputsCard({ today }: { today: DailyScore }) {
  const { colors } = useTheme();
  const [hrv, resting, breathing] = signalRows;
  const rows = (row: (typeof signalRows)[number]) => (
    <SignalRow
      key={row.kind}
      row={row}
      signal={today.recoveryInputs[row.kind]}
    />
  );
  return (
    <Card className="gap-md">
      {rows(hrv!)}
      <Hairline />
      {rows(resting!)}
      <Hairline />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sleep score ${today.recoveryInputs.sleepScore ?? "no data"}, counts 25 percent`}
        accessibilityHint="Opens last night's sleep"
        onPress={() => router.push("/sleep")}
        className="flex-row items-center justify-between active:opacity-70"
      >
        <View className="gap-2xs">
          <Text className="type-body-small text-text">Sleep</Text>
          <Text className="type-mono-small text-text-subtle">COUNTS 25%</Text>
        </View>
        <View className="flex-row items-center gap-xs">
          <Text className="type-mono text-text tabular-nums">
            {today.recoveryInputs.sleepScore ?? "--"}
          </Text>
          <Text className="type-mono-small text-text-subtle">/ 100</Text>
          <ChevronRight color={colors.textSubtle} size={14} />
        </View>
      </Pressable>
      <Hairline />
      {rows(breathing!)}
    </Card>
  );
}

function SignalRow({
  row,
  signal,
}: {
  row: (typeof signalRows)[number];
  signal: RecoverySignal;
}) {
  const comparison = compareToBaseline(row.kind, signal);
  const format = (value: number) => value.toFixed(row.digits);
  return (
    <View className="flex-row items-center justify-between">
      <View className="gap-2xs flex-1">
        <Text className="type-body-small text-text">{row.label}</Text>
        <Text className="type-mono-small text-text-subtle">
          {signal.building
            ? `BUILDING YOUR BASELINE (${signal.baselineDays} OF ${MIN_BASELINE_DAYS} DAYS)`
            : `AVG ${format(signal.baseline)} · COUNTS ${row.weight}`}
        </Text>
      </View>
      <View className="items-end gap-2xs">
        <View className="flex-row items-baseline gap-xs">
          <Text className="type-mono text-text tabular-nums">
            {signal.value === null ? "--" : format(signal.value)}
          </Text>
          <Text className="type-mono-small text-text-subtle">{row.unit}</Text>
        </View>
        {comparison ? (
          <Text
            className={cn(
              "type-mono-small",
              comparison.percent === 0
                ? "text-text-subtle"
                : comparison.better
                  ? "text-primary"
                  : "text-error",
            )}
          >
            {comparison.percent === 0
              ? "AS USUAL"
              : `${comparison.percent > 0 ? "+" : ""}${comparison.percent}% · ${comparison.better ? "BETTER" : "WORSE"}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function HistorySection({ width }: { width: number }) {
  const { colors } = useTheme();
  const { data: days } = useScoreHistory();
  const colorFor = (score: number) =>
    score >= 75 ? colors.primary : score >= 50 ? colors.stress : colors.error;
  return (
    <DetailSection title="Last 14 days">
      <Card className="gap-md">
        {days ? (
          <BarChart
            bars={days.map((day, index) => ({
              value: day.recovery ?? 0,
              color: day.recovery === null ? undefined : colorFor(day.recovery),
              label: historyLabel(index, days.length),
            }))}
            width={width}
            color={colors.primary}
            accessibilityLabel={`Recovery for the last ${days.length} days`}
          />
        ) : (
          <Text className="type-caption text-text-subtle">
            Reading the last two weeks…
          </Text>
        )}
        <View className="flex-row gap-md">
          {(
            [
              ["High", colors.primary],
              ["Moderate", colors.stress],
              ["Low", colors.error],
            ] as const
          ).map(([label, color]) => (
            <View key={label} className="flex-row items-center gap-xs">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <Text className="type-caption text-text-subtle">{label}</Text>
            </View>
          ))}
        </View>
      </Card>
    </DetailSection>
  );
}
