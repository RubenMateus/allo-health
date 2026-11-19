import { useEffect } from "react";
import { AppState } from "react-native";
import { create } from "zustand";

import { toDayKey } from "@/services/journal";

type DayStore = {
  /** Past day being browsed, or null for today. Not persisted. */
  selectedDay: string | null;
  /** Day key when the app was last left (or last reset). */
  leftOn: string;
  /** Today's day key; rolls over at local midnight while the app is open. */
  todayKey: string;
  selectDay: (key: string, now?: Date) => void;
  goToToday: () => void;
  resetIfNewDay: (now?: Date) => void;
  /** Moves `todayKey` to the current day. A selection that is now today becomes null. */
  rollToday: (now?: Date) => void;
};

export const useDayStore = create<DayStore>((set, get) => ({
  selectedDay: null,
  leftOn: toDayKey(new Date()),
  todayKey: toDayKey(new Date()),
  selectDay: (key, now = new Date()) =>
    set({ selectedDay: key >= toDayKey(now) ? null : key }),
  goToToday: () => set({ selectedDay: null }),
  resetIfNewDay: (now = new Date()) => {
    const today = toDayKey(now);
    if (today !== get().leftOn)
      set({ selectedDay: null, leftOn: today, todayKey: today });
    else get().rollToday(now);
  },
  rollToday: (now = new Date()) => {
    const today = toDayKey(now);
    const { todayKey, selectedDay } = get();
    if (today === todayKey) return;
    set({
      todayKey: today,
      selectedDay: selectedDay !== null && selectedDay >= today ? null : selectedDay,
    });
  },
}));

/** Today's day key, re-rendering the caller when the day rolls over. */
export function useTodayKey(): string {
  return useDayStore((s) => s.todayKey);
}

/** Milliseconds from `now` until just after the next local midnight. */
export function msUntilNextDay(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  return next.getTime() - now.getTime();
}

export function useSelectedDayKey(): string {
  const selectedDay = useDayStore((s) => s.selectedDay);
  const todayKey = useTodayKey();
  return selectedDay ?? todayKey;
}

/** The past day being browsed, or null when showing today. */
export function useBrowsedDay(): string | null {
  return useDayStore((s) => s.selectedDay);
}

export function useIsToday(): boolean {
  return useDayStore((s) => s.selectedDay === null);
}

export function useResetDayOnForeground(): void {
  // Roll "today" over at midnight while the app stays open.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        useDayStore.getState().rollToday();
        schedule();
      }, msUntilNextDay(new Date()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        useDayStore.getState().resetIfNewDay();
      } else if (state === "background") {
        useDayStore.setState({ leftOn: toDayKey(new Date()) });
      }
    });
    return () => subscription.remove();
  }, []);
}
