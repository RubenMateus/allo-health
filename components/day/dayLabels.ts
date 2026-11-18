import { fromDayKey, shiftDayKey, toDayKey } from "@/services/journal";
import { useBrowsedDay, useTodayKey } from "@/stores/dayStore";
import { formatDayLabel } from "@/utils/formatters";

/** Accessibility label shared by the strip and the calendar cells. */
export function dayCellLabel(key: string, recovery: number | null | undefined) {
  const day = formatDayLabel(fromDayKey(key));
  return recovery == null ? `${day}, no score` : `${day}, recovery ${recovery}`;
}

/** "YESTERDAY'S DATA" or "<WEEKDAY>'S DATA" for a past day. */
export function dayEyebrow(
  dayKey: string,
  todayKey = toDayKey(new Date()),
): string {
  if (dayKey === shiftDayKey(todayKey, -1))
    return "YESTERDAY'S DATA";
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    fromDayKey(dayKey),
  );
  return `${weekday.toUpperCase()}'S DATA`;
}

/** The eyebrow for the day being browsed, or undefined when showing today. */
export function usePastDayEyebrow(): string | undefined {
  const browsed = useBrowsedDay();
  const todayKey = useTodayKey();
  return browsed === null ? undefined : dayEyebrow(browsed, todayKey);
}
