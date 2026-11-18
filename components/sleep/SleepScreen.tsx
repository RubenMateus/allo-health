import { LockKeyhole } from "lucide-react-native";
import { Text, useWindowDimensions, View } from "react-native";

import { Hypnogram, stageLabels } from "@/components/charts/Hypnogram";
import {
  DetailLayout,
  DetailSection,
  StatGrid,
} from "@/components/detail/DetailLayout";
import { Card, EmptyState } from "@/components/ui/primitives";
import { dayEyebrow } from "@/components/day/dayLabels";
import { useDayDashboard } from "@/hooks/useHealthDashboard";
import type { SleepData, SleepStage } from "@/services/health/types";
import { sleepScoreStatus } from "@/services/metrics";
import { useIsToday } from "@/stores/dayStore";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { formatClock, formatDuration } from "@/utils/formatters";

const statusLabels = {
  OPTIMAL: "Optimal",
  FAIR: "Fair",
  LOW: "Low",
  "NO DATA": "No data",
} as const;

/** Last night: the sleep score, time in bed and asleep, and the stages across the night. */
export function SleepScreen() {
  const { data } = useDayDashboard();
  const isToday = useIsToday();
  const subtitle = data && !isToday ? dayEyebrow(data.date) : undefined;
  if (!data)
    return <DetailLayout title="Sleep" value={null} status="Loading" />;

  const { sleep, sleepScore } = data;
  if (!sleep || sleepScore === null)
    return (
      <DetailLayout
        title="Sleep"
        subtitle={subtitle}
        value={null}
        status="No sleep recorded"
      >
        <EmptyState
          title={
            isToday
              ? "Nothing from last night yet"
              : "Nothing recorded that night"
          }
          detail="Sleep shows up here once your watch, ring or phone writes a night to Apple Health or Health Connect."
        />
      </DetailLayout>
    );

  const window = `${formatClock(sleep.bedtime)} – ${formatClock(sleep.wakeTime)}`;
  return (
    <DetailLayout
      title="Sleep"
      subtitle={subtitle}
      value={`${sleepScore}`}
      unit="/ 100"
      status={statusLabels[sleepScoreStatus(sleepScore)]}
      caption={`${isToday ? "LAST NIGHT" : "THAT NIGHT"} / ${window}`}
    >
      <Card>
        <StatGrid
          stats={[
            { label: "Time in bed", value: formatDuration(sleep.inBedMinutes) },
            {
              label: "Time asleep",
              value: formatDuration(sleep.durationMinutes),
            },
            {
              label: "Efficiency",
              value: `${Math.round(sleep.efficiency * 100)}`,
              unit: "%",
            },
            { label: "Awake", value: formatDuration(sleep.awakeMinutes) },
          ]}
        />
      </Card>

      <DetailSection
        title="Sleep stages"
        trailing={
          <Text className="type-mono-small text-text-subtle">{window}</Text>
        }
      >
        <StagesCard sleep={sleep} />
      </DetailSection>

      <DetailSection title="How the score works">
        <Text className="type-caption text-text-muted -mt-xs">
          Time asleep against an {formatDuration(sleep.needMinutes)} need counts
          for 50%, efficiency for 30%, and how close deep and REM sleep come to
          a typical share of the night for 20%.
        </Text>
      </DetailSection>

      <PrivacyNote />
    </DetailLayout>
  );
}

function StagesCard({ sleep }: { sleep: SleepData }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const chartWidth = width - spacing.margin * 2 - spacing.lg * 2;
  const staged = sleep.deepMinutes + sleep.remMinutes + sleep.lightMinutes > 0;
  const totals: { stage: SleepStage; minutes: number; color: string }[] = staged
    ? [
        {
          stage: "awake",
          minutes: sleep.awakeMinutes,
          color: colors.stageAwake,
        },
        { stage: "rem", minutes: sleep.remMinutes, color: colors.stageRem },
        {
          stage: "light",
          minutes: sleep.lightMinutes,
          color: colors.stageLight,
        },
        {
          stage: "deep",
          minutes: sleep.deepMinutes,
          color: colors.stageDeep,
        },
      ]
    : [
        {
          stage: "awake",
          minutes: sleep.awakeMinutes,
          color: colors.stageAwake,
        },
        {
          stage: "asleep",
          minutes: sleep.durationMinutes,
          color: colors.stageDeep,
        },
      ];
  const total = Math.max(
    totals.reduce((sum, item) => sum + item.minutes, 0),
    1,
  );

  return (
    <Card className="gap-lg">
      {sleep.stages.length ? (
        <Hypnogram stages={sleep.stages} width={chartWidth} />
      ) : null}
      <View className="flex-row h-2 rounded-full overflow-hidden bg-track">
        {totals.map((item) =>
          item.minutes > 0 ? (
            <View
              key={item.stage}
              style={{ flex: item.minutes, backgroundColor: item.color }}
            />
          ) : null,
        )}
      </View>
      <View className="flex-row gap-sm">
        {totals.map((item) => (
          <View
            key={item.stage}
            className="flex-1 gap-2xs rounded-md bg-surface p-sm"
          >
            <View className="flex-row items-center gap-xs">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <Text className="type-caption text-text-muted" numberOfLines={1}>
                {stageLabels[item.stage]}
              </Text>
            </View>
            <Text
              className="type-mono text-text tabular-nums"
              numberOfLines={1}
            >
              {formatDuration(item.minutes)}
            </Text>
            <Text className="type-mono-small text-text-subtle tabular-nums">
              {Math.round((item.minutes / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
      {staged ? null : (
        <Text className="type-caption text-text-subtle">
          The source that recorded this night didn&apos;t track stages. A watch
          or ring that does fills in REM, light and deep sleep.
        </Text>
      )}
    </Card>
  );
}

export function PrivacyNote() {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-sm">
      <LockKeyhole color={colors.textSubtle} size={14} />
      <Text className="type-caption text-text-subtle flex-1">
        Read on this phone from your health data. Nothing is sent anywhere.
      </Text>
    </View>
  );
}
