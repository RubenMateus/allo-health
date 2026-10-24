import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/theme/ThemeProvider";

/**
 * The shared frame for every metric detail page: back button and title, the
 * latest value with its status, then whatever sections the metric needs.
 */
export function DetailLayout({
  title,
  value,
  unit,
  status,
  statusColor,
  caption,
  children,
}: PropsWithChildren<{
  title: string;
  value: string | null;
  unit?: string;
  status?: string | null;
  statusColor?: string;
  caption?: string | null;
}>) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => {
            void Haptics.selectionAsync();
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
          style={styles.back}
        >
          <ChevronLeft color={colors.text} size={22} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value ?? "—"}</Text>
            {unit && value ? <Text style={styles.unit}>{unit}</Text> : null}
          </View>
          {status ? (
            <Text
              style={[
                styles.status,
                statusColor ? { color: statusColor } : null,
              ]}
            >
              {status}
            </Text>
          ) : null}
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function DetailSection({
  title,
  trailing,
  children,
}: PropsWithChildren<{ title: string; trailing?: ReactNode }>) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}

export type RangeOption<T extends string> = { value: T; label: string };

export function RangeToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: RangeOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.toggle} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={[styles.toggleItem, selected && styles.toggleItemSelected]}
          >
            <Text
              style={[styles.toggleText, selected && styles.toggleTextSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatGrid({
  stats,
}: {
  stats: { label: string; value: string; unit?: string }[];
}) {
  const styles = useStyles();
  return (
    <View style={styles.statGrid}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.stat}>
          <Text style={styles.statLabel}>{stat.label}</Text>
          <Text style={styles.statValue}>
            {stat.value}
            {stat.unit ? (
              <Text style={styles.statUnit}> {stat.unit}</Text>
            ) : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors, radii, spacing, typography }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineSoft,
    },
    back: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      ...typography.subheading,
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
    content: {
      paddingHorizontal: spacing.margin,
      paddingTop: spacing.xl,
      paddingBottom: spacing["3xl"] * 2,
      gap: spacing["2xl"],
    },
    hero: { gap: spacing.xs },
    valueRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
    value: {
      ...typography.display,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    unit: { ...typography.mono, color: colors.textSubtle },
    status: { ...typography.subheading, color: colors.textMuted },
    caption: { ...typography.mono, color: colors.textSubtle },
    section: { gap: spacing.md },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    sectionTitle: { ...typography.subheading, color: colors.text },
    toggle: {
      flexDirection: "row",
      padding: spacing["2xs"],
      borderRadius: radii.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
    },
    toggleItem: {
      flex: 1,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.full,
    },
    toggleItemSelected: { backgroundColor: colors.surfaceHighest },
    toggleText: { ...typography.caption, color: colors.textSubtle },
    toggleTextSelected: { color: colors.text },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: spacing.lg,
    },
    stat: { width: "50%", gap: spacing["2xs"] },
    statLabel: {
      ...typography.badge,
      color: colors.textSubtle,
      textTransform: "uppercase",
    },
    statValue: {
      ...typography.metricLG,
      fontSize: 20,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    statUnit: { ...typography.mono, color: colors.textSubtle },
  }),
);
