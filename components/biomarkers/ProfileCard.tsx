import * as Haptics from "expo-haptics";
import { Lock } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Card } from "@/components/ui/primitives";
import type { BiologicalSex, HealthProfile } from "@/services/health/types";
import { useProfileStore } from "@/stores/profileStore";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

const sexOptions: { value: BiologicalSex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

/**
 * Asks once for birth year and sex when the health source doesn't share them
 * (always the case on Health Connect). Saved only on this device.
 */
export function ProfileCard({ profile }: { profile: HealthProfile }) {
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
      <Text className="type-subheading text-text">
        Personalise your ratings
      </Text>
      <Text className="type-body-small text-text-muted mt-xs">
        VO₂ max, body fat and Fitness Age are compared with people of your age
        and sex. Your health app doesn&apos;t share these, so add them here.
      </Text>

      <Text className="type-badge text-text-subtle uppercase mt-lg mb-sm">
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
        onPress={() => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          // Only the year is asked for, so mid-year keeps the age within six months.
          setProfile({ birthDate: `${year}-07-01`, sex });
        }}
        className={cn(
          "mt-xl min-h-[48px] rounded-full items-center justify-center bg-primary-bright",
          (!validYear || !sex) && "opacity-40",
        )}
      >
        <Text className="type-subheading text-canvas">Save</Text>
      </Pressable>
      <View className="flex-row items-center justify-center gap-xs mt-md">
        <Lock color={colors.textSubtle} size={12} />
        <Text className="type-caption text-text-subtle">
          Stored only on this phone
        </Text>
      </View>
    </Card>
  );
}
