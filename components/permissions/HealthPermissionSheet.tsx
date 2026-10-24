import { BlurView } from "expo-blur";
import {
  Activity,
  Check,
  HeartPulse,
  LockKeyhole,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { PermissionState } from "@/services/health/types";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

export function HealthPermissionSheet({
  visible,
  sourceName,
  permissionState,
  permissionMessage,
  connecting,
  onClose,
  onConnect,
}: {
  visible: boolean;
  sourceName: string;
  permissionState: PermissionState;
  permissionMessage: string | null;
  connecting: boolean;
  onClose: () => void;
  onConnect: () => void;
}) {
  const { colors, scheme } = useTheme();
  const [requested, setRequested] = useState(false);
  const connected = permissionState === "granted";
  const partial = permissionState === "partial";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-scrim">
        <Pressable
          accessibilityLabel="Close connection sheet"
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
            <View className="w-11 h-11 items-center justify-center rounded-full bg-primary-wash">
              <HeartPulse color={colors.primary} size={22} />
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
          <Text className="type-badge text-primary mb-sm">
            ON-DEVICE HEALTH DATA
          </Text>
          <Text className="type-title text-text mb-sm">
            Connect your signals
          </Text>
          <Text className="type-body-small text-text-muted mb-xl">
            Choose what {sourceName} can share. Your health data stays on this
            device and is never sent to a server.
          </Text>
          <View className="gap-lg py-lg border-t border-b border-outline-soft mb-lg">
            <PermissionRow
              title="Recovery & sleep"
              detail="Heart rate, HRV, sleep, respiration"
            />
            <PermissionRow
              title="Daily activity"
              detail="Active energy and exercise intensity"
            />
            <PermissionRow
              title="Body & fitness"
              detail="Weight, body composition, VO2 max, blood oxygen"
            />
            <PermissionRow
              title="Metabolic signals"
              detail="Nutrition and glucose, when available"
            />
          </View>
          {permissionMessage ? (
            <Text
              accessibilityRole="alert"
              className="type-body-small text-error mb-md"
            >
              {permissionMessage}
            </Text>
          ) : null}
          {connected || partial || requested ? (
            <Text className="type-body-small text-primary mb-md">
              {connected
                ? "Connection request completed."
                : partial
                  ? "Some permissions were granted. Available signals will appear."
                  : "You can change access later in system settings."}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={connecting || connected}
            onPress={() => {
              setRequested(true);
              onConnect();
            }}
            className={cn(
              "min-h-[52px] rounded-full bg-primary-bright flex-row items-center justify-center gap-sm",
              (connecting || connected) && "opacity-70",
              "active:opacity-[0.78]",
            )}
          >
            {connecting ? (
              <ActivityIndicator color={colors.canvas} />
            ) : connected ? (
              <Check color={colors.canvas} size={18} />
            ) : (
              <Activity color={colors.canvas} size={18} />
            )}
            <Text className="type-subheading text-canvas">
              {connecting
                ? "Connecting…"
                : connected
                  ? "Connected"
                  : partial
                    ? "Review access"
                    : "Continue to permissions"}
            </Text>
          </Pressable>
          <View className="flex-row items-center justify-center gap-xs mt-md">
            <LockKeyhole size={13} color={colors.textSubtle} />
            <Text className="type-caption text-text-subtle">
              Read-only access · stored on this device
            </Text>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

function PermissionRow({ title, detail }: { title: string; detail: string }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-md">
      <View className="w-7 h-7 rounded-full items-center justify-center bg-primary-wash">
        <Check size={13} color={colors.primary} />
      </View>
      <View className="flex-1 gap-2xs">
        <Text className="type-body-small text-text">{title}</Text>
        <Text className="type-caption text-text-subtle">{detail}</Text>
      </View>
    </View>
  );
}
