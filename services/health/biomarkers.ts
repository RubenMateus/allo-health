import {
  ageOn,
  fitnessAge,
  summarizeBiomarker,
  vo2MaxPercentile,
  type BiomarkerSummary,
} from "@/services/metrics";

import type {
  BiomarkerKind,
  HealthProfile,
  HealthProvider,
  HealthSample,
} from "./types";

export const BIOMARKER_HISTORY_DAYS = 365;

export const biomarkerKinds: BiomarkerKind[] = [
  "weight",
  "hrv",
  "restingHeartRate",
  "bodyFat",
  "leanBodyMass",
  "vo2Max",
  "bloodOxygen",
  "respiratoryRate",
];

export type FitnessAge = {
  /** Years, one decimal. */
  value: number;
  vo2Max: number;
  measuredAt: string;
  chronologicalAge: number | null;
  /** Estimated population percentile for the person's age and sex. */
  percentile: number | null;
};

export type Biomarker = BiomarkerSummary & { history: HealthSample[] };

export type BiomarkersData = {
  source: HealthProvider["kind"];
  profile: HealthProfile;
  age: number | null;
  fitnessAge: FitnessAge | null;
  biomarkers: Record<BiomarkerKind, Biomarker>;
};

export async function loadBiomarkers(
  provider: HealthProvider,
  savedProfile: HealthProfile,
  now = new Date(),
): Promise<BiomarkersData> {
  const since = new Date(now);
  since.setDate(now.getDate() - BIOMARKER_HISTORY_DAYS);
  since.setHours(0, 0, 0, 0);
  const [sourceProfile, ...histories] = await Promise.all([
    provider.getProfile().catch(() => null),
    // A type the person declined reads as empty rather than failing the screen.
    ...biomarkerKinds.map((kind) =>
      provider.getBiomarkerHistory(kind, since).catch(() => []),
    ),
  ]);
  // The health source wins where it has a value; the saved entry fills the gaps.
  const profile: HealthProfile = {
    birthDate: sourceProfile?.birthDate ?? savedProfile.birthDate,
    sex: sourceProfile?.sex ?? savedProfile.sex,
  };
  const age = profile.birthDate ? ageOn(profile.birthDate, now) : null;
  const biomarkers = Object.fromEntries(
    biomarkerKinds.map((kind, index) => {
      const history = histories[index] as HealthSample[];
      return [
        kind,
        { ...summarizeBiomarker(kind, history, profile, now), history },
      ];
    }),
  ) as Record<BiomarkerKind, Biomarker>;

  const vo2 = biomarkers.vo2Max.latest;
  return {
    source: provider.kind,
    profile,
    age,
    fitnessAge:
      vo2 && profile.sex
        ? {
            value: Math.round(fitnessAge(vo2.value, profile.sex) * 10) / 10,
            vo2Max: vo2.value,
            measuredAt: vo2.timestamp,
            chronologicalAge: age,
            percentile:
              age === null
                ? null
                : vo2MaxPercentile(vo2.value, age, profile.sex),
          }
        : null,
    biomarkers,
  };
}
