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
  StyleSheet,
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
import { colors, gradients, radii, spacing, typography } from "@/theme/tokens";
import {
  convertGlucose,
  formatEnergy,
  formatGlucose,
  formatTime,
  formatToday,
} from "@/utils/formatters";

export function HomeScreen() {
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
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <Activity color={colors.primary} size={17} strokeWidth={2.3} />
          </View>
          <View style={styles.topBarCopy}>
            <Text style={styles.topOverline}>KINETIC / DAILY SYSTEMS</Text>
            <Text style={styles.date}>{formatToday()}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Connect health data"
            onPress={() => setShowPermissions(true)}
            style={({ pressed }) => [
              styles.connectIcon,
              pressed && styles.pressed,
            ]}
          >
            <Link2 color={colors.textMuted} size={18} />
          </Pressable>
        </View>

        {permissionState === "unrequested" ||
        permissionState === "denied" ||
        permissionState === "partial" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPermissions(true)}
            style={styles.accessBanner}
          >
            <View style={styles.bannerDot} />
            <Text style={styles.bannerText}>
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
    <View style={styles.sections}>
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
      <Card style={styles.ringCard}>
        <View style={styles.ringRow}>
          {rings.map((metric) => (
            <GlowRing
              key={metric.label}
              metric={metric}
              size={ringSize}
              strokeWidth={8}
            />
          ))}
        </View>
        <Hairline style={styles.cardDivider} />
        <View style={styles.recoveryMeta}>
          <View style={styles.metaItem}>
            <MetricLabel>RESTING HR</MetricLabel>
            <StatValue unit="bpm">
              {data.restingHeartRate === null
                ? "--"
                : Math.round(data.restingHeartRate)}
            </StatValue>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <MetricLabel>HRV</MetricLabel>
            <StatValue unit="ms">
              {data.hrv === null ? "--" : Math.round(data.hrv)}
            </StatValue>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <MetricLabel>RESP. RATE</MetricLabel>
            <StatValue unit="/min">
              {data.respiratoryRate === null
                ? "--"
                : data.respiratoryRate.toFixed(1)}
            </StatValue>
          </View>
        </View>
      </Card>

      <View style={styles.sectionBlock}>
        <SectionHeader
          title="AI readiness"
          eyebrow="TRAINING GUIDANCE"
          trailing={<Sparkles color={colors.primary} size={17} />}
        />
        <Card elevated style={styles.coachingCard}>
          <View style={styles.coachTopline}>
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
            <Text style={styles.targetRange}>
              TARGET STRAIN {coaching.targetStrain[0]}–
              {coaching.targetStrain[1]}
            </Text>
          </View>
          <Text style={styles.coachTitle}>
            {data.recoveryScore === null || data.sleepScore === null
              ? "Waiting for enough signals"
              : coaching.title}
          </Text>
          <Text style={styles.coachCopy}>
            {data.recoveryScore === null || data.sleepScore === null
              ? "Connect or sync more health data to personalize your daily recommendation."
              : coaching.message}
          </Text>
          <View style={styles.coachFoot}>
            <Text style={styles.disclaimer}>ESTIMATE / NOT MEDICAL ADVICE</Text>
            <ArrowRight color={colors.primary} size={16} />
          </View>
        </Card>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeader
          title="Stress & energy"
          eyebrow="INTRADAY AUTONOMIC LOAD"
        />
        <Card>
          {data.stress ? (
            <>
              <View style={styles.stressHeading}>
                <View>
                  <MetricLabel>STRESS INDEX</MetricLabel>
                  <StatValue>
                    {data.stress.average}
                    <Text style={styles.outOf}> / 100</Text>
                  </StatValue>
                </View>
                <Pill tone={data.stress.average > 65 ? "warning" : "positive"}>
                  {data.stress.average > 65 ? "ELEVATED" : "BALANCED"}
                </Pill>
              </View>
              <View style={styles.chartWrap}>
                <Sparkline
                  values={data.stress.samples.map((sample) => sample.value)}
                  color={colors.stress}
                  width={chartWidth}
                  height={82}
                />
              </View>
              <View style={styles.chartTimes}>
                <Text style={styles.chartTime}>
                  {data.stress.samples[0]
                    ? formatTime(data.stress.samples[0].timestamp)
                    : ""}
                </Text>
                <Text style={styles.chartTime}>
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
                <Text style={styles.chartTime}>
                  {data.stress.samples.at(-1)
                    ? formatTime(data.stress.samples.at(-1)!.timestamp)
                    : ""}
                </Text>
              </View>
              <View style={styles.markerRow}>
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
          <Hairline style={styles.cardDivider} />
          <View style={styles.energyRow}>
            <View style={styles.energyIcon}>
              <BatteryCharging color={colors.primary} size={18} />
            </View>
            <View style={styles.energyCopy}>
              <Text style={styles.energyTitle}>ENERGY BATTERY</Text>
              <Text style={styles.energyStatus}>
                {energyStatus(data.energyBattery)}
              </Text>
            </View>
            {data.energyBattery === null ? (
              <Text style={styles.noValue}>--</Text>
            ) : (
              <Text style={styles.energyValue}>
                {data.energyBattery}
                <Text style={styles.energyPercent}>%</Text>
              </Text>
            )}
          </View>
          {data.energyBattery !== null ? (
            <BatteryMeter value={data.energyBattery} />
          ) : null}
        </Card>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeader
          title="Nutrition & glucose"
          eyebrow="METABOLIC TELEMETRY"
        />
        <Card>
          <View style={styles.nutritionTop}>
            <View>
              <MetricLabel>ENERGY INTAKE</MetricLabel>
              <StatValue
                unit={
                  data.nutrition
                    ? formatEnergy(data.nutrition.calories).unit
                    : "kcal"
                }
                style={styles.calorieValue}
              >
                {data.nutrition
                  ? formatEnergy(data.nutrition.calories).value
                  : "--"}
              </StatValue>
            </View>
            <View style={styles.nutritionCaption}>
              <MetricLabel>TODAY TOTAL</MetricLabel>
              <Text style={styles.nutritionCount}>
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
          <Hairline style={styles.cardDivider} />
          <View style={styles.glucoseHead}>
            <View>
              <MetricLabel>CONTINUOUS GLUCOSE</MetricLabel>
              <Text style={styles.glucoseTitle}>
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
            <View style={styles.cgmEmpty}>
              <MoonStar color={colors.textSubtle} size={18} />
              <Text style={styles.cgmEmptyTitle}>
                {data.sectionErrors.glucose
                  ? "Glucose unavailable"
                  : "No glucose readings"}
              </Text>
              <Text style={styles.cgmEmptyCopy}>
                {data.sectionErrors.glucose
                  ? "Glucose data could not be read from the health source."
                  : "Connect a compatible CGM to see your live trend."}
              </Text>
            </View>
          )}
        </Card>
      </View>

      <View style={styles.footerNote}>
        <HeartPulse color={colors.textSubtle} size={14} />
        <Text style={styles.footerText}>
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
  const color =
    tone === "positive"
      ? colors.primary
      : tone === "warning"
        ? colors.stress
        : colors.text;
  return (
    <View style={styles.marker}>
      <Text style={styles.markerLabel}>{label}</Text>
      <Text style={[styles.markerValue, { color }]}>{value}</Text>
    </View>
  );
}

