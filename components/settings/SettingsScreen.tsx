import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  ChevronLeft,
  HeartPulse,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  type LucideIcon,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Card,
  Hairline,
  Pill,
  Screen,
  SectionHeader,
} from "@/components/ui/primitives";
import { useHealthSync } from "@/hooks/useHealthSync";
import type { PermissionState } from "@/services/health/types";
import { useHealthStore } from "@/stores/healthStore";
import { useSettingsStore, type ThemePreference } from "@/stores/settingsStore";
import { makeStyles, useTheme } from "@/theme/ThemeProvider";
import { radii, spacing, typography } from "@/theme/tokens";
import { formatSyncedAt } from "@/utils/formatters";

const themeOptions: {
  value: ThemePreference;
  label: string;
  Icon: LucideIcon;
}[] = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Smartphone },
];

const sourceName = Platform.OS === "ios" ? "Apple Health" : "Health Connect";

export function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const permissionState = useHealthStore((state) => state.permissionState);
  const { sync, syncing, failed, lastSyncedAt } = useHealthSync();

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
        >
          <ChevronLeft color={colors.textMuted} size={20} />
        </Pressable>
        <View style={styles.topBarCopy}>
          <Text style={styles.topOverline}>ALLO / PREFERENCES</Text>
          <Text style={styles.title}>Settings</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Appearance" title="Theme" />
        <Card>
          <ThemePicker />
          <Text style={styles.hint}>
            System follows your phone&apos;s light or dark setting.
          </Text>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Health data" title="Sync" />
        <Card>
          <View style={styles.sourceRow}>
            <View style={styles.sourceIcon}>
              <HeartPulse color={colors.primary} size={18} />
            </View>
            <View style={styles.sourceCopy}>
              <Text style={styles.rowTitle}>
                {permissionState === "mock" ? "Sample data" : sourceName}
              </Text>
              <Text style={styles.rowDetail}>
                {lastSyncedAt
                  ? `Last synced ${formatSyncedAt(lastSyncedAt)}`
                  : "Not synced yet"}
              </Text>
            </View>
            <ConnectionPill state={permissionState} />
          </View>
          <Hairline style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sync now"
            accessibilityState={{ busy: syncing, disabled: syncing }}
            disabled={syncing}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void sync();
            }}
            style={({ pressed }) => [
              styles.syncButton,
              (pressed || syncing) && styles.pressed,
            ]}
          >
            {syncing ? (
              <ActivityIndicator color={colors.canvas} size="small" />
            ) : (
              <RefreshCw color={colors.canvas} size={16} strokeWidth={2.4} />
            )}
            <Text style={styles.syncText}>
              {syncing ? "Syncing" : "Sync now"}
            </Text>
          </Pressable>
          {failed ? (
            <Text style={[styles.hint, styles.error]}>
              Some data couldn&apos;t be read. Check health access in your
              phone&apos;s settings, then try again.
            </Text>
          ) : (
            <Text style={styles.hint}>
              {permissionState === "mock"
                ? "Refreshes the sample data. Connect a health source from Home to read your own."
                : `Reads the latest data from ${sourceName} on this device.`}
            </Text>
          )}
        </Card>
      </View>

      <View style={styles.footer}>
        <ShieldCheck color={colors.textSubtle} size={14} />
        <Text style={styles.footerText}>
          Health data stays on this device. No accounts, no analytics.
        </Text>
      </View>
      <Text style={styles.version}>
        Allo Health {Constants.expoConfig?.version ?? ""}
      </Text>
    </Screen>
  );
}

function ThemePicker() {
  const { colors } = useTheme();
  const styles = useStyles();
  const preference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference,
  );
  return (
    <View accessibilityRole="radiogroup" style={styles.segmented}>
      {themeOptions.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => {
              void Haptics.selectionAsync();
              setThemePreference(value);
            }}
            style={[styles.segment, selected && styles.segmentActive]}
          >
            <Icon
              color={selected ? colors.primaryBright : colors.textSubtle}
              size={16}
            />
            <Text
              style={[styles.segmentText, selected && styles.segmentTextActive]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ConnectionPill({ state }: { state: PermissionState }) {
  if (state === "granted") return <Pill tone="positive">Connected</Pill>;
  if (state === "partial") return <Pill tone="warning">Limited</Pill>;
  if (state === "mock") return <Pill>Sample</Pill>;
  return <Pill tone="warning">Not connected</Pill>;
}

const useStyles = makeStyles(({ colors, glow }) =>
  StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing["2xl"],
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.surfaceProse,
      alignItems: "center",
      justifyContent: "center",
    },
    topBarCopy: { flex: 1, gap: spacing["2xs"] },
    topOverline: {
      ...typography.badge,
      color: colors.primary,
      textTransform: "uppercase",
    },
    title: { ...typography.heading, color: colors.text },
    section: { marginBottom: spacing.section },
    segmented: {
      flexDirection: "row",
      padding: spacing["2xs"],
      gap: spacing["2xs"],
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.canvas,
    },
    segment: {
      flex: 1,
      height: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      borderRadius: radii.full,
    },
    segmentActive: {
      backgroundColor: colors.primaryWashStrong,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      ...glow.recovery,
      shadowOpacity: 0.15,
    },
    segmentText: { ...typography.caption, color: colors.textSubtle },
    segmentTextActive: { color: colors.primaryBright },
    hint: {
      ...typography.caption,
      color: colors.textSubtle,
      marginTop: spacing.md,
    },
    error: { color: colors.error },
    sourceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    sourceIcon: {
      width: 38,
      height: 38,
      borderRadius: radii.md,
      backgroundColor: colors.primaryWash,
      alignItems: "center",
      justifyContent: "center",
    },
    sourceCopy: { flex: 1, gap: spacing["2xs"] },
    rowTitle: { ...typography.subheading, color: colors.text },
    rowDetail: { ...typography.caption, color: colors.textSubtle },
    divider: { marginVertical: spacing.lg },
    syncButton: {
      height: 46,
      borderRadius: radii.full,
      backgroundColor: colors.primaryBright,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    syncText: { ...typography.subheading, color: colors.canvas },
    pressed: { opacity: 0.7 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    footerText: { ...typography.caption, color: colors.textSubtle },
    version: {
      ...typography.monoSmall,
      color: colors.textSubtle,
      textAlign: "center",
    },
  }),
);
