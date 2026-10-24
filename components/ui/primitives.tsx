import type { PropsWithChildren, ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  type RefreshControlProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

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
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-canvas">
      {scroll ? (
        <ScrollView
          contentContainerClassName="px-margin pt-md pb-nav-clearance"
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

type StyledProps<S> = { className?: string; style?: S };

export function Card({
  children,
  className,
  style,
  elevated = false,
}: PropsWithChildren<StyledProps<ViewStyle> & { elevated?: boolean }>) {
  return (
    <View
      className={cn(
        "rounded-card border border-outline-soft bg-surface-prose p-lg",
        elevated && "bg-surface-elevated-prose",
        className,
      )}
      style={style}
    >
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
    <View className="flex-row items-end justify-between mb-md">
      <View className="gap-2xs">
        {eyebrow ? (
          <Text className="type-badge text-text-subtle uppercase">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="type-heading text-text">{title}</Text>
      </View>
      {trailing}
    </View>
  );
}

export function MetricLabel({
  children,
  className,
  style,
}: PropsWithChildren<StyledProps<TextStyle>>) {
  return (
    <Text
      className={cn("type-caption text-text-muted", className)}
      style={style}
    >
      {children}
    </Text>
  );
}

export function StatValue({
  children,
  unit,
  className,
  style,
}: PropsWithChildren<StyledProps<TextStyle> & { unit?: string }>) {
  return (
    <View className="flex-row items-baseline gap-xs">
      <Text
        className={cn("type-metric-lg tabular-nums text-text", className)}
        style={style}
      >
        {children}
      </Text>
      {unit ? <Text className="type-mono text-text-subtle">{unit}</Text> : null}
    </View>
  );
}

const pillTones = {
  neutral: { box: "border-outline-soft bg-surface", text: "text-text-muted" },
  positive: {
    box: "border-primary-border bg-primary-wash",
    text: "text-primary",
  },
  warning: { box: "border-stress-border bg-stress-wash", text: "text-stress" },
  violet: { box: "border-sleep-border bg-sleep-wash", text: "text-sleep" },
};

export function Pill({
  children,
  tone = "neutral",
}: PropsWithChildren<{
  tone?: keyof typeof pillTones;
}>) {
  return (
    <View
      className={cn(
        "self-start rounded-full border px-md py-xs",
        pillTones[tone].box,
      )}
    >
      <Text className={cn("type-badge uppercase", pillTones[tone].text)}>
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
    <View className="items-center py-2xl gap-sm">
      <Text className="type-subheading text-text">{title}</Text>
      <Text className="type-body-small text-text-muted text-center">
        {detail}
      </Text>
    </View>
  );
}

export function Hairline({ className, style }: StyledProps<ViewStyle>) {
  return (
    <View
      className={cn("h-hairline bg-outline-soft", className)}
      style={style}
    />
  );
}