function MacroBreakdown({
  nutrition,
}: {
  nutrition: NonNullable<DashboardData["nutrition"]>;
}) {
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
    <View style={styles.macroList}>
      {macros.map((macro) => (
        <View key={macro.label} style={styles.macroRow}>
          <View style={styles.macroTop}>
            <View style={styles.macroName}>
              <View
                style={[styles.macroDot, { backgroundColor: macro.color }]}
              />
              <Text style={styles.macroLabel}>{macro.label}</Text>
            </View>
            <Text style={styles.macroAmount}>
              {Math.round(macro.grams)} g{" "}
              <Text style={styles.macroPercent}>
                {Math.round(macro.percentage * 100)}%
              </Text>
            </Text>
          </View>
          <View style={styles.macroTrack}>
            <LinearGradient
              colors={macro.gradient}
              style={[
                styles.macroFill,
                { width: `${Math.round(macro.percentage * 100)}%` },
              ]}
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
    <View style={styles.glucoseValue}>
      <TrendIcon color={rising ? colors.stress : colors.primary} size={16} />
      <Text style={styles.glucoseNumber}>
        {display.value}
        <Text style={styles.glucoseUnit}> {display.unit}</Text>
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
      <View style={styles.glucoseChart}>
        <Sparkline
          values={points}
          color={colors.primary}
          width={width}
          height={76}
          targetRange={target}
        />
      </View>
      <View style={styles.glucoseFoot}>
        <Text style={styles.chartTime}>
          TARGET {isMmol ? "3.9-10 mmol/L" : "70-180 mg/dL"}
        </Text>
        <Text style={styles.chartTime}>
          {current ? formatTime(current.timestamp) : ""}
        </Text>
      </View>
    </>
  );
}

function BatteryMeter({ value }: { value: number }) {
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View
      accessibilityLabel={`Energy battery ${value} percent`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={styles.batteryTrack}
    >
      <LinearGradient
        colors={gradients.energy}
        style={[styles.batteryFill, { width }]}
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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.retryButton}
    >
      <RotateCw color={colors.canvas} size={16} />
      <Text style={styles.retryText}>{label}</Text>
    </Pressable>
  );
}

function DashboardSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <SectionHeader title="Daily readiness" eyebrow="SYNCING SIGNALS" />
      <Card>
        <View style={styles.skeletonRingRow}>
          {[0, 1, 2].map((item) => (
            <SkeletonBlock key={item} style={styles.skeletonRing} />
          ))}
        </View>
        <SkeletonBlock style={styles.skeletonLine} />
      </Card>
      <View style={styles.sectionBlock}>
        <SectionHeader title="Stress & energy" />
        <Card>
          <SkeletonBlock style={styles.skeletonLineWide} />
          <SkeletonBlock style={styles.skeletonChart} />
          <SkeletonBlock style={styles.skeletonLine} />
        </Card>
      </View>
      <View style={styles.sectionBlock}>
        <SectionHeader title="Nutrition & glucose" />
        <Card>
          <SkeletonBlock style={styles.skeletonLineWide} />
          <SkeletonBlock style={styles.skeletonChart} />
        </Card>
      </View>
    </View>
  );
}

