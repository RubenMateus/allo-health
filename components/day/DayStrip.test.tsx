import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { useDayScores } from "@/hooks/useDayScores";
import { useDayStore } from "@/stores/dayStore";

import { DayStrip } from "./DayStrip";
import { recoveryDotColor } from "./recoveryDot";
import { darkColors } from "@/theme/tokens";

jest.mock("@/hooks/useDayScores");
// lucide ships untranspiled ESM; icons are irrelevant here.
jest.mock("lucide-react-native", () => ({
  ChevronDown: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  X: () => null,
}));
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));

const mockScores = jest.mocked(useDayScores);

const score = (recovery: number | null) =>
  ({ recovery }) as unknown as NonNullable<
    ReturnType<typeof useDayScores>[string]
  >;

async function swipeToPreviousWeek() {
  await fireEvent(screen.getByTestId("day-strip"), "accessibilityAction", {
    nativeEvent: { actionName: "decrement" },
  });
}

describe("DayStrip", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 12) });
    useDayStore.setState({ selectedDay: null });
    mockScores.mockReturnValue({
      "2026-11-16": score(80),
      "2026-11-17": score(null),
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows Mon 16 to Sun 22 with future days disabled", async () => {
    await render(<DayStrip />);
    expect(screen.getByLabelText(/^Mon, Nov 16, recovery 80/)).toBeEnabled();
    expect(screen.getByLabelText(/^Tue, Nov 17, no score/)).toBeEnabled();
    expect(screen.getByLabelText(/^Wed, Nov 18,/)).toBeEnabled();
    for (const day of [19, 20, 21, 22]) {
      expect(screen.getByLabelText(new RegExp(`Nov ${day},`))).toBeDisabled();
    }
    expect(screen.queryByLabelText(/Nov 15,/)).toBeNull();
  });

  it("selects a tapped day", async () => {
    await render(<DayStrip />);
    await fireEvent.press(screen.getByLabelText(/^Mon, Nov 16,/));
    expect(useDayStore.getState().selectedDay).toBe("2026-11-16");
  });

  it("browses to the previous week without changing the selection", async () => {
    await render(<DayStrip />);
    expect(screen.queryByText("Today")).toBeNull();
    await swipeToPreviousWeek();
    expect(screen.getByLabelText(/^Mon, Nov 9,/)).toBeEnabled();
    expect(screen.getByLabelText(/^Sun, Nov 15,/)).toBeEnabled();
    expect(screen.queryByLabelText(/Nov 16,/)).toBeNull();
    expect(useDayStore.getState().selectedDay).toBeNull();
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("never browses past this week", async () => {
    await render(<DayStrip />);
    await fireEvent(screen.getByTestId("day-strip"), "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    expect(screen.getByLabelText(/^Mon, Nov 16,/)).toBeTruthy();
  });

  it("Today pill returns to this week and today", async () => {
    useDayStore.setState({ selectedDay: "2026-11-10" });
    await render(<DayStrip />);
    expect(screen.getByLabelText(/^Tue, Nov 10,/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Today"));
    expect(useDayStore.getState().selectedDay).toBeNull();
    expect(screen.getByLabelText(/^Mon, Nov 16,/)).toBeTruthy();
    expect(screen.queryByText("Today")).toBeNull();
  });

  it("follows the selected day into its week", async () => {
    await render(<DayStrip />);
    await act(async () => useDayStore.getState().selectDay("2026-11-03"));
    expect(screen.getByLabelText(/^Mon, Nov 2,/)).toBeTruthy();
  });

  it("labels the week by its Thursday", async () => {
    useDayStore.setState({ selectedDay: "2026-10-28" });
    await render(<DayStrip />);
    expect(screen.getByLabelText(/^Pick a day, Oct 2026/)).toBeTruthy();
    expect(screen.getByText(/Oct 2026/)).toBeTruthy();
    expect(screen.getByLabelText(/^Sun, Nov 1,/)).toBeTruthy();
  });

  it("opens the month calendar and picks a day", async () => {
    await render(<DayStrip />);
    await fireEvent.press(screen.getByLabelText(/^Pick a day, Nov 2026/));
    await fireEvent.press(screen.getByLabelText(/^Tue, Nov 3,/));
    expect(useDayStore.getState().selectedDay).toBe("2026-11-03");
  });
});

describe("recoveryDotColor", () => {
  it("maps score bands to colours", () => {
    expect(recoveryDotColor(80, darkColors)).toBe(darkColors.primary);
    expect(recoveryDotColor(75, darkColors)).toBe(darkColors.primary);
    expect(recoveryDotColor(60, darkColors)).toBe(darkColors.stress);
    expect(recoveryDotColor(50, darkColors)).toBe(darkColors.stress);
    expect(recoveryDotColor(30, darkColors)).toBe(darkColors.error);
    expect(recoveryDotColor(null, darkColors)).toBeNull();
  });
});
