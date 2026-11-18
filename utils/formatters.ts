const locale = Intl.DateTimeFormat().resolvedOptions().locale;
const region = locale.split("-").at(-1)?.toUpperCase();
const usesMetricDisplay = !["US", "LR", "MM"].includes(region ?? "");

export function formatToday(date = new Date()): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/** A time of day on the 24-hour clock, e.g. `23:15`, for chart axes. */
export function formatClock(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatEnergy(kilocalories: number): {
  value: string;
  unit: "kcal" | "kJ";
} {
  const value = usesMetricDisplay ? kilocalories * 4.184 : kilocalories;
  const unit = usesMetricDisplay ? "kJ" : "kcal";
  return {
    value: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
      Math.round(value),
    ),
    unit,
  };
}

export function formatGlucose(milligramsPerDeciliter: number): {
  value: string;
  unit: "mg/dL" | "mmol/L";
  target: readonly [number, number];
} {
  return usesMetricDisplay
    ? {
        value: (milligramsPerDeciliter / 18.018).toFixed(1),
        unit: "mmol/L",
        target: [3.9, 10],
      }
    : {
        value: Math.round(milligramsPerDeciliter).toString(),
        unit: "mg/dL",
        target: [70, 180],
      };
}

export function convertGlucose(
  value: number,
  sourceUnit: "mg/dL" | "mmol/L",
): number {
  if (usesMetricDisplay && sourceUnit === "mg/dL") return value / 18.018;
  if (!usesMetricDisplay && sourceUnit === "mmol/L") return value * 18.018;
  return value;
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Formats a local YYYY-MM-DD day key, e.g. "28 Aug" or "Aug 28" by locale. */
export function formatDay(dayKey: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dayKey}T12:00:00`));
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Full month name ("November"); the year is added when asked or when it is not the current year. */
export function formatMonthName(date: Date, withYear = false): string {
  const showYear = withYear || date.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    ...(showYear ? { year: "numeric" } : {}),
  }).format(date);
}

export function formatMass(
  kilograms: number,
  fractionDigits = 0,
): {
  value: string;
  unit: "kg" | "lb";
} {
  const value = usesMetricDisplay ? kilograms : kilograms * 2.20462;
  return {
    value: formatNumber(value, fractionDigits),
    unit: usesMetricDisplay ? "kg" : "lb",
  };
}

export function formatSyncedAt(value: string, now = new Date()): string {
  const date = new Date(value);
  const time = formatTime(value);
  return date.toDateString() === now.toDateString()
    ? `Today, ${time}`
    : `${formatDayLabel(date)}, ${time}`;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Converts kilograms to the display unit without formatting, for charts. */
export function massInDisplayUnit(kilograms: number): number {
  return usesMetricDisplay ? kilograms : kilograms * 2.20462;
}

/** Meters in one display distance unit, and its label: km, or miles in the US. */
export const distanceUnit = usesMetricDisplay
  ? { meters: 1000, label: "km" }
  : { meters: 1609.344, label: "mi" };

export function formatDistance(
  meters: number,
  fractionDigits = 2,
): { value: string; unit: string } {
  return {
    value: formatNumber(meters / distanceUnit.meters, fractionDigits),
    unit: distanceUnit.label,
  };
}

/** Pace as minutes'seconds" per display unit, e.g. 5'01". */
export function formatPace(secondsPerUnit: number): string {
  const rounded = Math.round(secondsPerUnit);
  const minutes = Math.floor(rounded / 60);
  const seconds = `${rounded % 60}`.padStart(2, "0");
  return `${minutes}'${seconds}"`;
}

/** Speed in km/h, or mph in the US. */
export function formatSpeed(metersPerSecond: number): {
  value: string;
  unit: string;
} {
  return {
    value: formatNumber((metersPerSecond * 3600) / distanceUnit.meters, 1),
    unit: usesMetricDisplay ? "km/h" : "mph",
  };
}

/** Elapsed time with seconds, e.g. "52m 18s" or "1h 05m". */
export function formatElapsed(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  if (hours > 0) return `${hours}h ${`${minutes}`.padStart(2, "0")}m`;
  return `${minutes}m ${`${rounded % 60}`.padStart(2, "0")}s`;
}

/** Elevation in meters, or feet in the US. */
export function formatElevation(meters: number): {
  value: string;
  unit: string;
} {
  return usesMetricDisplay
    ? { value: formatNumber(meters), unit: "m" }
    : { value: formatNumber(meters * 3.28084), unit: "ft" };
}
