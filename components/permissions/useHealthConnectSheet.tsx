import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Platform } from "react-native";

import { HealthPermissionSheet } from "@/components/permissions/HealthPermissionSheet";
import { useHealthStore } from "@/stores/healthStore";

const sourceName =
  Platform.OS === "ios"
    ? "Apple Health"
    : Platform.OS === "android"
      ? "Health Connect"
      : "your health platform";

/** State and element for the "connect health data" sheet. Render `sheet` once per screen. */
export function useHealthConnectSheet() {
  const queryClient = useQueryClient();
  const permissionState = useHealthStore((state) => state.permissionState);
  const permissionMessage = useHealthStore((state) => state.permissionMessage);
  const requestConnection = useHealthStore((state) => state.requestConnection);
  const [visible, setVisible] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    try {
      await requestConnection();
      // Every tab reads from the same source, so refresh all of them.
      await queryClient.invalidateQueries();
    } finally {
      setConnecting(false);
    }
  };

  const sheet = (
    <HealthPermissionSheet
      visible={visible}
      sourceName={sourceName}
      permissionState={permissionState}
      permissionMessage={permissionMessage}
      connecting={connecting}
      onClose={() => setVisible(false)}
      onConnect={() => {
        void connect();
      }}
    />
  );

  return {
    open: () => setVisible(true),
    sheet,
    permissionState,
    permissionMessage,
  };
}
