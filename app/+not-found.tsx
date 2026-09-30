import { Link, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Route unavailable</Text>
        <Link href="/" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>Return home</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  link: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primaryBright,
  },
});
