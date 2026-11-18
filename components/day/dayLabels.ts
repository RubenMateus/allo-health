import { fromDayKey, shiftDayKey, toDayKey } from "@/services/journal";
import { formatDayLabel } from "@/utils/formatters";

/** Accessibility label shared by the strip and the calendar cells. */
export function dayCellLabel(key: string, recovery: number | null | undefined) {
  const day = formatDayLabel(fromDayKey(key));
  return recovery == null ? `${day}, no score` : `${day}, recovery ${recovery}`;
}

/** "YESTERDAY'S DATA" or "<WEEKDAY>'S DATA" for a past day. */
export function dayEyebrow(dayKey: string): string {
  if (dayKey === shiftDayKey(toDayKey(new Date()), -1))
    return "YESTERDAY'S DATA";
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    fromDayKey(dayKey),
  );
  return `${weekday.toUpperCase()}'S DATA`;
}
