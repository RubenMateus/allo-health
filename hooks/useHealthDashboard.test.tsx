import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { shiftDayKey, toDayKey } from "@/services/journal";
import { mockHealthProvider } from "@/services/health/provider";
import { useDayStore } from "@/stores/dayStore";
import { useHealthStore } from "@/stores/healthStore";

import { useDayDashboard, useHealthDashboard } from "./useHealthDashboard";

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

const today = toDayKey(new Date());
const past = shiftDayKey(today, -5);

describe("dashboard hooks", () => {
  beforeEach(() => {
    useHealthStore.setState({ provider: mockHealthProvider });
    useDayStore.setState({ selectedDay: past, todayKey: today });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
  });

  it("keeps useHealthDashboard on today while useDayDashboard follows the selected day", async () => {
    const { result } = await renderHook(
      () => ({ home: useHealthDashboard(), day: useDayDashboard() }),
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(result.current.home.data).toBeDefined();
      expect(result.current.day.data).toBeDefined();
    });
    expect(result.current.home.data?.date).toBe(today);
    expect(result.current.day.data?.date).toBe(past);
  });

  it("errors on a past day without falling back to the mock provider", async () => {
    const failing = { ...mockHealthProvider, kind: "apple" } as never;
    for (const key of Object.getOwnPropertyNames(
      Object.getPrototypeOf(mockHealthProvider),
    )) {
      if (key.startsWith("get"))
        (failing as Record<string, unknown>)[key] = () =>
          Promise.reject(new Error("no access"));
    }
    useHealthStore.setState({ provider: failing });

    const { result } = await renderHook(() => useDayDashboard(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useHealthStore.getState().provider).toBe(failing);
  });

  it("shares today's cache entry between both hooks", async () => {
    useDayStore.setState({ selectedDay: null });
    const spy = jest.spyOn(mockHealthProvider, "getSleep");
    const { result } = await renderHook(
      () => ({ home: useHealthDashboard(), day: useDayDashboard() }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.day.data).toBeDefined());
    expect(result.current.day.data).toBe(result.current.home.data);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
