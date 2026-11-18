import { BlurView } from "expo-blur";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Activity,
  BookOpen,
  CirclePlus,
  House,
  ScanHeart,
} from "lucide-react-native";
import { useState, type ComponentRef, type RefObject } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuickAddSheet } from "@/components/navigation/QuickAddSheet";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { cn } from "@/utils/cn";

const items = [
  { route: "index", label: "Home", Icon: House },
  { route: "journal", label: "Journal", Icon: BookOpen },
  { route: "fitness", label: "Fitness", Icon: Activity },
  { route: "biomarkers", label: "Biomarkers", Icon: ScanHeart },
] as const;

type FloatingTabBarProps = Pick<
  BottomTabBarProps,
  "state" | "emitter" | "navigateToTab"
> & {
  blurTarget: RefObject<ComponentRef<typeof View> | null>;
};

export function FloatingTabBar({
  state,
  emitter,
  navigateToTab,
  blurTarget,
}: FloatingTabBarProps) {
  const { colors, glow, gradients, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [quickAdd, setQuickAdd] = useState(false);
  return (
    <View
      pointerEvents="box-none"
      className="absolute left-margin right-margin items-center"
      style={{ bottom: Math.max(insets.bottom, spacing.lg) }}
    >
      <View className="w-full rounded-full border border-outline-glass overflow-hidden">
        <LinearGradient
          colors={gradients.glassEdge}
          style={StyleSheet.absoluteFill}
        />
        <BlurView
          blurTarget={blurTarget}
          intensity={38}
          tint={scheme}
          blurMethod="dimezisBlurViewSdk31Plus"
          className="h-[70px] px-sm flex-row items-center justify-between bg-glass-fill"
        >
          {items.map(({ route, label, Icon }) => {
            const routeIndex = state.routes.findIndex(
              (item) => item.name === route,
            );
            const selected = state.index === routeIndex;
            return (
              <Pressable
                key={route}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                onPress={() => {
                  void Haptics.selectionAsync();
                  const target = state.routes[routeIndex];
                  if (!target) return;
                  const event = emitter.emit({
                    type: "tabPress",
                    target: target.key,
                    canPreventDefault: true,
                  });
                  if (!selected && !event.defaultPrevented)
                    navigateToTab(target.key);
                }}
                className="flex-1 h-14 items-center justify-center gap-0.5 active:opacity-70"
              >
                <View
                  className={cn(
                    "min-w-[38px] min-h-[34px] items-center justify-center rounded-full",
                    selected && "bg-primary-wash-strong",
                  )}
                  style={selected && glow.recovery}
                >
                  <Icon
                    size={18}
                    color={selected ? colors.primaryBright : colors.textSubtle}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  className={cn(
                    "type-badge text-text-subtle",
                    selected && "text-primary-bright",
                  )}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quick add"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setQuickAdd(true);
            }}
            className="w-[42px] h-[42px] rounded-full bg-primary-bright items-center justify-center ml-xs active:opacity-70"
          >
            <CirclePlus color={colors.canvas} size={21} strokeWidth={2.4} />
          </Pressable>
        </BlurView>
      </View>
      <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
    </View>
  );
}
