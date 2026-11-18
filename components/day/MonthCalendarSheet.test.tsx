import { fireEvent, render, screen } from "@testing-library/react-native";

import { useDayScores } from "@/hooks/useDayScores";

import { MonthCalendarSheet } from "./MonthCalendarSheet";

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

describe("MonthCalendarSheet", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 12) });
    mockScores.mockReset();
    mockScores.mockReturnValue({});
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("lays November 2026 out Monday first", async () => {
    await render(
      <MonthCalendarSheet
        visible
        month="2026-11"
        onClose={jest.fn()}
        onPick={jest.fn()}
      />,
    );
    const cells = screen.getAllByTestId(/^cal-cell-/);
    expect(cells).toHaveLength(42);
    // 1 Nov is a Sunday: six leading blanks (26-31 Oct), six rows, then 1 in the last column of week 1.
    expect(cells[6]!.props.testID).toBe("cal-cell-2026-11-01");
    expect(cells[0]!.props.testID).toBe("cal-cell-pad-0");
    expect(screen.getByLabelText(/^Sun, Nov 1,/)).toBeEnabled();
    expect(screen.getByLabelText(/^Thu, Nov 19,/)).toBeDisabled();
    expect(screen.getByLabelText(/^Next month/)).toBeDisabled();
    expect(screen.getByLabelText(/^Previous month/)).toBeEnabled();
  });

  it("shows the full month and year as title", async () => {
    await render(
      <MonthCalendarSheet
        visible
        month="2026-11"
        onClose={jest.fn()}
        onPick={jest.fn()}
      />,
    );
    expect(screen.getByText("November 2026")).toBeTruthy();
  });

  it("does not read scores while closed", async () => {
    await render(
      <MonthCalendarSheet
        visible={false}
        month="2026-11"
        onClose={jest.fn()}
        onPick={jest.fn()}
      />,
    );
    expect(mockScores).not.toHaveBeenCalled();
  });

  it("picks a day then closes", async () => {
    const onPick = jest.fn();
    const onClose = jest.fn();
    await render(
      <MonthCalendarSheet
        visible
        month="2026-11"
        onClose={onClose}
        onPick={onPick}
      />,
    );
    await fireEvent.press(screen.getByLabelText(/^Tue, Nov 3,/));
    expect(onPick).toHaveBeenCalledWith("2026-11-03");
    expect(onClose).toHaveBeenCalled();
  });

  it("moves between months and enables next", async () => {
    await render(
      <MonthCalendarSheet
        visible
        month="2026-11"
        onClose={jest.fn()}
        onPick={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText(/^Previous month/));
    expect(screen.getByLabelText(/^Sat, Oct 31/)).toBeEnabled();
    expect(screen.getByLabelText(/^Next month/)).toBeEnabled();
  });
});
