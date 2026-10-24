import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  RotateCw,
} from "lucide-react-native";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AgeDial } from "@/components/charts/AgeDial";
import { Sparkline } from "@/components/charts/Sparkline";
import { ProfileCard } from "@/components/biomarkers/ProfileCard";
import {
  biomarkerMeta,
  chartValues,
  displayValue,
  toneColor,
} from "@/components/biomarkers/meta";
import { SettingsButton } from "@/components/settings/SettingsButton";
import { Card, EmptyState, Pill, Screen } from "@/components/ui/primitives";
import { useBiomarkers } from "@/hooks/useBiomarkers";
import {
  biomarkerKinds,
  type Biomarker,
  type BiomarkersData,
  type FitnessAge,
} from "@/services/health/biomarkers";
import type { BiomarkerKind } from "@/services/health/types";
import { makeStyles, useTheme } from "@/theme/ThemeProvider";
import { formatDay, formatNumber } from "@/utils/formatters";
import { bucketAverages, dayKey } from "@/services/metrics";

const SPARK_DAYS = 90;

export function openBiomarker(kind: BiomarkerKind) {
  void Haptics.selectionAsync();
  router.push({ pathname: "/biomarkers/[kind]", params: { kind } });
}

export function BiomarkersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { data, isLoading, isFetching, isError, refetch } = useBiomarkers();

  return (
    <Screen
      refreshing={isFetching && !isLoading}
      onRefresh={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void refetch();
      }}
    >
      <View style={styles.topBar}>
        <CalendarDays color={colors.primary} size={20} />
        <Text style={styles.date}>{formatTodayShort()}</Text>
        {data ? (
          data.source === "mock" ? (
            <Pill>SAMPLE</Pill>
          ) : (
            <View style={styles.syncPill}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>Synced</Text>
            </View>
          )
        ) : null}
        <SettingsButton />
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Biomarkers</Text>
        <Text style={styles.subtitle}>Last 12 months</Text>
      </View>

      {isLoading || !data ? (
        isError ? (
          <Card>
            <EmptyState
              title="Biomarkers unavailable"
              detail="We couldn't read from your health source. Check that access is allowed, then try again."
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
        ) : null
      ) : (
        <BiomarkerSections data={data} />
      )}
    </Screen>
  );
}

function BiomarkerSections({ data }: { data: BiomarkersData }) {
  const styles = useStyles();
  const available = biomarkerKinds
    .map((kind) => data.biomarkers[kind])
    .filter((biomarker) => biomarker.latest);
  const needsProfile = !data.profile.birthDate || !data.profile.sex;

  return (
    <View style={styles.sections}>
      {data.fitnessAge ? (
        <FitnessAgeCard fitnessAge={data.fitnessAge} />
      ) : (
        <Card>
          <EmptyState
            title="Fitness Age"
            detail={
              data.biomarkers.vo2Max.latest
                ? "Add your sex below to estimate your Fitness Age from VO₂ max."
                : "Fitness Age needs a VO₂ max reading. Many watches estimate it from outdoor walks and runs."
            }
          />
        </Card>
      )}

      {needsProfile ? <ProfileCard profile={data.profile} /> : null}

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Other biomarkers</Text>
        {available.length ? (
          available.map((biomarker) => (
            <BiomarkerRow key={biomarker.kind} biomarker={biomarker} />
          ))
        ) : (
          <Card>
            <EmptyState
              title="No readings yet"
              detail="Weight, body composition, HRV, resting heart rate, VO₂ max, blood oxygen and respiratory rate will appear here once your health app has them."
            />
          </Card>
        )}
      </View>
    </View>
  );
}

