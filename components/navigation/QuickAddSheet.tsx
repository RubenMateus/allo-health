import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  BookOpen,
  ChevronRight,
  RefreshCw,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useHealthSync } from "@/hooks/useHealthSync";
import { toDayKey } from "@/services/journal";
import { useJournalStore } from "@/stores/journalStore";
import { useTheme } from "@/theme/ThemeProvider";
import { formatSyncedAt } from "@/utils/formatters";

/** The sheet behind the "+" in the tab bar: shortcuts for things you do every day. */
export function QuickAddSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, scheme } = useTheme();
  const { sync, syncing, failed, lastSyncedAt } = useHealthSync();
  const loggedToday = useJournalStore((state) =>
    state.entries.some((entry) => entry.date === toDayKey(new Date())),
  );

  const go = (href: "/journal" | "/readiness") => {
    void Haptics.selectionAsync();
    onClose();
    router.navigate(href);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-scrim">
        <Pressable
          accessibilityLabel="Close quick add"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <BlurView
          intensity={25}
          tint={scheme}
          className="px-2xl pt-md pb-3xl rounded-tl-xl rounded-tr-xl overflow-hidden bg-surface-elevated-prose border border-outline-glass"
        >
          <View className="self-center w-9 h-1 rounded-full bg-text-subtle mb-xl" />
          <View className="flex-row justify-between items-center mb-lg">
            <View className="gap-2xs">
              <Text className="type-badge text-primary">QUICK ADD</Text>
              <Text className="type-title text-text">For today</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              className="w-10 h-10 items-center justify-center rounded-full bg-surface-high"
            >
              <X color={colors.textMuted} size={18} />
            </Pressable>
          </View>
          <View className="gap-sm">
            <Action
              Icon={BookOpen}
              title={
                loggedToday ? "Update today's check-in" : "Journal check-in"
              }
              detail={
                loggedToday
                  ? "Already logged today. Tap to edit it."
                  : "Log mood, energy and what shaped your day"
              }
              onPress={() => go("/journal")}
            />
            <Action
              Icon={Sparkles}
              title="Today's readiness"
              detail="Target strain and the signals behind it"
              onPress={() => go("/readiness")}
            />
            <Action
              Icon={RefreshCw}
              title={syncing ? "Syncing…" : "Sync health data"}
              detail={
                failed
                  ? "Some data couldn't be read. Check access in Settings."
                  : lastSyncedAt
                    ? `Last synced ${formatSyncedAt(lastSyncedAt)}`
                    : "Re-read from your health app on this phone"
              }
              busy={syncing}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void sync();
              }}
            />
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

function Action({
  Icon,
  title,
  detail,
  busy = false,
  onPress,
}: {
  Icon: LucideIcon;
  title: string;
  detail: string;
  busy?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      className="min-h-[64px] flex-row items-center gap-md px-md py-md rounded-card border border-outline-soft bg-surface-prose active:opacity-70"
    >
      <View className="w-10 h-10 rounded-full items-center justify-center bg-primary-wash">
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Icon color={colors.primary} size={18} />
        )}
      </View>
      <View className="flex-1 gap-2xs">
        <Text className="type-subheading text-text">{title}</Text>
        <Text className="type-caption text-text-muted">{detail}</Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={16} />
    </Pressable>
  );
}
