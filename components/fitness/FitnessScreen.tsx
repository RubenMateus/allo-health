import * as Haptics from "expo-haptics";
import {
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChartColumn,
  Dumbbell,
  Gauge,
  HeartPulse,
  Layers,
  RotateCw,
  Activity,
} from "lucide-react-native";
import type { ReactNode } from "react";
import {
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

import { CumulativeChart } from "@/components/charts/CumulativeChart";
import { RadarChart } from "@/components/charts/RadarChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { ActivityCalendar } from "@/components/fitness/ActivityCalendar";
import {
  Card,
  EmptyState,
  Hairline,
  Pill,
  Screen,
} from "@/components/ui/primitives";
import { useFitnessDashboard } from "@/hooks/useFitnessDashboard";
import type { FitnessData } from "@/services/health/fitness";
import {
  heartRateRecoveryRating,
  muscleGroups,
  type AcuteChronicSummary,
} from "@/services/metrics";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { formatDay, formatDuration, formatMass } from "@/utils/formatters";

export function FitnessScreen() {
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
      <View style={styles.topBar}>
        <CalendarDays color={colors.primary} size={20} />
        <Text style={styles.date}>{formatTodayShort()}</Text>
        {data ? <SourcePill source={data.source} /> : null}
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Fitness</Text>
        <Text style={styles.subtitle}>Last 30 days</Text>
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
            style={styles.retryButton}
          >
            <RotateCw color={colors.canvas} size={16} />
            <Text style={styles.retryText}>Try again</Text>
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
  const delta =
    data.activity.previousMinutes === null
      ? null
      : data.activity.totalMinutes - data.activity.previousMinutes;
  const sparkWidth = Math.min(160, Math.max(110, contentWidth * 0.46));

  return (
    <View style={styles.sections}>
      <Card>
        <CardHeading
          icon={<ChartColumn color={colors.text} size={15} />}
          label="ACTIVITY SUMMARY"
          trailing={
            delta === null ? null : (
              <View style={[styles.deltaPill, delta < 0 && styles.deltaDown]}>
                {delta >= 0 ? (
                  <ArrowUpRight color={colors.primary} size={13} />
                ) : (
                  <ArrowDownRight color={colors.stress} size={13} />
                )}
                <Text
                  style={[styles.deltaText, delta < 0 && styles.deltaTextDown]}
                >
                  {formatDuration(Math.abs(delta))}
                </Text>
              </View>
            )
          }
        />
        <Text style={styles.heroValue}>
          {formatDuration(data.activity.totalMinutes)}
        </Text>
        <Text style={styles.range}>
          {formatDay(data.rangeStart)} – {formatDay(data.rangeEnd)}
        </Text>
        {data.workoutCount ? (
          <>
            <View style={styles.cumulativeChart}>
              <CumulativeChart
                minutes={data.activity.cumulativeMinutes}
                width={contentWidth}
                accessibilityLabel={`${formatDuration(data.activity.totalMinutes)} of activity over the last 30 days`}
              />
            </View>
            <View style={styles.axisRow}>
              <Text style={styles.axisText}>{formatDay(data.rangeStart)}</Text>
              <Text style={styles.axisText}>
                {formatDay(data.days[Math.floor(data.days.length / 2)]!.date)}
              </Text>
              <Text style={styles.axisText}>{formatDay(data.rangeEnd)}</Text>
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

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cardio</Text>
          <Text style={styles.sectionCaption}>Integrated Telemetry</Text>
        </View>
        <Card style={styles.flushCard}>
          <View style={styles.metricBlock}>
            <CardHeading
              icon={<HeartPulse color={colors.text} size={15} />}
              label="CARDIO LOAD"
            />
            <View style={styles.metricRow}>
              <View style={styles.metricCopy}>
                <View style={styles.inlineValue}>
                  <Text style={styles.metricValue}>
                    {data.cardioLoad.ratio?.toFixed(2) ?? "--"}
                  </Text>
                  <Text
                    style={[
                      styles.statusText,
                      { color: loadColor(data.cardioLoad.status) },
                    ]}
                  >
                    {data.cardioLoad.status}
                  </Text>
                </View>
                <Text style={styles.metricCaption}>Acute : Chronic (ACWR)</Text>
              </View>
              {data.cardioLoad.trend.length > 1 ? (
                <View style={{ width: sparkWidth }}>
                  <Sparkline
                    values={data.cardioLoad.trend}
                    color={colors.fat}
                    targetColor={colors.sleep}
                    targetRange={[0.8, 1.3]}
                    width={sparkWidth}
                    height={64}
                    fill={false}
                    accessibilityLabel="Acute to chronic workload ratio over the last two weeks"
                  />
                </View>
              ) : null}
            </View>
          </View>
          <Hairline />
          <View style={styles.metricBlock}>
            <CardHeading
              icon={<Activity color={colors.primary} size={15} />}
              label="STRAIN PERFORMANCE"
            />
            <View style={styles.metricRow}>
              <View style={styles.metricCopy}>
                <Text
                  style={[
                    styles.metricValue,
                    {
                      color:
                        data.loadChange !== null && data.loadChange < 0
                          ? colors.stress
                          : colors.primary,
                    },
                  ]}
                >
                  {data.loadChange === null
                    ? "--"
                    : `${data.loadChange > 0 ? "+" : ""}${data.loadChange}%`}
                </Text>
                <Text style={styles.zoneText}>
                  {zoneLabel(data.cardioLoad.status)}
                </Text>
              </View>
              {data.workoutCount ? (
                <View style={{ width: sparkWidth }}>
                  <Sparkline
                    values={data.dailyLoads}
                    color={colors.primary}
                    width={sparkWidth}
                    height={64}
                    accessibilityLabel="Daily training load over the last 30 days"
                  />
                </View>
              ) : null}
            </View>
          </View>
          <Hairline />
          <View style={styles.splitRow}>
            <View style={styles.splitCell}>
              <CardHeading
                icon={<Layers color={colors.text} size={15} />}
                label="CARDIO FOCUS"
              />
              {data.cardioFocus ? (
                <View style={styles.focusList}>
                  <FocusBar
                    label="Aerobic Base"
                    value={data.cardioFocus.aerobic}
                    color={colors.primary}
                  />
                  <FocusBar
                    label="Threshold"
                    value={data.cardioFocus.threshold}
                    color={colors.fat}
                  />
                  <FocusBar
                    label="Anaerobic"
                    value={data.cardioFocus.anaerobic}
                    color={colors.salmon}
                  />
                </View>
              ) : (
                <Text style={styles.cellEmpty}>
                  Needs cardio workouts with heart rate.
                </Text>
              )}
            </View>
            <View style={styles.splitDivider} />
            <HeartRateRecoveryCell
              values={data.heartRateRecovery}
              width={contentWidth / 2 - spacing.lg}
            />
          </View>
        </Card>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Strength & Muscular Strain</Text>
        </View>
        <Card style={styles.flushCard}>
          {data.strength ? (
            <>
              <View style={styles.radarWrap}>
                <RadarChart
                  size={Math.min(contentWidth, 320)}
                  accessibilityLabel={`Strength volume by muscle group, ${formatMass(data.strength.totalKg).value} ${formatMass(data.strength.totalKg).unit} total`}
                  axes={muscleGroups.map((group) => {
                    const mass = formatMass(data.strength!.byGroup[group]);
                    return {
                      label: group,
                      value: data.strength!.byGroup[group],
                      display: `${mass.value} ${mass.unit}`,
                    };
                  })}
                />
              </View>
              <Hairline />
              <View style={styles.volumeRow}>
                <View style={styles.volumeIcon}>
                  <Dumbbell color={colors.primary} size={18} />
                </View>
                <View style={styles.volumeCopy}>
                  <Text style={styles.volumeLabel}>TOTAL VOLUME</Text>
                  <Text style={styles.volumeCaption}>Muscular Load</Text>
                </View>
                <Text style={styles.volumeValue}>
                  {formatMass(data.strength.totalKg).value}
                  <Text style={styles.volumeUnit}>
                    {" "}
                    {formatMass(data.strength.totalKg).unit}
                  </Text>
                </Text>
              </View>
            </>
          ) : (
            <EmptyState
              title="No strength volume"
              detail="Apple Health and Health Connect don't share sets and weights yet, so lifting volume per muscle group isn't available from this source."
            />
          )}
        </Card>
      </View>

      <View style={styles.footerNote}>
        <Gauge color={colors.textSubtle} size={14} />
        <Text style={styles.footerText}>
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
    <View style={styles.cardHeading}>
      {icon}
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.cardTrailing}>
        {trailing}
        <ArrowRight color={colors.textSubtle} size={15} />
      </View>
    </View>
  );
}

function FocusBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View
      style={styles.focusRow}
      accessible
      accessibilityLabel={`${label} ${value} percent`}
    >
      <View style={styles.focusTop}>
        <Text style={styles.focusLabel}>{label}</Text>
        <Text style={[styles.focusValue, { color }]}>{value}%</Text>
      </View>
      <View style={styles.focusTrack}>
        <View
          style={[
            styles.focusFill,
            { width: `${value}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

function HeartRateRecoveryCell({
  values,
  width,
}: {
  values: number[];
  width: number;
}) {
  const latest = values.at(-1);
  return (
    <View style={styles.splitCell}>
      <CardHeading
        icon={<HeartPulse color={colors.salmon} size={15} />}
        label="HRR"
      />
      {latest === undefined ? (
        <Text style={styles.cellEmpty}>
          Needs heart rate right after a workout.
        </Text>
      ) : (
        <>
          <Text style={styles.hrrValue}>{latest} bpm</Text>
          <Text style={styles.hrrRating}>
            {heartRateRecoveryRating(latest)}
            <Text style={styles.hrrWindow}> (1 min)</Text>
          </Text>
          {values.length > 1 ? (
            <View style={styles.hrrChart}>
              <Sparkline
                values={values}
                color={colors.salmon}
                width={width}
                height={40}
                step
                fill={false}
                accessibilityLabel="One-minute heart rate recovery for recent workouts"
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function SourcePill({ source }: { source: FitnessData["source"] }) {
  return source === "mock" ? (
    <Pill>SAMPLE</Pill>
  ) : (
    <View style={styles.syncPill}>
      <View style={styles.syncDot} />
      <Text style={styles.syncText}>Synced</Text>
    </View>
  );
}

function FitnessSkeleton() {
  return (
    <View style={styles.sections}>
      <Card>
        <SkeletonBlock style={styles.skeletonLine} />
        <SkeletonBlock style={styles.skeletonHero} />
        <SkeletonBlock style={styles.skeletonChart} />
      </Card>
      <Card>
        <SkeletonBlock style={styles.skeletonChart} />
      </Card>
    </View>
  );
}

function SkeletonBlock({ style }: { style: object }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(withTiming(0.42, { duration: 900 }), -1, true),
  }));
  return <Animated.View style={[style, animatedStyle]} />;
}

function formatTodayShort() {
  return `Today, ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}

function loadColor(status: AcuteChronicSummary["status"]) {
  return status === "OPTIMAL"
    ? colors.primary
    : status === "HIGH"
      ? colors.stress
      : status === "SPIKE"
        ? colors.strainEnd
        : colors.textSubtle;
}

function zoneLabel(status: AcuteChronicSummary["status"]) {
  return status === "OPTIMAL"
    ? "Optimal Target Zone"
    : status === "LOW"
      ? "Below Target Zone"
      : status === "NO DATA"
        ? "Not enough training history"
        : "Above Target Zone";
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineSoft,
  },
  date: { ...typography.subheading, color: colors.text, flex: 1 },
  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineSoft,
    backgroundColor: colors.surface,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  syncText: { ...typography.caption, color: colors.text },
  titleRow: { gap: spacing["2xs"], marginBottom: spacing["2xl"] },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
  sections: { gap: spacing["2xl"] },
  sectionBlock: { gap: spacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionTitle: { ...typography.subheading, color: colors.text },
  sectionCaption: { ...typography.mono, color: colors.textSubtle },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardLabel: {
    ...typography.badge,
    fontSize: 11,
    color: colors.text,
    flexShrink: 1,
  },
  cardTrailing: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  deltaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing["2xs"],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["2xs"],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryWash,
  },
  deltaDown: {
    borderColor: colors.stressBorder,
    backgroundColor: colors.stressWash,
  },
  deltaText: { ...typography.caption, color: colors.primary },
  deltaTextDown: { color: colors.stress },
  heroValue: {
    ...typography.display,
    color: colors.text,
    fontVariant: ["tabular-nums"],
    marginTop: spacing.lg,
  },
  range: { ...typography.mono, color: colors.textMuted, marginTop: spacing.xs },
  cumulativeChart: { marginTop: spacing.xl },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingRight: 34,
  },
  axisText: { ...typography.monoSmall, color: colors.textSubtle },
  flushCard: { padding: 0, overflow: "hidden" },
  metricBlock: { padding: spacing.lg, gap: spacing.md },
  metricRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  metricCopy: { flex: 1, gap: spacing.sm },
  inlineValue: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  metricValue: {
    ...typography.metricXL,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  statusText: { ...typography.badge, fontSize: 11 },
  metricCaption: { ...typography.mono, color: colors.textMuted },
  zoneText: { ...typography.caption, color: colors.primary },
  splitRow: { flexDirection: "row" },
  splitCell: { flex: 1, padding: spacing.lg, gap: spacing.md },
  splitDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineSoft,
  },
  cellEmpty: { ...typography.caption, color: colors.textSubtle },
  focusList: { gap: spacing.md, marginTop: spacing.sm },
  focusRow: { gap: spacing.xs },
  focusTop: { flexDirection: "row", justifyContent: "space-between" },
  focusLabel: { ...typography.caption, color: colors.text },
  focusValue: { ...typography.mono, fontVariant: ["tabular-nums"] },
  focusTrack: {
    height: 5,
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: colors.track,
  },
  focusFill: { height: "100%", borderRadius: radii.full },
  hrrValue: {
    ...typography.metricLG,
    color: colors.text,
    fontVariant: ["tabular-nums"],
    marginTop: spacing.sm,
  },
  hrrRating: { ...typography.caption, color: colors.primary, marginTop: -6 },
  hrrWindow: { ...typography.mono, color: colors.textSubtle },
  hrrChart: { marginTop: spacing.sm },
  radarWrap: { alignItems: "center", paddingVertical: spacing.lg },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surfaceElevatedProse,
  },
  volumeIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHigh,
  },
  volumeCopy: { flex: 1, gap: spacing["2xs"] },
  volumeLabel: { ...typography.badge, color: colors.text },
  volumeCaption: { ...typography.caption, color: colors.textMuted },
  volumeValue: {
    ...typography.metricXL,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  volumeUnit: { ...typography.mono, color: colors.textMuted },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  footerText: { ...typography.caption, color: colors.textSubtle },
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
  skeletonLine: {
    width: "40%",
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
  },
  skeletonHero: {
    width: "55%",
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    marginTop: spacing.lg,
  },
  skeletonChart: {
    width: "100%",
    height: 120,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    marginTop: spacing.lg,
  },
});
