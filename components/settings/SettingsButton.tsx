import { router } from "expo-router";
import { Ellipsis } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";

import { makeStyles, useTheme } from "@/theme/ThemeProvider";
import { radii } from "@/theme/tokens";

/** The "..." header button that opens Settings. */
export function SettingsButton() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={6}
      onPress={() => router.push("/settings")}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ellipsis color={colors.textMuted} size={18} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    button: {
      width: 42,
      height: 42,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.surfaceProse,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { opacity: 0.7 },
  }),
);
