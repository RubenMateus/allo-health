import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Activity,
  BookOpen,
  CirclePlus,
  House,
  ScanHeart,
} from "lucide-react-native";
import type { RefObject } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  colors,
  glow,
  gradients,
  radii,
  spacing,
  typography,
} from "@/theme/tokens";

const items = [
  { route: "index", label: "Home", Icon: House },
  { route: "journal", label: "Journal", Icon: BookOpen },
  { route: "fitness", label: "Fitness", Icon: Activity },
  { route: "biology", label: "Biology", Icon: ScanHeart },
] as const;

type FloatingTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: {
      type: "tabPress";
      target?: string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (route: string) => void;
  };
  blurTarget: RefObject<View | null>;
};

export function FloatingTabBar({
  state,
  navigation,
  blurTarget,
}: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.dockPosition, { bottom: insets.bottom + spacing.lg }]}
    >
      <View style={styles.dockBorder}>
        <LinearGradient
          colors={gradients.glassEdge}
          style={StyleSheet.absoluteFill}
        />
        <BlurView
          blurTarget={blurTarget}
          intensity={38}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={styles.dock}
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
                  const event = navigation.emit({
                    type: "tabPress",
                    target: state.routes[routeIndex]?.key,
                    canPreventDefault: true,
                  });
                  if (!selected && !event.defaultPrevented)
                    navigation.navigate(route);
                }}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[styles.iconWrap, selected && styles.iconWrapActive]}
                >
                  <Icon
                    size={18}
                    color={selected ? colors.primaryBright : colors.textSubtle}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={[styles.itemLabel, selected && styles.itemLabelActive]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quick add"
            onPress={() =>
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
          >
            <CirclePlus color={colors.canvas} size={21} strokeWidth={2.4} />
          </Pressable>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockPosition: {
    position: "absolute",
    left: spacing.margin,
    right: spacing.margin,
    alignItems: "center",
  },
  dockBorder: {
    width: "100%",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineGlass,
    overflow: "hidden",
  },
  dock: {
    height: 70,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.glassFill,
  },
  item: {
    flex: 1,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconWrap: {
    minWidth: 38,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
  },
  iconWrapActive: {
    backgroundColor: colors.primaryWashStrong,
    ...glow.recovery,
  },
  itemLabel: { ...typography.badge, color: colors.textSubtle },
  itemLabelActive: { color: colors.primaryBright },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: colors.primaryBright,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
  },
  pressed: { opacity: 0.7 },
});
