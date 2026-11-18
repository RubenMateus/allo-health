import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { usePeriodSummary } from "@/hooks/usePeriodSummary";
import { mockHealthProvider } from "@/services/health/provider";
import { toDayKey } from "@/services/journal";
import { periodContaining, shiftPeriod } from "@/services/metrics/summary";
import { useHealthStore } from "@/stores/healthStore";

jest.mock("@/services/journal/storage", () => ({
  journalStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

const clients: QueryClient[] = [];

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe("usePeriodSummary", () => {
  beforeEach(() => useHealthStore.setState({ provider: mockHealthProvider }));
  afterEach(async () => {
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
  });

  it("the current week ends at today and has suggestions once loaded", async () => {
    const today = toDayKey(new Date());
    const week = periodContaining("week", today);
    const { result } = await renderHook(() => usePeriodSummary(week), {
      wrapper: wrapper(),
    });
    expect(result.current.days[result.current.days.length - 1]).toBe(today);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(Array.isArray(result.current.suggestions)).toBe(true);
    expect(result.current.workouts).not.toBeNull();
  });

  it("an older week has no suggestions", async () => {
    const week = shiftPeriod(periodContaining("week", toDayKey(new Date())), -3);
    const { result } = await renderHook(() => usePeriodSummary(week), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.days).toHaveLength(7);
    expect(result.current.suggestions).toBeNull();
    expect(result.current.scores.scoredDays).toBeGreaterThan(0);
  });
});
