import { Link, Stack } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 items-center justify-center p-2xl">
        <Text className="type-heading text-text">Route unavailable</Text>
        <Link href="/" asChild>
          <Pressable className="mt-lg py-md px-xl rounded-full bg-surface-high">
            <Text className="type-body-small text-primary-bright">
              Return home
            </Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
