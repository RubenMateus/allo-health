import * as Haptics from "expo-haptics";
import { Lock } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { BiologicalSex, HealthProfile } from "@/services/health/types";
import { isValidBirthYear } from "@/services/profile/birthYear";
import { useProfileStore } from "@/stores/profileStore";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

const sexOptions: { value: BiologicalSex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

/**
 * Birth year and sex, saved only on this device. Shared by onboarding, the
 * Biomarkers card and Settings.
 */
export function ProfileForm({
  initial,
  submitLabel = "Save",
  onSaved,
}: {
  initial: HealthProfile;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const { colors } = useTheme();
  const setProfile = useProfileStore((state) => state.setProfile);
  const [year, setYear] = useState(initial.birthDate?.slice(0, 4) ?? "");
  const [sex, setSex] = useState<BiologicalSex | null>(initial.sex);
  const validYear = isValidBirthYear(year);

  return (
    <View>
      <Text className="type-badge text-text-subtle uppercase mb-sm">
        Birth year
      </Text>
      <TextInput
        value={year}
        onChangeText={(text) => setYear(text.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad"
        placeholder="1990"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Birth year"
        className="type-body text-text min-h-[44px] px-md rounded-md border border-outline-soft bg-surface"
      />

      <Text className="type-badge text-text-subtle uppercase mt-lg mb-sm">
        Sex
      </Text>
      <View className="flex-row gap-sm">
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
              className={cn(
                "flex-1 min-h-[44px] items-center justify-center rounded-full border border-outline-soft bg-surface",
                selected && "border-primary-border bg-primary-wash",
              )}
            >
              <Text
                className={cn(
                  "type-caption text-text-muted",
                  selected && "text-primary",
                )}
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
        accessibilityState={{ disabled: !validYear || !sex }}
        onPress={() => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          // Only the year is asked for, so mid-year keeps the age within six months.
          setProfile({ birthDate: `${year}-07-01`, sex });
          onSaved?.();
        }}
        className={cn(
          "mt-xl min-h-[48px] rounded-full items-center justify-center bg-primary-bright",
          (!validYear || !sex) && "opacity-40",
        )}
      >
        <Text className="type-subheading text-canvas">{submitLabel}</Text>
      </Pressable>
      <View className="flex-row items-center justify-center gap-xs mt-md">
        <Lock color={colors.textSubtle} size={12} />
        <Text className="type-caption text-text-subtle">
          Stored only on this phone
        </Text>
      </View>
    </View>
  );
}