function SkeletonBlock({ style }: { style: object }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(withTiming(0.42, { duration: 900 }), -1, true),
  }));
  return <Animated.View style={[style, animatedStyle]} />;
}

function energyStatus(value: number | null): string {
  if (value === null) return "Waiting for sleep and stress signals";
  return value >= 70
    ? "Plenty in reserve"
    : value >= 40
      ? "Steady, pace your effort"
      : "Low reserve, prioritize recovery";
}

const styles = StyleSheet.create({
  sections: { gap: spacing["2xl"] },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing["2xl"],
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outlineSoft,
  },
  topBarCopy: { flex: 1, gap: spacing["2xs"] },
  topOverline: {
    ...typography.badge,
    color: colors.primary,
    textTransform: "uppercase",
  },
  date: { ...typography.heading, color: colors.text },
  connectIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineSoft,
    backgroundColor: colors.surfaceProse,
    alignItems: "center",
    justifyContent: "center",
  },
  accessBanner: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    marginTop: -spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stressBorder,
    backgroundColor: colors.stressWash,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.stress,
  },
  bannerText: { ...typography.caption, color: colors.text, flex: 1 },
  ringCard: { paddingHorizontal: spacing.md, paddingVertical: spacing.xl },
  ringRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  cardDivider: { marginVertical: spacing.lg },
  recoveryMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaItem: { flex: 1, alignItems: "center", gap: spacing.xs },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: colors.outlineSoft,
  },
  sectionBlock: { gap: spacing.md },
  coachingCard: { gap: spacing.md },
  coachTopline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  targetRange: {
    ...typography.monoSmall,
    color: colors.textSubtle,
    flexShrink: 1,
    textAlign: "right",
  },
  coachTitle: { ...typography.heading, color: colors.text },
  coachCopy: { ...typography.bodySmall, color: colors.textMuted },
  coachFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  disclaimer: { ...typography.badge, color: colors.textSubtle },
  stressHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  outOf: { ...typography.caption, color: colors.textSubtle },
  chartWrap: { marginTop: spacing.lg, alignItems: "center" },
  chartTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  chartTime: { ...typography.monoSmall, color: colors.textSubtle },
  markerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  marker: { gap: spacing.xs },
  markerLabel: { ...typography.badge, color: colors.textSubtle },
  markerValue: { ...typography.mono, fontVariant: ["tabular-nums"] },
  energyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  energyIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primaryWash,
    alignItems: "center",
    justifyContent: "center",
  },
  energyCopy: { flex: 1, gap: spacing["2xs"] },
  energyTitle: { ...typography.badge, color: colors.textMuted },
  energyStatus: { ...typography.caption, color: colors.textSubtle },
  energyValue: {
    ...typography.metricLG,
    color: colors.primaryBright,
    fontVariant: ["tabular-nums"],
  },
  energyPercent: { ...typography.caption, color: colors.textMuted },
  noValue: { ...typography.metricLG, color: colors.textSubtle },
  batteryTrack: {
    height: 6,
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: colors.track,
    marginTop: spacing.md,
  },
  batteryFill: { height: "100%", borderRadius: radii.full },
  nutritionTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  calorieValue: { ...typography.metricXL },
  nutritionCaption: { alignItems: "flex-end", gap: spacing.xs },
  nutritionCount: { ...typography.monoSmall, color: colors.textSubtle },
  macroList: { gap: spacing.md, marginTop: spacing.xl },
  macroRow: { gap: spacing.xs },
  macroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  macroName: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  macroDot: { width: 7, height: 7, borderRadius: radii.full },
  macroLabel: { ...typography.badge, color: colors.textMuted },
  macroAmount: { ...typography.mono, color: colors.text },
  macroPercent: { color: colors.textSubtle },
  macroTrack: {
    height: 5,
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: colors.track,
  },
  macroFill: { height: "100%", borderRadius: radii.full },
  glucoseHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  glucoseTitle: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.xs,
  },
  glucoseValue: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  glucoseNumber: {
    ...typography.metricMD,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  glucoseUnit: { ...typography.monoSmall, color: colors.textSubtle },
  glucoseChart: { alignItems: "center", marginTop: spacing.md },
  glucoseFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  cgmEmpty: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  cgmEmptyTitle: { ...typography.subheading, color: colors.textMuted },
  cgmEmptyCopy: {
    ...typography.caption,
    color: colors.textSubtle,
    textAlign: "center",
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  footerText: { ...typography.caption, color: colors.textSubtle },
  pressed: { opacity: 0.7 },
  retryButton: {
    minHeight: 48,
    borderRadius: radii.full,
    backgroundColor: colors.primaryBright,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  retryText: { ...typography.subheading, color: colors.canvas },
  skeletonContainer: { gap: spacing.md },
  skeletonRingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  skeletonRing: {
    width: 84,
    height: 84,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
  },
  skeletonLine: {
    width: "70%",
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
    marginTop: spacing.lg,
    alignSelf: "center",
  },
  skeletonLineWide: {
    width: "58%",
    height: 18,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
  },
  skeletonChart: {
    width: "100%",
    height: 76,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    marginTop: spacing.lg,
  },
});
