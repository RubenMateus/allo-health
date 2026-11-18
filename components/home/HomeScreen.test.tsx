import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react-native";

import { useDayStore } from "@/stores/dayStore";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { HomeScreen } from "./HomeScreen";

jest.mock("@/hooks/useDayScores", () => ({ useDayScores: () => ({}) }));
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

let client: QueryClient;

async function renderHome() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("Daily readiness");
}

describe("HomeScreen day navigation", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 12) });
    useDayStore.setState({ selectedDay: null });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.useRealTimers();
  });

  it("shows the coach on today", async () => {
    await renderHome();
    expect(await screen.findByText("AI readiness")).toBeTruthy();
    expect(screen.getByText(/TARGET STRAIN/)).toBeTruthy();
  });

  it("hides the coach and labels the weekday on a past day", async () => {
    useDayStore.setState({ selectedDay: "2026-11-16" });
    await renderHome();
    expect(await screen.findByText("MONDAY'S DATA")).toBeTruthy();
    expect(screen.queryByText("AI readiness")).toBeNull();
    expect(screen.queryByText(/TARGET STRAIN/)).toBeNull();
  });

  it("labels yesterday", async () => {
    useDayStore.setState({ selectedDay: "2026-11-17" });
    await renderHome();
    expect(await screen.findByText("YESTERDAY'S DATA")).toBeTruthy();
  });

  it("shows the chosen day in the header while its data loads", async () => {
    useDayStore.setState({ selectedDay: "2026-11-16" });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <HomeScreen />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Monday, November 16")).toBeTruthy();
    await screen.findByText("Daily readiness");
  });
});
