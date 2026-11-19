import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  ChevronRight,
  HeartPulse,
  MoonStar,
  RotateCw,
  Sparkles,
} from "lucide-react-native";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { GlowRing, type RingMetric } from "@/components/charts/GlowRing";
import { Sparkline } from "@/components/charts/Sparkline";
import { TabHeader } from "@/components/navigation/TabHeader";
import { useHealthConnectSheet } from "@/components/permissions/useHealthConnectSheet";
import {
  Card,
  EmptyState,
  Hairline,
  MetricLabel,
  Pill,
  Screen,
  SectionHeader,
  StatValue,
} from "@/components/ui/primitives";
import { DayStrip } from "@/components/day/DayStrip";
import { dayEyebrow } from "@/components/day/dayLabels";
import { useDayDashboard } from "@/hooks/useHealthDashboard";
import {
  coachingEngine,
  coachingInputFrom,
  morningTargetStrain,
} from "@/services/coaching";
import type { DashboardData } from "@/services/health/dashboard";
import {
  recoveryScoreStatus,
  sleepScoreStatus,
  strainScoreStatus,
} from "@/services/metrics";
import { fromDayKey } from "@/services/journal";
import { useIsToday, useSelectedDayKey } from "@/stores/dayStore";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import {
  convertGlucose,
  formatEnergy,
  formatGlucose,
  formatTime,
} from "@/utils/formatters";

export function HomeScreen() {
  const { colors } = useTheme();
  const dimensions = useWindowDimensions();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, isError, refetch } = useDayDashboard();
  const isToday = useIsToday();
  const selectedDayKey = useSelectedDayKey();
  const healthSheet = useHealthConnectSheet();
  const { permissionState, permissionMessage } = healthSheet;

  const chartWidth = Math.max(220, dimensions.width - 80);
  const ringSize = Math.min(
    102,
    Math.floor(
      (dimensions.width -
        spacing.margin * 2 -
        spacing.lg * 2 -
        spacing.md * 2) /
        3,
    ),
  );

  return (
    <>
      <Screen
        refreshing={isFetching}
        onRefresh={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          void refetch();
          // The last finished days, for watches that sync late.
          void queryClient.invalidateQueries({ queryKey: ["score-history"] });
        }}
      >
        <TabHeader
          section="Daily systems"
          onConnectPress={healthSheet.open}
          date={fromDayKey(selectedDayKey)}
        />
        <DayStrip />

        {permissionState === "unrequested" ||
        permissionState === "denied" ||
        permissionState === "partial" ? (
          <Pressable
            accessibilityRole="button"
            onPress={healthSheet.open}
            className="min-h-[42px] px-md mb-lg rounded-md border border-stress-border bg-stress-wash flex-row items-center gap-sm"
          >
            <View className="w-1.5 h-1.5 rounded-full bg-stress" />
            <Text className="type-caption text-text flex-1">
              {permissionMessage ??
                (permissionState === "partial"
                  ? "Limited health data access"
                  : "Showing sample data / connect health data")}
            </Text>
            <ChevronRight color={colors.stress} size={16} />
          </Pressable>
        ) : null}

        {isLoading && !data ? (
          <DashboardSkeleton />
        ) : isError || !data ? (
          <Card>
            <EmptyState
              title="Telemetry unavailable"
              detail={`We couldn't load ${isToday ? "today's" : "that day's"} health data.`}
            />
            <PrimaryAction label="Try again" onPress={() => void refetch()} />
          </Card>
        ) : (
          <DashboardSections
            data={data}
            isToday={isToday}
            ringSize={ringSize}
            chartWidth={chartWidth}
          />
        )}
      </Screen>
      {healthSheet.sheet}
    </>
  );
}

