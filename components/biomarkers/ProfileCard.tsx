import * as Haptics from "expo-haptics";
import { Lock } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card } from "@/components/ui/primitives";
import type { BiologicalSex, HealthProfile } from "@/services/health/types";
import { useProfileStore } from "@/stores/profileStore";
import { makeStyles, useTheme } from "@/theme/ThemeProvider";

const sexOptions: { value: BiologicalSex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

/**
 * Asks once for birth year and sex when the health source doesn't share them
 * (always the case on Health Connect). Saved only on this device.
 */
export function ProfileCard({ profile }: { profile: HealthProfile }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const setProfile = useProfileStore((state) => state.setProfile);
  const [year, setYear] = useState(profile.birthDate?.slice(0, 4) ?? "");
  const [sex, setSex] = useState<BiologicalSex | null>(profile.sex);
  const currentYear = new Date().getFullYear();
  const parsedYear = Number(year);
  const validYear =
    /^\d{4}$/.test(year) &&
    parsedYear >= currentYear - 100 &&
    parsedYear <= currentYear - 13;

  return (
    <Card>
      <Text style={styles.title}>Personalise your ratings</Text>
      <Text style={styles.detail}>
        VO₂ max, body fat and Fitness Age are compared with people of your age
        and sex. Your health app doesn&apos;t share these, so add them here.
      </Text>

      <Text style={styles.label}>Birth year</Text>
      <TextInput
        value={year}
        onChangeText={(text) => setYear(text.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad"
        placeholder="1990"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Birth year"
        style={styles.input}
      />

      <Text style={styles.label}>Sex</Text>
      <View style={styles.chips}>
        {sexOptions.map((option) => {
          const selected = sex === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                void Haptics.selectionAsync();
                setSex(option.value);
              }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!validYear || !sex}
        onPress={() => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          // Only the year is asked for, so mid-year keeps the age within six months.
          setProfile({ birthDate: `${year}-07-01`, sex });
        }}
        style={[styles.save, (!validYear || !sex) && styles.saveDisabled]}
      >
        <Text style={styles.saveText}>Save</Text>
      </Pressable>
      <View style={styles.privacy}>
        <Lock color={colors.textSubtle} size={12} />
        <Text style={styles.privacyText}>Stored only on this phone</Text>
      </View>
    </Card>
  );
}

const useStyles = makeStyles(({ colors, radii, spacing, typography }) =>
  StyleSheet.create({
    title: { ...typography.subheading, color: colors.text },
    detail: {
      ...typography.bodySmall,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    label: {
      ...typography.badge,
      color: colors.textSubtle,
      textTransform: "uppercase",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    input: {
      ...typography.body,
      color: colors.text,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.surface,
    },
    chips: { flexDirection: "row", gap: spacing.sm },
    chip: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryWash,
    },
    chipText: { ...typography.caption, color: colors.textMuted },
    chipTextSelected: { color: colors.primary },
    save: {
      marginTop: spacing.xl,
      minHeight: 48,
      borderRadius: radii.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryBright,
    },
    saveDisabled: { opacity: 0.4 },
    saveText: { ...typography.subheading, color: colors.canvas },
    privacy: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    privacyText: { ...typography.caption, color: colors.textSubtle },
  }),
);
