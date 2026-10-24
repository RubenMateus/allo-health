import { router } from "expo-router";
import { Ellipsis } from "lucide-react-native";
import { Pressable } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

/** The "..." header button that opens Settings. */
export function SettingsButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={6}
      onPress={() => router.push("/settings")}
      className="w-[42px] h-[42px] rounded-full border border-outline-soft bg-surface-prose items-center justify-center active:opacity-70"
    >
      <Ellipsis color={colors.textMuted} size={18} />
    </Pressable>
  );
}
