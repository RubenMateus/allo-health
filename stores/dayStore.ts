import { useEffect } from "react";
import { AppState } from "react-native";
import { create } from "zustand";

import { toDayKey } from "@/services/journal";

type DayStore = {
  /** Past day being browsed, or null for today. Not persisted. */
  selectedDay: string | null;
  /** Day key when the app was last left (or last reset). */
  leftOn: string;
  selectDay: (key: string, now?: Date) => void;
  goToToday: () => void;
  resetIfNewDay: (now?: Date) => void;
};

export const useDayStore = create<DayStore>((set, get) => ({
  selectedDay: null,
  leftOn: toDayKey(new Date()),
  selectDay: (key, now = new Date()) =>
    set({ selectedDay: key >= toDayKey(now) ? null : key }),
  goToToday: () => set({ selectedDay: null }),
  resetIfNewDay: (now = new Date()) => {
    const today = toDayKey(now);
    if (today !== get().leftOn) set({ selectedDay: null, leftOn: today });
  },
}));

export function useSelectedDayKey(): string {
  const selectedDay = useDayStore((s) => s.selectedDay);
  return selectedDay ?? toDayKey(new Date());
}

export function useIsToday(): boolean {
  return useDayStore((s) => s.selectedDay === null);
}

export function useResetDayOnForeground(): void {
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
