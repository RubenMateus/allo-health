import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { usePeriodSummary, type PeriodSummaryData } from "@/hooks/usePeriodSummary";
import type { DailyScore } from "@/services/metrics/daily";
import { summarizeJournal, summarizeScores } from "@/services/metrics/summary";
import { useDayStore } from "@/stores/dayStore";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { formatDelta, periodFromParams, SummaryScreen } from "./SummaryScreen";

jest.mock("@/hooks/usePeriodSummary", () => ({ usePeriodSummary: jest.fn() }));
jest.mock("lucide-react-native", () => {
  const icon = () => null;
  return new Proxy({}, { get: () => icon });
});
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
    setParams: jest.fn(),
    dismissTo: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
}));

const mockSummary = jest.mocked(usePeriodSummary);
const signal = { value: null, baseline: 0, baselineDays: 0, building: true };
const score = (date: string, recovery: number): DailyScore => ({
  date,
  recovery,
  strain: 10,
  sleepScore: 75,
  strainBreakdown: null,
  recoveryInputs: { hrv: signal, restingHeartRate: signal, respiratoryRate: signal, sleepScore: 75 },
  energy: null,
  computedAt: `${date}T23:00:00Z`,
});

function data(scores: DailyScore[], suggestions: PeriodSummaryData["suggestions"]): PeriodSummaryData {
  const days = scores.map((s) => s.date);
  return {
    loading: false,
    days,
    scoresByDay: Object.fromEntries(scores.map((s) => [s.date, s])),
    scores: summarizeScores(scores, []),
    workouts: null,
    journal: summarizeJournal([], { kind: "week", start: "2000-01-01", end: "2000-01-07" }),
    suggestions,
  };
}

const threeDays = [score("2026-11-16", 80), score("2026-11-17", 40), score("2026-11-18", 60)];
let client: QueryClient;

async function renderSummary() {
  client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <SummaryScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("SummaryScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 17, 30) });
    useDayStore.setState({ selectedDay: null, todayKey: "2026-11-18" });
    mockParams = {};
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.useRealTimers();
  });

  it("the current week says so far and can't step forward", async () => {
    mockSummary.mockReturnValue(data(threeDays, []));
    await renderSummary();
    expect(screen.getByText("SO FAR")).toBeTruthy();
    expect(screen.getByLabelText("Next week").props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByLabelText("Previous week"));
    expect(router.setParams).toHaveBeenCalledWith({ period: "week", start: "2026-11-09" });
  });

  it("shows suggestions under Next week when there are some", async () => {
    mockSummary.mockReturnValue(
      data(threeDays, [{ id: "sleep", text: "Sleep was the weak spot." }]),
    );
    await renderSummary();
    expect(screen.getByText("Next week")).toBeTruthy();
    expect(screen.getByText("Sleep was the weak spot.")).toBeTruthy();
  });

  it("an older week has no Next week section", async () => {
    mockParams = { period: "week", start: "2026-10-26" };
    mockSummary.mockReturnValue(data(threeDays, null));
    await renderSummary();
    expect(screen.queryByText("Next week")).toBeNull();
    expect(screen.queryByText("SO FAR")).toBeNull();
  });

  it("tapping the best day opens that day on Home", async () => {
    mockSummary.mockReturnValue(data(threeDays, []));
    await renderSummary();
    fireEvent.press(screen.getByLabelText(/^Best day/));
    expect(useDayStore.getState().selectedDay).toBe("2026-11-16");
    expect(router.dismissTo).toHaveBeenCalledWith("/");
  });

  it("fewer than 3 scored days shows not enough data", async () => {
    mockSummary.mockReturnValue(data(threeDays.slice(0, 2), []));
    await renderSummary();
    expect(screen.getByText("Not enough data yet")).toBeTruthy();
    expect(screen.queryByText("Averages")).toBeNull();
  });

  it("month summary is titled by month", async () => {
    mockParams = { period: "month", start: "2026-10-01" };
    mockSummary.mockReturnValue(data(threeDays, null));
    await renderSummary();
    expect(screen.getByText("Month summary")).toBeTruthy();
    expect(screen.getByText("October 2026")).toBeTruthy();
  });
});

describe("periodFromParams", () => {
  it("falls back to the current week for bad or future params", () => {
    expect(periodFromParams({}, "2026-11-18").start).toBe("2026-11-16");
    expect(periodFromParams({ period: "week", start: "nonsense" }, "2026-11-18").start).toBe("2026-11-16");
    expect(periodFromParams({ period: "month", start: "2027-01-01" }, "2026-11-18").start).toBe("2026-11-01");
  });
});

describe("formatDelta", () => {
  it("rounds before choosing the sign, so tiny changes read as no change", () => {
    expect(formatDelta(-0.4)).toBe("±0");
    expect(formatDelta(0.4)).toBe("±0");
    expect(formatDelta(3.6)).toBe("+4");
    expect(formatDelta(-2.2)).toBe("−2");
    expect(formatDelta(-0.04, 1)).toBe("±0.0");
    expect(formatDelta(0.46, 1)).toBe("+0.5");
  });
});

it("the week's load balance chart shows only that week's 7 days", async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 18, 17, 30) });
  useDayStore.setState({ selectedDay: null, todayKey: "2026-11-18" });
  mockParams = { period: "week", start: "2026-11-09" };
  const week = ["09", "10", "11", "12", "13", "14", "15"].map((d) => score(`2026-11-${d}`, 60));
  mockSummary.mockReturnValue(data(week, null));
  await renderSummary();
  expect(screen.queryByText("Nov 2")).toBeNull();
  await cleanup();
  client.clear();
  jest.useRealTimers();
});

describe("SummaryScreen review fixes", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 17, 30) });
    useDayStore.setState({ selectedDay: null, todayKey: "2026-11-18" });
    mockParams = {};
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.useRealTimers();
  });

  it("the current week's load balance chart starts on its Monday", async () => {
    mockSummary.mockReturnValue(data(threeDays, []));
    await renderSummary();
    expect(screen.queryByText("Nov 12")).toBeNull();
    expect(screen.getAllByText("Nov 16").length).toBeGreaterThan(0);
  });

  it("shows no headline average or change without enough data", async () => {
    const two = data(threeDays.slice(0, 2), []);
    two.scores = { ...two.scores, deltas: { recovery: 8, strain: null, sleep: null } };
    mockSummary.mockReturnValue(two);
    await renderSummary();
    expect(screen.queryByText(/VS LAST WEEK/)).toBeNull();
    expect(screen.queryByText("60")).toBeNull();
  });
});
