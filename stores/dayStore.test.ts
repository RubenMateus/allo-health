import { toDayKey } from "@/services/journal";

import { useDayStore } from "./dayStore";

describe("day store", () => {
  beforeEach(() => {
    useDayStore.setState({ selectedDay: null, leftOn: toDayKey(new Date()) });
  });

  it("selects a past day", () => {
    useDayStore.getState().selectDay("2026-11-16", new Date(2026, 10, 18, 12));
    expect(useDayStore.getState().selectedDay).toBe("2026-11-16");
  });

  it("stores null for today or a future day", () => {
    const now = new Date(2026, 10, 18, 12);
    useDayStore.getState().selectDay("2026-11-16", now);
    useDayStore.getState().selectDay("2026-11-18", now);
    expect(useDayStore.getState().selectedDay).toBeNull();
    useDayStore.getState().selectDay("2026-11-16", now);
    useDayStore.getState().selectDay("2026-11-25", now);
    expect(useDayStore.getState().selectedDay).toBeNull();
  });

  it("goToToday clears the selection", () => {
    useDayStore.setState({ selectedDay: "2026-11-10" });
    useDayStore.getState().goToToday();
    expect(useDayStore.getState().selectedDay).toBeNull();
  });

  it("resets on a new day", () => {
    useDayStore.setState({ selectedDay: "2026-11-10", leftOn: "2026-11-17" });
    useDayStore.getState().resetIfNewDay(new Date(2026, 10, 18, 8));
    expect(useDayStore.getState().selectedDay).toBeNull();
    expect(useDayStore.getState().leftOn).toBe("2026-11-18");
  });

  it("keeps the selection on the same day", () => {
    useDayStore.setState({ selectedDay: "2026-11-10", leftOn: "2026-11-17" });
    useDayStore.getState().resetIfNewDay(new Date(2026, 10, 17, 23));
    expect(useDayStore.getState().selectedDay).toBe("2026-11-10");
  });
});
