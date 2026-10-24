import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  ChevronRight,
  HeartPulse,
  Link2,
  MoonStar,
  RotateCw,
  Sparkles,
} from "lucide-react-native";
import { useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { GlowRing, type RingMetric } from "@/components/charts/GlowRing";
import { Sparkline } from "@/components/charts/Sparkline";
import { HealthPermissionSheet } from "@/components/permissions/HealthPermissionSheet";
import { SettingsButton } from "@/components/settings/SettingsButton";
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
import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import { coachingEngine } from "@/services/coaching";
import type { DashboardData } from "@/services/health/dashboard";
import { useHealthStore } from "@/stores/healthStore";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import {
  convertGlucose,
  formatEnergy,
  formatGlucose,
  formatTime,
  formatToday,
} from "@/utils/formatters";

export function HomeScreen() {
  const { colors } = useTheme();
  const dimensions = useWindowDimensions();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, isError, refetch } =
    useHealthDashboard();
  const permissionState = useHealthStore((state) => state.permissionState);
  const permissionMessage = useHealthStore((state) => state.permissionMessage);
  const requestConnection = useHealthStore((state) => state.requestConnection);
  const [showPermissions, setShowPermissions] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const sourceName =
    Platform.OS === "ios"
      ? "Apple Health"
      : Platform.OS === "android"
        ? "Health Connect"
        : "your health platform";

  const connect = async () => {
    setConnecting(true);
    try {
      await requestConnection();
      await queryClient.invalidateQueries({ queryKey: ["health-dashboard"] });
    } finally {
      setConnecting(false);
    }
  };

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
        }}
      >
        <View className="flex-row items-center gap-md mb-2xl">
          <View className="w-[38px] h-[38px] rounded-md bg-surface-high items-center justify-center border border-outline-soft">
            <Activity color={colors.primary} size={17} strokeWidth={2.3} />
          </View>
          <View className="flex-1 gap-2xs">
            <Text className="type-badge text-primary uppercase">
              ALLO / DAILY SYSTEMS
            </Text>
            <Text
              className="type-heading text-text"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {formatToday()}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Connect health data"
            onPress={() => setShowPermissions(true)}
            className="w-[42px] h-[42px] rounded-full border border-outline-soft bg-surface-prose items-center justify-center active:opacity-70"
          >
            <Link2 color={colors.textMuted} size={18} />
          </Pressable>
          <SettingsButton />
        </View>

        {permissionState === "unrequested" ||
        permissionState === "denied" ||
        permissionState === "partial" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPermissions(true)}
            className="min-h-[42px] px-md mb-lg rounded-md border border-stress-border bg-stress-wash flex-row items-center gap-sm -mt-lg"
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
              detail="We couldn't load today's health data."
            />
            <PrimaryAction label="Try again" onPress={() => void refetch()} />
          </Card>
        ) : (
          <DashboardSections
            data={data}
            ringSize={ringSize}
            chartWidth={chartWidth}
          />
        )}
      </Screen>
      <HealthPermissionSheet
        visible={showPermissions}
        sourceName={sourceName}
        permissionState={permissionState}
        permissionMessage={permissionMessage}
        connecting={connecting}
        onClose={() => setShowPermissions(false)}
        onConnect={() => {
          void connect();
        }}
      />
    </>
  );
}

function DashboardSections({
  data,
  ringSize,
  chartWidth,
}: {
  data: DashboardData;
  ringSize: number;
  chartWidth: number;
}) {
  const { colors, gradients } = useTheme();
  const strainStatus =
    data.strainScore === null
      ? "NO DATA"
      : data.strainScore >= 15
        ? "HIGH"
        : data.strainScore >= 9
          ? "MODERATE"
          : "LOW";
  const recoveryStatus =
    data.recoveryScore === null
      ? "NO DATA"
      : data.recoveryScore >= 75
        ? "HIGH"
        : data.recoveryScore >= 50
          ? "MODERATE"
          : "LOW";
  const sleepStatus =
    data.sleepScore === null
      ? "NO DATA"
      : data.sleepScore >= 80
        ? "OPTIMAL"
        : data.sleepScore >= 60
          ? "FAIR"
          : "LOW";
  const rings: RingMetric[] = [
    {
      label: "STRAIN",
      value: data.strainScore,
      max: 21,
      colors: gradients.strain,
      status: strainStatus,
      glowStyle: "strain",
    },
    {
      label: "RECOVERY",
      value: data.recoveryScore,
      max: 100,
      colors: gradients.recovery,
      status: recoveryStatus,
      glowStyle: "recovery",
    },
    {
      label: "SLEEP",
      value: data.sleepScore,
      max: 100,
      colors: gradients.sleep,
      status: sleepStatus,
      glowStyle: "sleep",
    },
  ];
  const coaching = coachingEngine.recommend({
    recovery: data.recoveryScore ?? 50,
    strain: data.strainScore ?? 0,
    sleep: data.sleepScore ?? 50,
  });

  return (
    <View className="gap-2xl">
      <SectionHeader
        title="Daily readiness"
        eyebrow={
          data.source === "mock" ? "SAMPLE TELEMETRY" : "TODAY / HEALTH SIGNALS"
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
          {rings.map((metric) => (
            <GlowRing
              key={metric.label}
              metric={metric}
              size={ringSize}
              strokeWidth={8}
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

      <View className="gap-md">
        <SectionHeader
          title="AI readiness"
          eyebrow="TRAINING GUIDANCE"
          trailing={<Sparkles color={colors.primary} size={17} />}
        />
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
              TARGET STRAIN {coaching.targetStrain[0]}–
              {coaching.targetStrain[1]}
            </Text>
          </View>
          <Text className="type-heading text-text">
            {data.recoveryScore === null || data.sleepScore === null
              ? "Waiting for enough signals"
              : coaching.title}
          </Text>
          <Text className="type-body-small text-text-muted">
            {data.recoveryScore === null || data.sleepScore === null
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
      </View>

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
                  : "No stress samples yet"
              }
              detail={
                data.sectionErrors.stress
                  ? "Stress samples could not be read from the health source."
                  : "Heart-rate and HRV readings will build a timeline here."
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
                {energyStatus(data.energyBattery)}
              </Text>
            </View>
            {data.energyBattery === null ? (
              <Text className="type-metric-lg text-text-subtle">--</Text>
            ) : (
              <Text className="type-metric-lg text-primary-bright tabular-nums">
                {data.energyBattery}
                <Text className="type-caption text-text-muted">%</Text>
              </Text>
            )}
          </View>
          {data.energyBattery !== null ? (
            <BatteryMeter value={data.energyBattery} />
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
              <MetricLabel>TODAY TOTAL</MetricLabel>
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
                {data.glucose ? "CURRENT GLUCOSE" : "CGM SIGNAL"}
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
