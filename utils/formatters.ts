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

export function formatMass(kilograms: number): {
  value: string;
  unit: "kg" | "lb";
} {
  const value = usesMetricDisplay ? kilograms : kilograms * 2.20462;
  return {
    value: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
      Math.round(value),
    ),
    unit: usesMetricDisplay ? "kg" : "lb",
  };
}
