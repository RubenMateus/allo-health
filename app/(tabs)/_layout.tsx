import { BlurTargetView } from "expo-blur";
import { Tabs } from "expo-router";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";

import { FloatingTabBar } from "@/components/navigation/FloatingTabBar";
import { colors } from "@/theme/tokens";

export default function TabLayout() {
  const blurTarget = useRef<View>(null);

  return (
    <BlurTargetView ref={blurTarget} style={styles.container}>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar
            {...(props as unknown as Parameters<typeof FloatingTabBar>[0])}
            blurTarget={blurTarget}
          />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="journal" options={{ title: "Journal" }} />
        <Tabs.Screen name="fitness" options={{ title: "Fitness" }} />
        <Tabs.Screen name="biology" options={{ title: "Biology" }} />
      </Tabs>
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
