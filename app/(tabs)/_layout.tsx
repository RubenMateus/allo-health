import { BlurTargetView } from "expo-blur";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useRef, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";

import { FloatingTabBar } from "@/components/navigation/FloatingTabBar";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTheme } from "@/theme/ThemeProvider";

export default function TabLayout() {
  const { colors } = useTheme();
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  const onboarded = useSettingsStore(
    (state) => state.onboardingCompletedAt !== null,
  );

  // First launch goes to the intro, so Home never loads sample data behind it.
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <BlurTargetView ref={blurTarget} style={styles.container}>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar {...props} blurTarget={blurTarget} />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="journal" options={{ title: "Journal" }} />
        <Tabs.Screen name="fitness" options={{ title: "Fitness" }} />
        <Tabs.Screen name="biomarkers" options={{ title: "Biomarkers" }} />
      </Tabs>
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
