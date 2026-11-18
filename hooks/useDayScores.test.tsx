import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useDayScores } from "@/hooks/useDayScores";
import { mockHealthProvider } from "@/services/health/provider";
import { shiftDayKey, toDayKey } from "@/services/journal";
import { useHealthStore } from "@/stores/healthStore";

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

describe("useDayScores", () => {
  beforeEach(() => useHealthStore.setState({ provider: mockHealthProvider }));
  afterEach(async () => {
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
  });

  it("includes today's live score when today is in range", async () => {
    const today = toDayKey(new Date());
    const { result } = await renderHook(
      () => useDayScores(shiftDayKey(today, -3), today),
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(result.current[today]).not.toBeNull();
      expect(result.current[today]?.date).toBe(today);
      expect(result.current[shiftDayKey(today, -1)]).toBeTruthy();
    });
  });

  it("leaves today out of a range that ends before it", async () => {
    const today = toDayKey(new Date());
    const { result } = await renderHook(
      () => useDayScores(shiftDayKey(today, -4), shiftDayKey(today, -2)),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(3));
    expect(result.current[today]).toBeUndefined();
  });
});
