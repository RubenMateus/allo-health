import type { BiomarkerKind, HealthSample } from "@/services/health/types";
import type { BiomarkerTone } from "@/services/metrics";
import type { ColorTokens } from "@/theme/tokens";
import {
  formatMass,
  formatNumber,
  massInDisplayUnit,
} from "@/utils/formatters";

type BiomarkerMeta = {
  title: string;
  /** Accent for charts, as a theme colour key so light mode picks its own value. */
  accent: keyof ColorTokens;
  about: string;
  /** How the status word is worked out when it is a rating, not a trend. */
  ratingNote?: string;
  format: (value: number) => { value: string; unit: string };
  /** The value in the unit the chart axis shows. */
  chartValue?: (value: number) => number;
};

const plain =
  (unit: string, fractionDigits = 0) =>
  (value: number) => ({ value: formatNumber(value, fractionDigits), unit });

export const biomarkerMeta: Record<BiomarkerKind, BiomarkerMeta> = {
  weight: {
    title: "Weight",
    accent: "blue",
    about:
      "Body weight from your scale or manual entries. Day-to-day swings of a kilo or so are mostly water, so the trend compares your last week with the month before it.",
    format: (value) => formatMass(value, 1),
    chartValue: massInDisplayUnit,
  },
  hrv: {
    title: "HRV baseline",
    accent: "primary",
    about:
      "Heart rate variability, the variation in time between heartbeats. Higher than your own baseline usually means good recovery; a drop can follow hard training, poor sleep, alcohol or illness. Apple Health reports SDNN and Health Connect reports RMSSD, which aren't comparable with each other.",
    format: plain("ms"),
  },
  restingHeartRate: {
    title: "RHR baseline",
    accent: "salmon",
    about:
      "Your heart rate at rest, usually measured overnight or while still. It falls as aerobic fitness improves and tends to rise with stress, illness or overtraining.",
    ratingNote:
      "Rated on general adult ranges: under 55 bpm excellent, 55–64 good, 65–74 fair, 75 and above elevated.",
    format: plain("bpm"),
  },
  bodyFat: {
    title: "Body fat percentage",
    accent: "stress",
    about:
      "The share of your weight that is fat, from a smart scale or another device. Readings vary with hydration and time of day, so compare at the same time each week.",
    ratingNote:
      "Rated on the American Council on Exercise categories for your sex: athletic, fit, average and high.",
    format: plain("%", 1),
  },
  leanBodyMass: {
    title: "Lean body mass",
    accent: "protein",
    about:
      "Everything that isn't fat: muscle, bone, organs and water. Holding or growing it while losing weight means the loss is coming from fat.",
    format: (value) => formatMass(value, 1),
    chartValue: massInDisplayUnit,
  },
  vo2Max: {
    title: "VO₂ max",
    accent: "vo2",
    about:
      "The most oxygen your body can use during hard exercise, per kilo of body weight. It is one of the strongest markers of cardiovascular fitness and long-term health. Watches estimate it from outdoor walks and runs.",
    ratingNote:
      "Rated against the FRIEND registry reference standards (Kaminsky et al., 2022) for your age and sex: superior is the top 20%, then excellent, good, fair and poor.",
    format: plain("ml/kg/min", 1),
  },
  bloodOxygen: {
    title: "Blood oxygen",
    accent: "blue",
    about:
      "The share of your red blood cells carrying oxygen (SpO₂). Healthy readings sit between 95% and 100%; wrist sensors are less precise than a fingertip clip.",
    ratingNote: "95% and above is normal, 90–94% low, under 90% very low.",
    format: plain("%", 1),
  },
  respiratoryRate: {
    title: "Respiratory rate",
    accent: "sleep",
    about:
      "Breaths per minute, measured while you sleep. It is very stable from night to night, so a rise above your baseline can be an early sign of illness.",
    format: plain("br/min", 1),
  },
};

export function displayValue(kind: BiomarkerKind, sample: HealthSample) {
  return biomarkerMeta[kind].format(sample.value);
}

export function chartValues(kind: BiomarkerKind, samples: HealthSample[]) {
  const convert = biomarkerMeta[kind].chartValue ?? ((value: number) => value);
  return samples.map((sample) => convert(sample.value));
}

export function toneColor(tone: BiomarkerTone, colors: ColorTokens) {
  return tone === "positive"
    ? colors.primary
    : tone === "caution"
      ? colors.stress
      : tone === "alert"
        ? colors.strainEnd
        : colors.textMuted;
}
