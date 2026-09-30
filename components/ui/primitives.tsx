import type { PropsWithChildren, ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, typography } from "@/theme/tokens";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: RefreshControlProps["onRefresh"];
}>;

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
}: ScreenProps) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  elevated = false,
}: PropsWithChildren<{ style?: ViewStyle; elevated?: boolean }>) {
  return (
    <View style={[styles.card, elevated && styles.cardElevated, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  eyebrow,
  trailing,
}: {
  title: string;
  eyebrow?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeading}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {trailing}
    </View>
  );
}

export function MetricLabel({
  children,
  style,
}: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text style={[styles.metricLabel, style]}>{children}</Text>;
}

export function StatValue({
  children,
  unit,
  style,
}: PropsWithChildren<{ unit?: string; style?: TextStyle }>) {
  return (
    <View style={styles.statValueRow}>
      <Text style={[styles.statValue, style]}>{children}</Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
    </View>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: PropsWithChildren<{
  tone?: "neutral" | "positive" | "warning" | "violet";
}>) {
  const toneStyle =
    tone === "positive"
      ? styles.pillPositive
      : tone === "warning"
        ? styles.pillWarning
        : tone === "violet"
          ? styles.pillViolet
          : null;
  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={[styles.pillText, toneStyle && { color: toneStyle.color }]}>
        {children}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
}

export function Hairline({ style }: { style?: ViewStyle }) {
  return <View style={[styles.hairline, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: {
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.md,
    paddingBottom: spacing.navClearance,
  },
  card: {
    backgroundColor: colors.surfaceProse,
    borderColor: colors.outlineSoft,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  cardElevated: { backgroundColor: colors.surfaceElevatedProse },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionHeading: { gap: spacing["2xs"] },
  eyebrow: {
    ...typography.badge,
    color: colors.textSubtle,
    textTransform: "uppercase",
  },
  sectionTitle: { ...typography.heading, color: colors.text },
  metricLabel: { ...typography.caption, color: colors.textMuted },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  statValue: {
    ...typography.metricLG,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  statUnit: { ...typography.mono, color: colors.textSubtle },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineSoft,
    backgroundColor: colors.surface,
  },
  pillText: {
    ...typography.badge,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  pillPositive: {
    color: colors.primary,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryWash,
  },
  pillWarning: {
    color: colors.stress,
    borderColor: colors.stressBorder,
    backgroundColor: colors.stressWash,
  },
  pillViolet: {
    color: colors.sleep,
    borderColor: colors.sleepBorder,
    backgroundColor: colors.sleepWash,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.subheading, color: colors.text },
  emptyDetail: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineSoft,
  },
});
