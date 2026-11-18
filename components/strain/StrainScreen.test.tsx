import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react-native";

import { useDayStore } from "@/stores/dayStore";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { StrainScreen } from "./StrainScreen";

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
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

let client: QueryClient;

async function renderStrain() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <StrainScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("StrainScreen day navigation", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 12) });
    useDayStore.setState({ selectedDay: null });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.useRealTimers();
  });

  it("shows today's target on today", async () => {
    await renderStrain();
    expect(await screen.findByText(/TARGET TODAY/)).toBeTruthy();
    expect(screen.queryByText(/DATA$/)).toBeNull();
  });

  it("names the weekday and hides the target on a past day", async () => {
    useDayStore.setState({ selectedDay: "2026-11-16" });
    await renderStrain();
    expect(await screen.findByText("MONDAY'S DATA")).toBeTruthy();
    expect(screen.queryByText(/TARGET/)).toBeNull();
  });
});
