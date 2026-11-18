import { Stack } from "expo-router";

/**
 * Every screen in the app. Until the intro is finished, only the intro can be
 * opened, so a first launch (deep links included) always lands on it and Home
 * never loads behind it. Flipping the flag swaps one side for the other.
 */
export function RootStack({
  onboarded,
  canvas,
}: {
  onboarded: boolean;
  canvas: string;
}) {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: canvas },
      }}
    >
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen
          name="onboarding"
          options={{ gestureEnabled: false, animation: "fade" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="biomarkers/[kind]" />
        <Stack.Screen name="fitness/[metric]" />
        <Stack.Screen name="workouts/index" />
        <Stack.Screen name="workouts/[id]" />
        <Stack.Screen name="readiness" />
        <Stack.Screen name="sleep" />
        <Stack.Screen name="strain" />
        <Stack.Screen name="recovery" />
      </Stack.Protected>
    </Stack>
  );
}
