import { Platform } from "react-native";

import { AppleHealthProvider } from "./appleHealthProvider";
import { HealthConnectProvider } from "./healthConnectProvider";
import { MockHealthProvider } from "./mockProvider";
import type { HealthProvider } from "./types";

export const mockHealthProvider = new MockHealthProvider();

export function createNativeHealthProvider(): HealthProvider | null {
  if (Platform.OS === "ios") return new AppleHealthProvider();
  if (Platform.OS === "android") return new HealthConnectProvider();
  return null;
}

export function createHealthProvider(): HealthProvider {
  return mockHealthProvider;
}
