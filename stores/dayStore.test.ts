import { toDayKey } from "@/services/journal";

import { msUntilNextDay, useDayStore } from "./dayStore";

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

  it("rolls today over at midnight while the app stays open", () => {
    useDayStore.setState({ todayKey: "2026-11-17", selectedDay: "2026-11-10" });
    useDayStore.getState().rollToday(new Date(2026, 10, 18, 0, 0, 1));
    expect(useDayStore.getState().todayKey).toBe("2026-11-18");
    // A browsed past day stays selected.
    expect(useDayStore.getState().selectedDay).toBe("2026-11-10");
  });

  it("keeps today on the same day", () => {
    useDayStore.setState({ todayKey: "2026-11-18", selectedDay: null });
    useDayStore.getState().rollToday(new Date(2026, 10, 18, 23, 59));
    expect(useDayStore.getState().todayKey).toBe("2026-11-18");
  });

  it("waits until just after the next local midnight", () => {
    expect(msUntilNextDay(new Date(2026, 10, 18, 23, 59, 0))).toBe(61_000);
  });
});
