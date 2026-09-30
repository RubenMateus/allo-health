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
