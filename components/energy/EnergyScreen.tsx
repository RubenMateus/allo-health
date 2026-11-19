import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { EnergyCurve } from "@/components/charts/EnergyCurve";
import { usePastDayEyebrow } from "@/components/day/dayLabels";
import {
  DetailLayout,
  DetailSection,
  PrivacyNote,
  useDetailChartWidth,
} from "@/components/detail/DetailLayout";
import { Card, EmptyState } from "@/components/ui/primitives";
import { useEnergyUsual } from "@/hooks/useEnergyUsual";
import { useDayDashboard } from "@/hooks/useHealthDashboard";
import { fromDayKey } from "@/services/journal";
import {
  energyCoaching,
  energyStatus,
  type EnergySummary,
} from "@/services/metrics/energy";
import { useIsToday } from "@/stores/dayStore";
import { useTheme } from "@/theme/ThemeProvider";
import { formatClock } from "@/utils/formatters";

const HOUR_MS = 3_600_000;

/** A day's Energy Bank (today by default): what's left, how it moved, and how that compares. */
export function EnergyScreen() {
  const chartWidth = useDetailChartWidth();
  const { data } = useDayDashboard();
  const isToday = useIsToday();
  const subtitle = usePastDayEyebrow();
  if (!data)
    return <DetailLayout title="Energy Bank" value={null} status="Loading" />;

  const energy = data.today.energy;
  if (!energy || !data.energyPoints.length)
    return (
      <DetailLayout
        title="Energy Bank"
        subtitle={subtitle}
        value={null}
        status={energyStatus(null)}
      >
        <EmptyState
          title={isToday ? "Nothing recorded today yet" : "Nothing recorded that day"}
          detail="Heart rate and HRV readings build your Energy Bank through the day."
        />
        <HowItWorks />
        <PrivacyNote />
      </DetailLayout>
    );

  const last = data.energyPoints[data.energyPoints.length - 1];
  return (
    <DetailLayout
      title="Energy Bank"
      subtitle={subtitle}
      value={`${energy.close}`}
      unit="%"
      status={energyStatus(energy.close)}
      caption={
        energy.lastCharged
          ? `Last charged to ${energy.lastCharged.value}% at ${formatClock(energy.lastCharged.at)}`
          : null
      }
    >
      <Battery value={energy.close} />
      <View className="flex-row gap-md">
        <Total label="Total charged" value={energy.charged} sign="+" />
        <Total label="Total drained" value={energy.drained} sign="−" />
      </View>
      <Coaching
        energy={energy}
        date={data.today.date}
        isToday={isToday}
        at={isToday ? formatClock(last.timestamp) : "24:00"}
      />
      <DetailSection title="Energy level">
        <Card className="gap-sm">
          <EnergyCurve
            points={data.energyPoints}
            sleepBands={sleepBands(data.sleep?.stages ?? [])}
            start={fromDayKey(data.today.date)}
            end={new Date(fromDayKey(data.today.date).getTime() + 24 * HOUR_MS)}
            width={chartWidth}
            accessibilityLabel={`Energy through the day, ${energy.close} percent ${isToday ? "now" : "at the end"}`}
          />
          <Text className="type-caption text-text-subtle">
            The shaded stretch is sleep.
          </Text>
        </Card>
      </DetailSection>
      <HowItWorks />
      <PrivacyNote />
    </DetailLayout>
  );
}

function Battery({ value }: { value: number }) {
  const { gradients } = useTheme();
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View
      accessibilityLabel={`Energy Bank ${value} percent`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      className="flex-row items-center"
    >
      <View className="flex-1 h-[56px] rounded-card border-2 border-outline p-xs">
        <LinearGradient
          colors={gradients.energy}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="h-full rounded-[10px]"
          style={{ width }}
        />
      </View>
      <View className="w-[6px] h-[20px] rounded-r-full bg-outline ml-[2px]" />
    </View>
  );
}

function Total({
  label,
  value,
  sign,
}: {
  label: string;
  value: number;
  sign: string;
}) {
  return (
    <Card className="flex-1 items-center gap-xs">
      <Text className="type-metric-lg text-text tabular-nums">
        {sign}
        {value}
      </Text>
      <Text className="type-caption text-text-muted">{label}</Text>
    </Card>
  );
}

function Coaching({
  energy,
  date,
  isToday,
  at,
}: {
  energy: EnergySummary;
  date: string;
  isToday: boolean;
  at: string;
}) {
  // Compare today at its latest full hour; a past day by its close.
  const hour = isToday ? Number(at.slice(0, 2)) : 24;
  const usual = useEnergyUsual(date, hour);
  const value = energy.hourly[hour] ?? energy.close;
  return (
    <Card className="gap-xs">
      <Text className="type-badge text-text-muted">COACHING</Text>
      <Text className="type-body text-text">
        {energyCoaching({
          value,
          usual,
          at: isToday ? `${at.slice(0, 2)}:00` : at,
          isToday,
        })}
      </Text>
    </Card>
  );
}

function HowItWorks() {
  return (
    <DetailSection title="How it works">
      <Text className="type-caption text-text-muted -mt-xs">
        Every day starts at 20% at midnight. Sleep charges the bank, deep and REM
        sleep most. Calm waking stretches add a little, while stress and hard
        effort drain it, every five minutes from your heart rate and HRV. It is
        an estimate, not a medical measure.
      </Text>
    </DetailSection>
  );
}

/** Asleep stretches of the night, merged, for shading. */
function sleepBands(stages: { stage: string; start: string; end: string }[]) {
  const bands: { start: string; end: string }[] = [];
  for (const stage of stages) {
    if (stage.stage === "awake") continue;
    const previous = bands[bands.length - 1];
    if (previous && previous.end === stage.start) previous.end = stage.end;
    else bands.push({ start: stage.start, end: stage.end });
  }
  return bands;
}