function DashboardSections({
  data,
  isToday,
  ringSize,
  chartWidth,
}: {
  data: DashboardData;
  isToday: boolean;
  ringSize: number;
  chartWidth: number;
}) {
  const { colors, gradients } = useTheme();
  const strainStatus = strainScoreStatus(data.today.strain);
  const recoveryStatus = recoveryScoreStatus(data.today.recovery);
  const sleepStatus = sleepScoreStatus(data.today.sleepScore);
  // The balance at the latest reading: now on today, midnight on a past day.
  const energyValue = data.today.energy?.close ?? null;
  const rings: (RingMetric & {
    href: "/strain" | "/recovery" | "/sleep";
    hint: string;
  })[] = [
    {
      label: "STRAIN",
      value: data.today.strain,
      max: 21,
      colors: gradients.strain,
      status: strainStatus,
      glowStyle: "strain",
      href: "/strain",
      hint: isToday ? "Opens today's strain" : "Opens that day's strain",
    },
    {
      label: "RECOVERY",
      value: data.today.recovery,
      max: 100,
      colors: gradients.recovery,
      status: recoveryStatus,
      glowStyle: "recovery",
      href: "/recovery",
      hint: isToday ? "Opens today's recovery" : "Opens that day's recovery",
    },
    {
      label: "SLEEP",
      value: data.today.sleepScore,
      max: 100,
      colors: gradients.sleep,
      status: sleepStatus,
      glowStyle: "sleep",
      href: "/sleep",
      hint: "Opens last night's sleep",
    },
  ];
  const coaching = isToday
    ? coachingEngine.recommend(coachingInputFrom(data.today))
    : null;
  const target = isToday ? morningTargetStrain(data.today) : null;

  return (
    <View className="gap-2xl">
      <SectionHeader
        title="Daily readiness"
        eyebrow={
          !isToday
            ? data.source === "mock"
              ? `SAMPLE · ${dayEyebrow(data.today.date)}`
              : dayEyebrow(data.today.date)
            : data.source === "mock"
              ? "SAMPLE TELEMETRY"
              : "TODAY / HEALTH SIGNALS"
        }
        trailing={
          <Pill
            tone={
              data.source === "mock"
                ? "neutral"
                : data.permissionState === "partial"
                  ? "warning"
                  : "positive"
            }
          >
            {data.source === "mock"
              ? "MOCK"
              : data.permissionState === "partial"
                ? "LIMITED"
                : "LIVE"}
          </Pill>
        }
      />
      <Card className="px-md py-xl">
        <View className="flex-row justify-between items-start gap-md">
          {rings.map(({ href, hint, ...metric }) => (
            <GlowRing
              key={metric.label}
              metric={metric}
              size={ringSize}
              strokeWidth={8}
              accessibilityHint={hint}
              onPress={() => {
                void Haptics.selectionAsync();
                router.push(href);
              }}
            />
          ))}
        </View>
        <Hairline className="my-lg" />
        <View className="flex-row items-center justify-between">
          <View className="flex-1 items-center gap-xs">
            <MetricLabel>RESTING HR</MetricLabel>
            <StatValue unit="bpm">
              {data.restingHeartRate === null
                ? "--"
                : Math.round(data.restingHeartRate)}
            </StatValue>
          </View>
          <View className="w-hairline h-[30px] bg-outline-soft" />
          <View className="flex-1 items-center gap-xs">
            <MetricLabel>HRV</MetricLabel>
            <StatValue unit="ms">
              {data.hrv === null ? "--" : Math.round(data.hrv)}
            </StatValue>
          </View>
          <View className="w-hairline h-[30px] bg-outline-soft" />
          <View className="flex-1 items-center gap-xs">
            <MetricLabel>RESP. RATE</MetricLabel>
            <StatValue unit="/min">
              {data.respiratoryRate === null
                ? "--"
                : data.respiratoryRate.toFixed(1)}
            </StatValue>
          </View>
        </View>
      </Card>

      {coaching && target ? (
        <View className="gap-md">
          <SectionHeader
            title="AI readiness"
            eyebrow="TRAINING GUIDANCE"
            trailing={<Sparkles color={colors.primary} size={17} />}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Readiness details"
            onPress={() => {
              void Haptics.selectionAsync();
              router.push("/readiness");
            }}
            className="active:opacity-80"
          >
            <Card elevated className="gap-md">
              <View className="flex-row items-center justify-between gap-sm">
                <Pill
                  tone={
                    coaching.mode === "push"
                      ? "positive"
                      : coaching.mode === "recover"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {coaching.mode}
                </Pill>
                <Text className="type-mono-small text-text-subtle shrink text-right">
                  TARGET STRAIN {target[0]}–{target[1]}
                </Text>
              </View>
              <Text className="type-heading text-text">
                {data.today.recovery === null || data.today.sleepScore === null
                  ? "Waiting for enough signals"
                  : coaching.title}
              </Text>
              <Text className="type-body-small text-text-muted">
                {data.today.recovery === null || data.today.sleepScore === null
                  ? "Connect or sync more health data to personalize your daily recommendation."
                  : coaching.message}
              </Text>
              <View className="flex-row items-center justify-between mt-xs">
                <Text className="type-badge text-text-subtle">
                  ESTIMATE / NOT MEDICAL ADVICE
                </Text>
                <ArrowRight color={colors.primary} size={16} />
              </View>
            </Card>
          </Pressable>
        </View>
      ) : null}

      <View className="gap-md">
        <SectionHeader
          title="Stress & energy"
          eyebrow="INTRADAY AUTONOMIC LOAD"
        />
        <Card>
          {data.stress ? (
            <>
              <View className="flex-row items-center justify-between">
                <View>
                  <MetricLabel>STRESS INDEX</MetricLabel>
                  <StatValue>
                    {data.stress.average}
                    <Text className="type-caption text-text-subtle">
                      {" "}
                      / 100
                    </Text>
                  </StatValue>
                </View>
                <Pill tone={data.stress.average > 65 ? "warning" : "positive"}>
                  {data.stress.average > 65 ? "ELEVATED" : "BALANCED"}
                </Pill>
              </View>
              <View className="mt-lg items-center">
                <Sparkline
                  values={data.stress.samples.map((sample) => sample.value)}
                  color={colors.stress}
                  width={chartWidth}
                  height={82}
                />
              </View>
              <View className="flex-row justify-between mt-xs">
                <Text className="type-mono-small text-text-subtle">
                  {data.stress.samples[0]
                    ? formatTime(data.stress.samples[0].timestamp)
                    : ""}
                </Text>
                <Text className="type-mono-small text-text-subtle">
                  {data.stress.samples[
                    Math.floor(data.stress.samples.length / 2)
                  ]
                    ? formatTime(
                        data.stress.samples[
                          Math.floor(data.stress.samples.length / 2)
                        ]!.timestamp,
                      )
                    : ""}
                </Text>
                <Text className="type-mono-small text-text-subtle">
                  {data.stress.samples.at(-1)
                    ? formatTime(data.stress.samples.at(-1)!.timestamp)
                    : ""}
                </Text>
              </View>
              <View className="flex-row justify-between mt-lg">
                <Marker
                  label="LOWEST"
                  value={data.stress.lowest}
                  tone="positive"
                />
                <Marker
                  label="AVERAGE"
                  value={data.stress.average}
                  tone="neutral"
                />
                <Marker
                  label="HIGHEST"
                  value={data.stress.highest}
                  tone="warning"
                />
              </View>
            </>
          ) : (
            <EmptyState
              title={
                data.sectionErrors.stress
                  ? "Stress unavailable"
                  : isToday
                    ? "No stress samples yet"
                    : "No stress samples that day"
              }
              detail={
                data.sectionErrors.stress
                  ? "Stress samples could not be read from the health source."
                  : isToday
                    ? "Heart-rate and HRV readings will build a timeline here."
                    : "No heart-rate or HRV readings were recorded that day."
              }
            />
          )}
          <Hairline className="my-lg" />
          <View className="flex-row items-center gap-md">
            <View className="w-[34px] h-[34px] rounded-full bg-primary-wash items-center justify-center">
              <BatteryCharging color={colors.primary} size={18} />
            </View>
            <View className="flex-1 gap-2xs">
              <Text className="type-badge text-text-muted">ENERGY BATTERY</Text>
              <Text className="type-caption text-text-subtle">
                {energyStatus(energyValue)}
              </Text>
            </View>
            {energyValue === null ? (
              <Text className="type-metric-lg text-text-subtle">--</Text>
            ) : (
              <Text className="type-metric-lg text-primary-bright tabular-nums">
                {energyValue}
                <Text className="type-caption text-text-muted">%</Text>
              </Text>
            )}
          </View>
          {energyValue !== null ? (
            <BatteryMeter value={energyValue} />
          ) : null}
        </Card>
      </View>

      <View className="gap-md">
        <SectionHeader
          title="Nutrition & glucose"
          eyebrow="METABOLIC TELEMETRY"
        />
        <Card>
          <View className="flex-row items-end justify-between">
            <View>
              <MetricLabel>ENERGY INTAKE</MetricLabel>
              <StatValue
                unit={
                  data.nutrition
                    ? formatEnergy(data.nutrition.calories).unit
                    : "kcal"
                }
                className="type-metric-xl"
              >
                {data.nutrition
                  ? formatEnergy(data.nutrition.calories).value
                  : "--"}
              </StatValue>
            </View>
            <View className="items-end gap-xs">
              <MetricLabel>{isToday ? "TODAY TOTAL" : "DAY TOTAL"}</MetricLabel>
              <Text className="type-mono-small text-text-subtle">
                {data.nutrition ? "ALL SOURCES" : "No entries"}
              </Text>
            </View>
          </View>
          {data.nutrition ? (
            <MacroBreakdown nutrition={data.nutrition} />
          ) : (
            <EmptyState
              title={
                data.sectionErrors.nutrition
                  ? "Nutrition unavailable"
                  : "No nutrition entries"
              }
              detail={
                data.sectionErrors.nutrition
                  ? "Nutrition data could not be read from the health source."
                  : "Log meals or connect a source that shares nutrition data."
              }
            />
          )}
          <Hairline className="my-lg" />
          <View className="flex-row justify-between items-center gap-md">
            <View>
              <MetricLabel>CONTINUOUS GLUCOSE</MetricLabel>
              <Text className="type-caption text-text-subtle mt-xs">
                {data.glucose
                  ? isToday
                    ? "CURRENT GLUCOSE"
                    : "LAST READING THAT DAY"
                  : "CGM SIGNAL"}
              </Text>
            </View>
            {data.glucose && data.glucose.samples.length > 0 ? (
              <GlucoseValue data={data.glucose} />
            ) : null}
          </View>
          {data.glucose && data.glucose.samples.length > 0 ? (
            <GlucoseChart data={data.glucose} width={chartWidth} />
          ) : (
            <View className="items-center py-xl gap-sm">
              <MoonStar color={colors.textSubtle} size={18} />
              <Text className="type-subheading text-text-muted">
                {data.sectionErrors.glucose
                  ? "Glucose unavailable"
                  : "No glucose readings"}
              </Text>
              <Text className="type-caption text-text-subtle text-center">
                {data.sectionErrors.glucose
                  ? "Glucose data could not be read from the health source."
                  : "Connect a compatible CGM to see your live trend."}
              </Text>
            </View>
          )}
        </Card>
      </View>

      <View className="flex-row items-center justify-center gap-sm py-sm">
        <HeartPulse color={colors.textSubtle} size={14} />
        <Text className="type-caption text-text-subtle">
          Personal estimates from on-device signals. Not medical output.
        </Text>
      </View>
    </View>
  );
}

function Marker({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "neutral" | "warning";
}) {
  const { colors } = useTheme();
  const color =
    tone === "positive"
      ? colors.primary
      : tone === "warning"
        ? colors.stress
        : colors.text;
  return (
    <View className="gap-xs">
      <Text className="type-badge text-text-subtle">{label}</Text>
      <Text className="type-mono tabular-nums" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}

function MacroBreakdown({
  nutrition,
}: {
  nutrition: NonNullable<DashboardData["nutrition"]>;
}) {
  const { colors } = useTheme();
  const proteinEnergy = nutrition.proteinGrams * 4;
  const carbohydrateEnergy = nutrition.carbohydrateGrams * 4;
  const fatEnergy = nutrition.fatGrams * 9;
  const total = Math.max(proteinEnergy + carbohydrateEnergy + fatEnergy, 1);
  const macros = [
    {
      label: "PROTEIN",
      grams: nutrition.proteinGrams,
      percentage: proteinEnergy / total,
      color: colors.protein,
      gradient: [colors.protein, colors.primary] as const,
    },
    {
      label: "CARBS",
      grams: nutrition.carbohydrateGrams,
      percentage: carbohydrateEnergy / total,
      color: colors.carbohydrate,
      gradient: [colors.carbohydrate, colors.stress] as const,
    },
    {
      label: "FAT",
      grams: nutrition.fatGrams,
      percentage: fatEnergy / total,
      color: colors.fat,
      gradient: [colors.fat, colors.sleep] as const,
    },
  ];
  return (
    <View className="gap-md mt-xl">
      {macros.map((macro) => (
        <View key={macro.label} className="gap-xs">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-sm">
              <View
                className="w-[7px] h-[7px] rounded-full"
                style={{ backgroundColor: macro.color }}
              />
              <Text className="type-badge text-text-muted">{macro.label}</Text>
            </View>
            <Text className="type-mono text-text">
              {Math.round(macro.grams)} g{" "}
              <Text className="text-text-subtle">
                {Math.round(macro.percentage * 100)}%
              </Text>
            </Text>
          </View>
          <View className="h-[5px] rounded-full overflow-hidden bg-track">
            <LinearGradient
              colors={macro.gradient}
              className="h-full rounded-full"
              style={{ width: `${Math.round(macro.percentage * 100)}%` }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function GlucoseValue({
  data,
}: {
  data: NonNullable<DashboardData["glucose"]>;
}) {
  const { colors } = useTheme();
  const last = data.samples.at(-1);
  const previous = data.samples.at(-2);
  if (!last) return null;
  const milligramsPerDeciliter =
    data.unit === "mg/dL" ? last.value : last.value * 18.018;
  const display = formatGlucose(milligramsPerDeciliter);
  const rising = previous ? last.value > previous.value : false;
  const falling = previous ? last.value < previous.value : false;
  const TrendIcon = rising
    ? ArrowUpRight
    : falling
      ? ArrowDownRight
      : ArrowRight;
  return (
    <View className="flex-row items-center gap-xs">
      <TrendIcon color={rising ? colors.stress : colors.primary} size={16} />
      <Text className="type-metric-md text-text tabular-nums">
        {display.value}
        <Text className="type-mono-small text-text-subtle">
          {" "}
          {display.unit}
        </Text>
      </Text>
    </View>
  );
}

function GlucoseChart({
  data,
  width,
}: {
  data: NonNullable<DashboardData["glucose"]>;
  width: number;
}) {
  const { colors } = useTheme();
  const points = data.samples.map((sample) =>
    convertGlucose(sample.value, data.unit),
  );
  const current = data.samples.at(-1);
  const currentMgDl = current
    ? data.unit === "mg/dL"
      ? current.value
      : current.value * 18.018
    : 100;
  const isMmol = formatGlucose(currentMgDl).unit === "mmol/L";
  const target = isMmol ? ([3.9, 10] as const) : ([70, 180] as const);
  return (
    <>
      <View className="items-center mt-md">
        <Sparkline
          values={points}
          color={colors.primary}
          width={width}
          height={76}
          targetRange={target}
        />
      </View>
      <View className="flex-row justify-between mt-sm">
        <Text className="type-mono-small text-text-subtle">
          TARGET {isMmol ? "3.9-10 mmol/L" : "70-180 mg/dL"}
        </Text>
        <Text className="type-mono-small text-text-subtle">
          {current ? formatTime(current.timestamp) : ""}
        </Text>
      </View>
    </>
  );
}

function BatteryMeter({ value }: { value: number }) {
  const { gradients } = useTheme();
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View
      accessibilityLabel={`Energy battery ${value} percent`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      className="h-1.5 rounded-full overflow-hidden bg-track mt-md"
    >
      <LinearGradient
        colors={gradients.energy}
        className="h-full rounded-full"
        style={{ width }}
      />
    </View>
  );
}

function PrimaryAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[48px] rounded-full bg-primary-bright flex-row items-center justify-center gap-sm"
    >
      <RotateCw color={colors.canvas} size={16} />
      <Text className="type-subheading text-canvas">{label}</Text>
    </Pressable>
  );
}

function DashboardSkeleton() {
  return (
    <View className="gap-md">
      <SectionHeader title="Daily readiness" eyebrow="SYNCING SIGNALS" />
      <Card>
        <View className="flex-row justify-between py-md">
          {[0, 1, 2].map((item) => (
            <SkeletonBlock
              key={item}
              className="w-[84px] h-[84px] rounded-full bg-surface-high"
            />
          ))}
        </View>
        <SkeletonBlock className="w-[70%] h-3 rounded-full bg-surface-high mt-lg self-center" />
      </Card>
      <View className="gap-md">
        <SectionHeader title="Stress & energy" />
        <Card>
          <SkeletonBlock className="w-[58%] h-[18px] rounded-full bg-surface-high" />
          <SkeletonBlock className="w-full h-[76px] rounded-md bg-surface-high mt-lg" />
          <SkeletonBlock className="w-[70%] h-3 rounded-full bg-surface-high mt-lg self-center" />
        </Card>
      </View>
      <View className="gap-md">
        <SectionHeader title="Nutrition & glucose" />
        <Card>
          <SkeletonBlock className="w-[58%] h-[18px] rounded-full bg-surface-high" />
          <SkeletonBlock className="w-full h-[76px] rounded-md bg-surface-high mt-lg" />
        </Card>
      </View>
    </View>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(withTiming(0.42, { duration: 900 }), -1, true),
  }));
  return <Animated.View className={className} style={animatedStyle} />;
}

function energyStatus(value: number | null): string {
  if (value === null) return "Waiting for sleep and stress signals";
  return value >= 70
    ? "Plenty in reserve"
    : value >= 40
      ? "Steady, pace your effort"
      : "Low reserve, prioritize recovery";
}
