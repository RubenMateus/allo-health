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
import { colors, radii, spacing, typography } from "@/theme/tokens";

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
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close connection sheet"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <BlurView intensity={25} tint="dark" style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.topRow}>
            <View style={styles.iconHalo}>
              <HeartPulse color={colors.primary} size={22} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeButton}
            >
              <X color={colors.textMuted} size={18} />
            </Pressable>
          </View>
          <Text style={styles.eyebrow}>ON-DEVICE HEALTH DATA</Text>
          <Text style={styles.title}>Connect your signals</Text>
          <Text style={styles.description}>
            Choose what {sourceName} can share. Your health data stays on this
            device and is never sent to a server.
          </Text>
          <View style={styles.permissionList}>
            <PermissionRow
              title="Recovery & sleep"
              detail="Heart rate, HRV, sleep, respiration"
            />
            <PermissionRow
              title="Daily activity"
              detail="Active energy and exercise intensity"
            />
            <PermissionRow
              title="Metabolic signals"
              detail="Nutrition and glucose, when available"
            />
          </View>
          {permissionMessage ? (
            <Text accessibilityRole="alert" style={styles.message}>
              {permissionMessage}
            </Text>
          ) : null}
          {connected || partial || requested ? (
            <Text style={styles.stateText}>
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
            style={({ pressed }) => [
              styles.connectButton,
              (connecting || connected) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {connecting ? (
              <ActivityIndicator color={colors.canvas} />
            ) : connected ? (
              <Check color={colors.canvas} size={18} />
            ) : (
              <Activity color={colors.canvas} size={18} />
            )}
            <Text style={styles.connectText}>
              {connecting
                ? "Connecting…"
                : connected
                  ? "Connected"
                  : partial
                    ? "Review access"
                    : "Continue to permissions"}
            </Text>
          </Pressable>
          <View style={styles.privacyNote}>
            <LockKeyhole size={13} color={colors.textSubtle} />
            <Text style={styles.privacyText}>
              Read-only access · stored on this device
            </Text>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

function PermissionRow({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.checkMark}>
        <Check size={13} color={colors.primary} />
      </View>
      <View style={styles.permissionCopy}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.permissionDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.scrim,
  },
  sheet: {
    paddingHorizontal: spacing["2xl"],
    paddingTop: spacing.md,
    paddingBottom: spacing["3xl"],
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevatedProse,
    borderWidth: 1,
    borderColor: colors.outlineGlass,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.textSubtle,
    marginBottom: spacing.xl,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  iconHalo: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: colors.primaryWash,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
  },
  eyebrow: {
    ...typography.badge,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  description: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  permissionList: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.outlineSoft,
    marginBottom: spacing.lg,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryWash,
  },
  permissionCopy: { flex: 1, gap: spacing["2xs"] },
  permissionTitle: { ...typography.bodySmall, color: colors.text },
  permissionDetail: { ...typography.caption, color: colors.textSubtle },
  message: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
  },
  stateText: {
    ...typography.bodySmall,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  connectButton: {
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primaryBright,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  connectText: { ...typography.subheading, color: colors.canvas },
  disabled: { opacity: 0.7 },
  pressed: { opacity: 0.78 },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  privacyText: { ...typography.caption, color: colors.textSubtle },
});
