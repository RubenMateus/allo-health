import * as Haptics from "expo-haptics";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChartColumn,
  Dumbbell,
  Gauge,
  Layers,
  RotateCw,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { CumulativeChart } from "@/components/charts/CumulativeChart";
import { ActivityCalendar } from "@/components/fitness/ActivityCalendar";
import {
  ActiveDurationCard,
  ActiveEnergyCard,
  CardioFocusCard,
  HeartRateRecoveryCard,
  HeartRateZonesCard,
  LoadGaugeCard,
  Vo2MaxCard,
} from "@/components/fitness/FitnessCards";
import { SettingsButton } from "@/components/settings/SettingsButton";
import {
  Card,
  EmptyState,
  Hairline,
  Pill,
  Screen,
} from "@/components/ui/primitives";
import { useBiomarkers } from "@/hooks/useBiomarkers";
import { useFitnessDashboard } from "@/hooks/useFitnessDashboard";
import type { FitnessData } from "@/services/health/fitness";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, type ColorTokens } from "@/theme/tokens";
import { cn } from "@/utils/cn";
import { formatDay, formatDuration, formatEnergy } from "@/utils/formatters";

export function FitnessScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data, isLoading, isFetching, isError, refetch } =
    useFitnessDashboard();
  // Screen margin plus card padding on both sides.
  const contentWidth = width - spacing.margin * 2 - spacing.lg * 2;

  return (
    <Screen
      refreshing={isFetching}
      onRefresh={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void refetch();
      }}
    >
      <View className="flex-row items-center gap-md pb-md mb-xl border-b-hairline border-b-outline-soft">
        <CalendarDays color={colors.primary} size={20} />
        <Text className="type-subheading text-text flex-1">
          {formatTodayShort()}
        </Text>
        {data ? <SourcePill source={data.source} /> : null}
        <SettingsButton />
      </View>

      <View className="gap-2xs mb-2xl">
        <Text className="type-title text-text">Fitness</Text>
        <Text className="type-caption text-text-muted">Last 30 days</Text>
      </View>

      {isLoading && !data ? (
        <FitnessSkeleton />
      ) : isError || !data ? (
        <Card>
          <EmptyState
            title="Workouts unavailable"
            detail="We couldn't read workouts from your health source. Check that workout access is allowed, then try again."
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void refetch()}
            className="min-h-[48px] rounded-full bg-primary-bright flex-row items-center justify-center gap-sm"
          >
            <RotateCw color={colors.canvas} size={16} />
            <Text className="type-subheading text-canvas">Try again</Text>
          </Pressable>
        </Card>
      ) : (
        <FitnessSections data={data} contentWidth={contentWidth} />
      )}
    </Screen>
  );
}

