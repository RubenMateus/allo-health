import { fromDayKey } from "@/services/journal";
import { formatDayLabel } from "@/utils/formatters";

/** Accessibility label shared by the strip and the calendar cells. */
export function dayCellLabel(key: string, recovery: number | null | undefined) {
  const day = formatDayLabel(fromDayKey(key));
  return recovery == null ? `${day}, no score` : `${day}, recovery ${recovery}`;
}
