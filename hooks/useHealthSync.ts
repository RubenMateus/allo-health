import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useHealthStore } from "@/stores/healthStore";
import { useSettingsStore } from "@/stores/settingsStore";

/** Queries that read from HealthKit / Health Connect. */
export const HEALTH_QUERY_KEYS = ["health-dashboard", "fitness-dashboard"];

const isHealthQuery = (query: { queryKey: readonly unknown[] }) =>
  HEALTH_QUERY_KEYS.includes(query.queryKey[0] as string);

/**
 * Re-reads health data from the platform store on this device. It re-attaches
 * to any access granted in the OS since launch, then refetches every health
 * query. Nothing is sent anywhere; "sync" only means reading again locally.
 */
export async function syncHealthData(queryClient: QueryClient) {
  await useHealthStore.getState().restoreConnection();
  await queryClient.refetchQueries({ predicate: isHealthQuery });
  const failed = queryClient
    .getQueryCache()
    .findAll({ predicate: isHealthQuery })
    .some((query) => query.state.status === "error");
  if (!failed) useSettingsStore.getState().markSynced();
  return { ok: !failed };
}

export function useHealthSync() {
  const queryClient = useQueryClient();
  const lastSyncedAt = useSettingsStore((state) => state.lastSyncedAt);
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncHealthData(queryClient);
      setFailed(!result.ok);
    } catch {
      setFailed(true);
    } finally {
      setSyncing(false);
    }
  };

  return { sync, syncing, failed, lastSyncedAt };
}
