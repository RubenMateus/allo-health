import { Link2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { AlloMark } from "@/components/brand/AlloMark";
import { SettingsButton } from "@/components/settings/SettingsButton";
import { useTheme } from "@/theme/ThemeProvider";
import { formatToday } from "@/utils/formatters";

/** Top bar shared by every tab: logo tile, "ALLO / SECTION", today's date, connect and settings. */
export function TabHeader({
  section,
  onConnectPress,
}: {
  section: string;
  onConnectPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-md mb-2xl">
      <View className="w-[38px] h-[38px] rounded-md bg-surface-high items-center justify-center border border-outline-soft">
        <AlloMark size={24} />
      </View>
      <View className="flex-1 gap-2xs">
        <Text className="type-badge text-primary uppercase">
          ALLO / {section}
        </Text>
        <Text
          className="type-heading text-text"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {formatToday()}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Connect health data"
        hitSlop={6}
        onPress={onConnectPress}
        className="w-[42px] h-[42px] rounded-full border border-outline-soft bg-surface-prose items-center justify-center active:opacity-70"
      >
        <Link2 color={colors.textMuted} size={18} />
      </Pressable>
      <SettingsButton />
    </View>
  );
}
