import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react-native";

import { useDayStore } from "@/stores/dayStore";
import { useJournalStore } from "@/stores/journalStore";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { JournalScreen } from "./JournalScreen";

jest.mock("@/services/journal/storage", () => ({
  journalStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));
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

const entry = (date: string) => ({
  date,
  mood: 4 as const,
  energy: 3 as const,
  tags: [],
  note: "",
  updatedAt: "2026-11-18T08:00:00.000Z",
});

let client: QueryClient;

async function renderJournal() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <JournalScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("JournalScreen day navigation", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 12) });
    useDayStore.setState({ selectedDay: null });
    useJournalStore.setState({
      entries: [entry("2026-11-16"), entry("2026-11-14")],
      hydrated: true,
      loadFailed: false,
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.useRealTimers();
  });

  it("marks the entry for the chosen past day", async () => {
    useDayStore.setState({ selectedDay: "2026-11-16" });
    await renderJournal();
    expect(
      screen.getByTestId("journal-entry-2026-11-16").props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId("journal-entry-2026-11-14").props.accessibilityState,
    ).toEqual({ selected: false });
  });

  it("marks nothing on today or a day without an entry", async () => {
    useDayStore.setState({ selectedDay: "2026-11-15" });
    await renderJournal();
    expect(
      screen.getByTestId("journal-entry-2026-11-16").props.accessibilityState,
    ).toEqual({ selected: false });
  });
});