function FitnessAgeCard({ fitnessAge }: { fitnessAge: FitnessAge }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const dialSize = Math.min(width - 64, 300);
  const reference = fitnessAge.chronologicalAge;
  const centre = reference ?? fitnessAge.value;
  const min = Math.floor(Math.min(centre, fitnessAge.value) - 8);
  const max = Math.ceil(Math.max(centre, fitnessAge.value) + 8);
  const gap = reference === null ? null : fitnessAge.value - reference;
  const younger = gap !== null && gap <= 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Fitness Age ${formatNumber(fitnessAge.value, 1)} years. Opens VO2 max details.`}
      onPress={() => openBiomarker("vo2Max")}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.heroCard}>
        <View style={styles.heroHeading}>
          <Text style={styles.heroLabel}>FITNESS AGE</Text>
          <ChevronRight color={colors.textSubtle} size={16} />
        </View>
        <View>
          <AgeDial
            value={fitnessAge.value}
            reference={reference}
            min={min}
            max={max}
            size={dialSize}
            color={younger || gap === null ? colors.primary : colors.stress}
          />
          <View style={styles.dialCentre} pointerEvents="none">
            <Text style={styles.heroValue}>
              {formatNumber(fitnessAge.value, 1)}
            </Text>
            <Text style={styles.heroUnit}>years</Text>
            {gap !== null ? (
              <View style={[styles.gapPill, !younger && styles.gapPillOlder]}>
                <Text style={[styles.gapText, !younger && styles.gapTextOlder]}>
                  {Math.abs(gap) < 0.5
                    ? "Matches your age"
                    : `${formatNumber(Math.abs(gap), 1)} yrs ${younger ? "younger" : "older"}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.heroStats}>
          <HeroStat
            label="Chronological"
            value={reference === null ? "—" : `${reference}`}
          />
          <HeroStat
            label="VO₂ max"
            value={formatNumber(fitnessAge.vo2Max, 1)}
          />
          <HeroStat
            label="For your age"
            value={
              fitnessAge.percentile === null
                ? "—"
                : fitnessAge.percentile >= 50
                  ? `Top ${Math.max(1, Math.round(100 - fitnessAge.percentile))}%`
                  : `Bottom ${Math.max(1, Math.round(fitnessAge.percentile))}%`
            }
          />
        </View>
        <Text style={styles.heroFootnote}>
          From VO₂ max on {formatDay(dayKey(new Date(fitnessAge.measuredAt)))}
        </Text>
      </Card>
    </Pressable>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function BiomarkerRow({ biomarker }: { biomarker: Biomarker }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meta = biomarkerMeta[biomarker.kind];
  const latest = biomarker.latest!;
  const { value, unit } = displayValue(biomarker.kind, latest);
  const cutoff = new Date(latest.timestamp).getTime() - SPARK_DAYS * 86_400_000;
  const recent = biomarker.history.filter(
    (sample) => new Date(sample.timestamp).getTime() >= cutoff,
  );
  const status = biomarker.status;
  const statusColor = status
    ? toneColor(status.tone, colors)
    : colors.textMuted;
  const TrendIcon =
    status?.basis === "trend"
      ? biomarker.trend?.direction === "increasing"
        ? ArrowUp
        : biomarker.trend?.direction === "decreasing"
          ? ArrowDown
          : ArrowRight
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}: ${status ? `${status.label}, ` : ""}${value} ${unit}`}
      onPress={() => openBiomarker(biomarker.kind)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.rowCard}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{meta.title}</Text>
          <View style={styles.rowStatus}>
            {status ? (
              <>
                {TrendIcon ? <TrendIcon color={statusColor} size={13} /> : null}
                <Text style={[styles.rowStatusText, { color: statusColor }]}>
                  {status.label}
                </Text>
                <Text style={styles.rowDot}>•</Text>
              </>
            ) : null}
            <Text style={styles.rowValue}>
              {value} <Text style={styles.rowUnit}>{unit}</Text>
            </Text>
          </View>
        </View>
        {recent.length > 1 ? (
          <View style={styles.rowSpark}>
            <Sparkline
              values={chartValues(biomarker.kind, bucketAverages(recent, 7))}
              color={colors[meta.accent]}
              width={96}
              height={44}
              fill={false}
              accessibilityLabel={`${meta.title} over the last ${SPARK_DAYS} days`}
            />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function formatTodayShort() {
  return `Today, ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}

const useStyles = makeStyles(({ colors, radii, spacing, typography }) =>
  StyleSheet.create({
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
    sectionTitle: { ...typography.subheading, color: colors.text },
    pressed: { opacity: 0.75 },
    heroCard: { paddingBottom: spacing.md },
    heroHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroLabel: { ...typography.badge, fontSize: 11, color: colors.text },
    dialCentre: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: spacing.lg,
    },
    heroValue: {
      ...typography.display,
      fontSize: 48,
      lineHeight: 54,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    heroUnit: { ...typography.caption, color: colors.textMuted },
    gapPill: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryWash,
    },
    gapPillOlder: {
      borderColor: colors.stressBorder,
      backgroundColor: colors.stressWash,
    },
    gapText: { ...typography.caption, color: colors.primary },
    gapTextOlder: { color: colors.stress },
    heroStats: {
      flexDirection: "row",
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineSoft,
    },
    heroStat: { flex: 1, alignItems: "center", gap: spacing["2xs"] },
    heroStatLabel: { ...typography.caption, color: colors.textSubtle },
    heroStatValue: {
      ...typography.subheading,
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    heroFootnote: {
      ...typography.monoSmall,
      color: colors.textSubtle,
      textAlign: "center",
      marginTop: spacing.md,
    },
    rowCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowCopy: { flex: 1, gap: spacing.xs },
    rowTitle: { ...typography.subheading, color: colors.text },
    rowStatus: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    rowStatusText: { ...typography.caption },
    rowDot: { ...typography.caption, color: colors.textSubtle },
    rowValue: {
      ...typography.mono,
      fontSize: 13,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    rowUnit: { color: colors.textSubtle },
    rowSpark: { width: 96 },
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
  }),
);
