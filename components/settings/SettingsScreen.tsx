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
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
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
  const permissionState = useHealthStore((state) => state.permissionState);
  const { sync, syncing, failed, lastSyncedAt } = useHealthSync();

  return (
    <Screen>
      <View className="flex-row items-center gap-md mb-2xl">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          onPress={() => router.back()}
          className="w-[42px] h-[42px] rounded-full border border-outline-soft bg-surface-prose items-center justify-center active:opacity-70"
        >
          <ChevronLeft color={colors.textMuted} size={20} />
        </Pressable>
        <View className="flex-1 gap-2xs">
          <Text className="type-badge text-primary uppercase">
            ALLO / PREFERENCES
          </Text>
          <Text className="type-heading text-text">Settings</Text>
        </View>
      </View>

      <View className="mb-section">
        <SectionHeader eyebrow="Appearance" title="Theme" />
        <Card>
          <ThemePicker />
          <Text className="type-caption text-text-subtle mt-md">
            System follows your phone&apos;s light or dark setting.
          </Text>
        </Card>
      </View>

      <View className="mb-section">
        <SectionHeader eyebrow="Health data" title="Sync" />
        <Card>
          <View className="flex-row items-center gap-md">
            <View className="w-[38px] h-[38px] rounded-md bg-primary-wash items-center justify-center">
              <HeartPulse color={colors.primary} size={18} />
            </View>
            <View className="flex-1 gap-2xs">
              <Text className="type-subheading text-text">
                {permissionState === "mock" ? "Sample data" : sourceName}
              </Text>
              <Text className="type-caption text-text-subtle">
                {lastSyncedAt
                  ? `Last synced ${formatSyncedAt(lastSyncedAt)}`
                  : "Not synced yet"}
              </Text>
            </View>
            <ConnectionPill state={permissionState} />
          </View>
          <Hairline className="my-lg" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sync now"
            accessibilityState={{ busy: syncing, disabled: syncing }}
            disabled={syncing}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void sync();
            }}
            className={cn(
              "h-[46px] rounded-full bg-primary-bright flex-row items-center justify-center gap-sm",
              "active:opacity-70",
              syncing && "opacity-70",
            )}
          >
            {syncing ? (
              <ActivityIndicator color={colors.canvas} size="small" />
            ) : (
              <RefreshCw color={colors.canvas} size={16} strokeWidth={2.4} />
            )}
            <Text className="type-subheading text-canvas">
              {syncing ? "Syncing" : "Sync now"}
            </Text>
          </Pressable>
          {failed ? (
            <Text className="type-caption mt-md text-error">
              Some data couldn&apos;t be read. Check health access in your
              phone&apos;s settings, then try again.
            </Text>
          ) : (
            <Text className="type-caption text-text-subtle mt-md">
              {permissionState === "mock"
                ? "Refreshes the sample data. Connect a health source from Home to read your own."
                : `Reads the latest data from ${sourceName} on this device.`}
            </Text>
          )}
        </Card>
      </View>

      <View className="flex-row items-center justify-center gap-sm py-sm">
        <ShieldCheck color={colors.textSubtle} size={14} />
        <Text className="type-caption text-text-subtle">
          Health data stays on this device. No accounts, no analytics.
        </Text>
      </View>
      <Text className="type-mono-small text-text-subtle text-center">
        Allo Health {Constants.expoConfig?.version ?? ""}
      </Text>
    </Screen>
  );
}

function ThemePicker() {
  const { colors, glow } = useTheme();
  const preference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference,
  );
  return (
    <View
      accessibilityRole="radiogroup"
      className="flex-row p-2xs gap-2xs rounded-full border border-outline-soft bg-canvas"
    >
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
            className={cn(
              "flex-1 h-10 flex-row items-center justify-center gap-xs rounded-full",
              selected && "bg-primary-wash-strong border border-primary-border",
            )}
            style={selected && { ...glow.recovery, shadowOpacity: 0.15 }}
          >
            <Icon
              color={selected ? colors.primaryBright : colors.textSubtle}
              size={16}
            />
            <Text
              className={cn(
                "type-caption text-text-subtle",
                selected && "text-primary-bright",
              )}
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