function FitnessSections({
  data,
  contentWidth,
}: {
  data: FitnessData;
  contentWidth: number;
}) {
  const { colors } = useTheme();
  const delta =
    data.activity.previousMinutes === null
      ? null
      : data.activity.totalMinutes - data.activity.previousMinutes;
  const { data: biomarkers } = useBiomarkers();
  // Two cards per row: half of the screen width minus margins and the gutter.
  const halfWidth = (contentWidth + spacing.lg * 2 - spacing.gutter) / 2;

  return (
    <View className="gap-2xl">
      <View className="flex-row gap-gutter">
        <LoadGaugeCard
          title="Cardio load"
          gauge={data.cardioGauge}
          metric="cardio-load"
          width={halfWidth}
        />
        <LoadGaugeCard
          title="Muscular load"
          gauge={data.muscularGauge}
          metric="muscular-load"
          width={halfWidth}
        />
      </View>

      <Card>
        <CardHeading
          icon={<ChartColumn color={colors.text} size={15} />}
          label="ACTIVITY SUMMARY"
          trailing={
            delta === null ? null : (
              <View
                className={cn(
                  "flex-row items-center gap-2xs px-sm py-2xs rounded-full border border-primary-border bg-primary-wash",
                  delta < 0 && "border-stress-border bg-stress-wash",
                )}
              >
                {delta >= 0 ? (
                  <ArrowUpRight color={colors.primary} size={13} />
                ) : (
                  <ArrowDownRight color={colors.stress} size={13} />
                )}
                <Text
                  className={cn(
                    "type-caption text-primary",
                    delta < 0 && "text-stress",
                  )}
                >
                  {formatDuration(Math.abs(delta))}
                </Text>
              </View>
            )
          }
        />
        <Text className="type-display text-text tabular-nums mt-lg">
          {formatDuration(data.activity.totalMinutes)}
        </Text>
        <Text className="type-mono text-text-muted mt-xs">
          {formatDay(data.rangeStart)} – {formatDay(data.rangeEnd)}
        </Text>
        {data.workoutCount ? (
          <>
            <View className="mt-xl">
              <CumulativeChart
                minutes={data.activity.cumulativeMinutes}
                width={contentWidth}
                accessibilityLabel={`${formatDuration(data.activity.totalMinutes)} of activity over the last 30 days`}
              />
            </View>
            <View className="flex-row justify-between mt-md pr-[34px]">
              <Text className="type-mono-small text-text-subtle">
                {formatDay(data.rangeStart)}
              </Text>
              <Text className="type-mono-small text-text-subtle">
                {formatDay(data.days[Math.floor(data.days.length / 2)]!.date)}
              </Text>
              <Text className="type-mono-small text-text-subtle">
                {formatDay(data.rangeEnd)}
              </Text>
            </View>
          </>
        ) : (
          <EmptyState
            title="No workouts yet"
            detail="Workouts recorded in your health app over the last 30 days will appear here."
          />
        )}
      </Card>

      <Card>
        <ActivityCalendar days={data.days} width={contentWidth} />
      </Card>

      <View className="gap-md">
        <View className="flex-row items-baseline justify-between">
          <Text className="type-subheading text-text">Cardio</Text>
          <Text className="type-mono text-text-subtle">
            Tap a card for details
          </Text>
        </View>
        <View className="gap-gutter">
          <View className="flex-row gap-gutter">
            <ActiveDurationCard data={data} width={halfWidth} />
            <ActiveEnergyCard data={data} width={halfWidth} />
          </View>
          <View className="flex-row gap-gutter">
            <Vo2MaxCard
              vo2Max={biomarkers?.biomarkers.vo2Max ?? null}
              width={halfWidth}
            />
            <HeartRateRecoveryCard data={data} width={halfWidth} />
          </View>
          <View className="flex-row gap-gutter">
            <CardioFocusCard data={data} />
            <HeartRateZonesCard data={data} width={halfWidth} />
          </View>
        </View>
      </View>

      <View className="gap-md">
        <View className="flex-row items-baseline justify-between">
          <Text className="type-subheading text-text">
            Strength & Training Mix
          </Text>
        </View>
        <Card className="p-0 overflow-hidden">
          {data.workoutCount ? (
            <>
              <StrengthBlock strength={data.strength} />
              <Hairline />
              <TrainingMixBlock mix={data.trainingMix} />
            </>
          ) : (
            <EmptyState
              title="No workouts yet"
              detail="Strength sessions and your training mix will appear once workouts are recorded."
            />
          )}
        </Card>
      </View>

      <View className="flex-row items-center justify-center gap-sm py-sm">
        <Gauge color={colors.textSubtle} size={14} />
        <Text className="type-caption text-text-subtle">
          Training estimates computed on this device.
        </Text>
      </View>
    </View>
  );
}

function CardHeading({
  icon,
  label,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-sm">
      {icon}
      <Text className="type-badge text-text shrink text-[11px]">{label}</Text>
      <View className="flex-1 flex-row items-center justify-end gap-md">
        {trailing}
      </View>
    </View>
  );
}

const WEEK_LABELS = ["3w ago", "2w ago", "Last wk", "This wk"];

function mixStyles(
  colors: ColorTokens,
): Record<
  FitnessData["trainingMix"][number]["category"],
  { label: string; color: string }
> {
  return {
    cardio: { label: "Cardio", color: colors.primary },
    strength: { label: "Strength", color: colors.fat },
    mixed: { label: "Mobility & other", color: colors.salmon },
  };
}

