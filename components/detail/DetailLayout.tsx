import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

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
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-canvas">
      <View className="flex-row items-center px-sm py-sm border-b-hairline border-b-outline-soft">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => {
            void Haptics.selectionAsync();
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
          className="w-11 h-11 items-center justify-center"
        >
          <ChevronLeft color={colors.text} size={22} />
        </Pressable>
        <Text
          className="type-subheading text-text flex-1 text-center"
          numberOfLines={1}
        >
          {title}
        </Text>
        <View className="w-11 h-11 items-center justify-center" />
      </View>
      <ScrollView
        contentContainerClassName="gap-2xl px-margin pb-16 pt-xl"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-xs">
          <View className="flex-row items-baseline gap-sm">
            <Text className="type-display text-text tabular-nums">
              {value ?? "—"}
            </Text>
            {unit && value ? (
              <Text className="type-mono text-text-subtle">{unit}</Text>
            ) : null}
          </View>
          {status ? (
            <Text
              className="type-subheading text-text-muted"
              style={statusColor ? { color: statusColor } : null}
            >
              {status}
            </Text>
          ) : null}
          {caption ? (
            <Text className="type-mono text-text-subtle">{caption}</Text>
          ) : null}
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
  return (
    <View className="gap-md">
      <View className="flex-row items-baseline justify-between">
        <Text className="type-subheading text-text">{title}</Text>
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
  return (
    <View
      className="flex-row p-2xs rounded-full bg-surface border border-outline-soft"
      accessibilityRole="tablist"
    >
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
            className={cn(
              "flex-1 min-h-[36px] items-center justify-center rounded-full",
              selected && "bg-surface-highest",
            )}
          >
            <Text
              className={cn(
                "type-caption text-text-subtle",
                selected && "text-text",
              )}
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
  return (
    <View className="flex-row flex-wrap gap-y-lg">
      {stats.map((stat) => (
        <View key={stat.label} className="w-[50%] gap-2xs">
          <Text className="type-badge text-text-subtle uppercase">
            {stat.label}
          </Text>
          <Text className="type-metric-lg text-text tabular-nums text-[20px]">
            {stat.value}
            {stat.unit ? (
              <Text className="type-mono text-text-subtle"> {stat.unit}</Text>
            ) : null}
          </Text>
        </View>
      ))}
    </View>
  );
}
