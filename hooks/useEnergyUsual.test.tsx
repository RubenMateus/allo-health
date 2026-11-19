import { renderHook } from "@testing-library/react-native";

import { useEnergyUsual } from "@/hooks/useEnergyUsual";
import { MockHealthProvider } from "@/services/health/mockProvider";
import type { DailyScore } from "@/services/metrics/daily";
import { useHealthStore } from "@/stores/healthStore";

jest.mock("@/hooks/useDayScores", () => ({
  useDayScores: () => mockScores,
}));

const day = (date: string, at9: number) =>
  ({
    date,
    energy: {
      hourly: Array.from({ length: 25 }, (_, h) => (h === 9 ? at9 : 50)),
      charged: 0,
      drained: 0,
      close: 50,
      lastCharged: null,
    },
  }) as DailyScore;
let mockScores: Record<string, DailyScore | null> = {};

describe("useEnergyUsual", () => {
  beforeEach(() => {
    mockScores = Object.fromEntries(
      [10, 11, 12, 13, 14, 15].map((d) => [
        `2026-11-${d}`,
        day(`2026-11-${d}`, 60),
      ]),
    );
  });

  it("never compares against sample data", async () => {
    useHealthStore.setState({ provider: new MockHealthProvider() });
    const { result } = await renderHook(() => useEnergyUsual("2026-11-18", 9));
    expect(result.current).toBeNull();
  });

  it("gives the usual from real stored days", async () => {
    const provider = new MockHealthProvider();
    Object.defineProperty(provider, "kind", { value: "apple" });
    useHealthStore.setState({ provider });
    const { result } = await renderHook(() => useEnergyUsual("2026-11-18", 9));
    expect(result.current).toBe(60);
  });
});