function StrengthBlock({ strength }: { strength: FitnessData["strength"] }) {
  const { colors } = useTheme();
  const peak = Math.max(...strength.weekly, 1);
  const energy =
    strength.activeEnergyKcal === null
      ? null
      : formatEnergy(strength.activeEnergyKcal);
  return (
    <View className="p-lg gap-md">
      <CardHeading
        icon={<Dumbbell color={colors.text} size={15} />}
        label="STRENGTH SESSIONS"
      />
      {strength.sessions === 0 ? (
        <Text className="type-caption text-text-subtle">
          No strength workouts in the last 30 days.
        </Text>
      ) : (
        <>
          <View className="flex-row items-center gap-md">
            <View className="flex-1 gap-sm">
              <View className="flex-row items-baseline gap-sm">
                <Text className="type-metric-xl text-text tabular-nums">
                  {strength.sessions}
                </Text>
                <Text className="type-mono text-text-muted">
                  {strength.sessions === 1 ? "session" : "sessions"}
                </Text>
              </View>
              <Text className="type-mono text-text-muted">
                {formatDuration(strength.minutes)} under load
              </Text>
            </View>
            <View
              className="flex-row gap-sm"
              accessible
              accessibilityLabel={`Strength sessions per week, oldest first: ${strength.weekly.join(", ")}`}
            >
              {strength.weekly.map((count, index) => (
                <View
                  key={WEEK_LABELS[index]}
                  className="items-center gap-2xs w-10"
                >
                  <Text className="type-mono text-text">{count}</Text>
                  <View className="w-3.5 h-12 rounded-sm justify-end overflow-hidden bg-track">
                    <View
                      className="w-full rounded-sm"
                      style={{
                        height: `${(count / peak) * 100}%`,
                        backgroundColor:
                          index === strength.weekly.length - 1
                            ? colors.primaryBright
                            : colors.fat,
                      }}
                    />
                  </View>
                  <Text className="type-mono-small text-text-subtle text-[9px]">
                    {WEEK_LABELS[index]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View className="flex-row justify-between pt-md border-t-hairline border-t-outline-soft">
            <MiniStat
              label="AVG HR"
              value={
                strength.averageHeartRate === null
                  ? "--"
                  : `${strength.averageHeartRate}`
              }
              unit="bpm"
            />
            <MiniStat
              label="ACTIVE ENERGY"
              value={energy?.value ?? "--"}
              unit={energy?.unit ?? "kcal"}
            />
            <MiniStat
              label="AVG SESSION"
              value={formatDuration(strength.minutes / strength.sessions)}
            />
          </View>
        </>
      )}
    </View>
  );
}

function MiniStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View className="gap-xs">
      <Text className="type-badge text-text-subtle">{label}</Text>
      <Text className="type-subheading text-text tabular-nums">
        {value}
        {unit ? (
          <Text className="type-mono text-text-subtle"> {unit}</Text>
        ) : null}
      </Text>
    </View>
  );
}

function TrainingMixBlock({ mix }: { mix: FitnessData["trainingMix"] }) {
  const { colors } = useTheme();
  return (
    <View className="p-lg gap-md">
      <CardHeading
        icon={<Layers color={colors.text} size={15} />}
        label="TRAINING MIX"
      />
      <View className="flex-row h-2 gap-[3px] rounded-full overflow-hidden">
        {mix.map((entry) => (
          <View
            key={entry.category}
            style={{
              flex: entry.minutes,
              backgroundColor: mixStyles(colors)[entry.category].color,
            }}
          />
        ))}
      </View>
      <View className="gap-sm">
        {mix.map((entry) => (
          <View
            key={entry.category}
            className="flex-row items-center gap-sm"
            accessible
            accessibilityLabel={`${mixStyles(colors)[entry.category].label} ${entry.share} percent, ${formatDuration(entry.minutes)}`}
          >
            <View
              className="w-[7px] h-[7px] rounded-full"
              style={{
                backgroundColor: mixStyles(colors)[entry.category].color,
              }}
            />
            <Text className="type-caption text-text flex-1">
              {mixStyles(colors)[entry.category].label}
            </Text>
            <Text className="type-mono text-text-muted">
              {formatDuration(entry.minutes)}
            </Text>
            <Text
              className="type-mono w-10 text-right tabular-nums"
              style={{ color: mixStyles(colors)[entry.category].color }}
            >
              {entry.share}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SourcePill({ source }: { source: FitnessData["source"] }) {
  return source === "mock" ? (
    <Pill>SAMPLE</Pill>
  ) : (
    <View className="flex-row items-center gap-xs px-md py-xs rounded-full border border-outline-soft bg-surface">
      <View className="w-[7px] h-[7px] rounded-full bg-primary" />
      <Text className="type-caption text-text">Synced</Text>
    </View>
  );
}

function FitnessSkeleton() {
  return (
    <View className="gap-2xl">
      <Card>
        <SkeletonBlock className="w-[40%] h-3 rounded-full bg-surface-high" />
        <SkeletonBlock className="w-[55%] h-9 rounded-md bg-surface-high mt-lg" />
        <SkeletonBlock className="w-full h-[120px] rounded-md bg-surface-high mt-lg" />
      </Card>
      <Card>
        <SkeletonBlock className="w-full h-[120px] rounded-md bg-surface-high mt-lg" />
      </Card>
    </View>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(withTiming(0.42, { duration: 900 }), -1, true),
  }));
  return <Animated.View className={className} style={animatedStyle} />;
}

function formatTodayShort() {
  return `Today, ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}
