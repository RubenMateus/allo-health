import { create } from "zustand";

import {
  createHealthProvider,
  createNativeHealthProvider,
  mockHealthProvider,
} from "@/services/health/provider";
import type {
  HealthProvider,
  PermissionResult,
  PermissionState,
} from "@/services/health/types";

type HealthStore = {
  provider: HealthProvider;
  permissionState: PermissionState;
  permissionMessage: string | null;
  requestConnection: () => Promise<PermissionResult>;
  restoreConnection: () => Promise<void>;
  setPermissionState: (state: PermissionState, message?: string | null) => void;
  fallbackToMock: () => void;
};

const initialProvider = createHealthProvider();
const nativeMode = process.env.EXPO_PUBLIC_HEALTH_PROVIDER === "native";

export const useHealthStore = create<HealthStore>((set) => ({
  provider: initialProvider,
  permissionState: nativeMode ? "unrequested" : "mock",
  permissionMessage: null,
  requestConnection: async () => {
    const provider = createNativeHealthProvider();
    if (!provider) {
      const result = {
        state: "denied" as const,
        grantedTypes: 0,
        requestedTypes: 0,
      };
      set({
        provider: mockHealthProvider,
        permissionState: "denied",
        permissionMessage:
          "Health data is only available on iOS and Android. Sample data remains active.",
      });
      return result;
    }
    try {
      const result = await provider.requestPermissions();
      set({
        provider: result.state === "denied" ? mockHealthProvider : provider,
        permissionState: result.state,
        permissionMessage:
          result.state === "denied"
            ? "Access was not granted. The dashboard is showing sample data."
            : null,
      });
      return result;
    } catch {
      const result = {
        state: "denied" as const,
        grantedTypes: 0,
        requestedTypes: 0,
      };
      set({
        provider: mockHealthProvider,
        permissionState: "denied",
        permissionMessage:
          "Health data could not be connected. The dashboard is showing sample data.",
      });
      return result;
    }
  },
  restoreConnection: async () => {
    // Health access is granted at the OS level, so re-attach to it on launch without
    // storing anything ourselves. This never shows a permission prompt.
    if (!nativeMode) return;
    const provider = createNativeHealthProvider();
    if (!provider) return;
    try {
      const result = await provider.getConnectionStatus();
      if (result && result.state !== "denied")
        set({
          provider,
          permissionState: result.state,
          permissionMessage: null,
        });
    } catch {
      // Leave the sample data and connect prompt in place.
    }
  },
  setPermissionState: (permissionState, permissionMessage = null) =>
    set({ permissionState, permissionMessage }),
  fallbackToMock: () =>
    set({
      provider: mockHealthProvider,
      permissionState: "denied",
      permissionMessage:
        "Health data could not be read. The dashboard is showing sample data.",
    }),
}));
