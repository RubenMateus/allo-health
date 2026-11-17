import { MockHealthProvider } from "./mockProvider";
import type { HealthProvider } from "./types";

// Web is a development-only target. HealthKit and Health Connect don't exist
// there, so this file keeps both native libraries out of the web bundle and
// the app stays on sample data.
export const mockHealthProvider = new MockHealthProvider();

export function createNativeHealthProvider(): HealthProvider | null {
  return null;
}

export function createHealthProvider(): HealthProvider {
  return mockHealthProvider;
}
