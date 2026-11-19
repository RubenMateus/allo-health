import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react-native";

import { MockHealthProvider } from "@/services/health/mockProvider";
import { loadDashboardData } from "@/services/health/dashboard";
import { useDayStore } from "@/stores/dayStore";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { EnergyScreen } from "./EnergyScreen";

jest.mock("@/hooks/useDayScores", () => ({ useDayScores: () => ({}) }));
let mockUsual: number | null = 40;
jest.mock("@/hooks/useEnergyUsual", () => ({
  useEnergyUsual: () => mockUsual,
}));
jest.mock("lucide-react-native", () => {
  const icon = () => null;
  return new Proxy({}, { get: () => icon });
});
jest.mock("react-native-reanimated", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    Easing: {
      out: () => undefined,
      cubic: undefined,
      inOut: () => undefined,
      ease: undefined,
    },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedProps: () => ({}),
    useAnimatedStyle: () => ({}),
    withRepeat: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

let client: QueryClient;

async function renderEnergy() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <EnergyScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("EnergyScreen", () => {
  beforeEach(() => {
    mockUsual = 40;
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 12) });
    useDayStore.setState({ selectedDay: null, todayKey: "2026-11-18" });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.useRealTimers();
  });

  it("shows today's balance, last charged, totals and coaching", async () => {
    const data = await loadDashboardData(new MockHealthProvider());
    const now = data.energyPoints.at(-1)!.value;
    await renderEnergy();
    expect(await screen.findByText("Energy Bank")).toBeTruthy();
    expect(await screen.findByText(`${now}`)).toBeTruthy();
    expect(screen.getByText(/^Last charged to \d+% at \d\d:\d\d$/)).toBeTruthy();
    expect(screen.getByText("Total charged")).toBeTruthy();
    expect(screen.getByText("Total drained")).toBeTruthy();
    expect(screen.getByText(/^Your Energy Bank is .* for 12:00\.$/)).toBeTruthy();
  });

  it("past day shows closing balance and close comparison", async () => {
    useDayStore.setState({ selectedDay: "2026-11-16" });
    const data = await loadDashboardData(
      new MockHealthProvider(),
      "mock",
      new Date(2026, 10, 16, 12),
    );
    await renderEnergy();
    expect(await screen.findByText("MONDAY'S DATA")).toBeTruthy();
    expect(screen.getByText(`${data.today.energy!.close}`)).toBeTruthy();
    expect(screen.getByText(/^You ended the day /)).toBeTruthy();
  });

  it("says it is still learning without a usual", async () => {
    mockUsual = null;
    await renderEnergy();
    expect(
      await screen.findByText(
        "Still learning your usual pattern. Check back after a few more days.",
      ),
    ).toBeTruthy();
  });

  it("empty state without readings", async () => {
    jest.setSystemTime(new Date(2026, 10, 18, 0, 2));
    await renderEnergy();
    expect(
      await screen.findByText(
        "Heart rate and HRV readings build your Energy Bank through the day.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Total charged")).toBeNull();
  });
});
