export type CoachingInput = { recovery: number; strain: number; sleep: number };
export type CoachingMode = "push" | "maintain" | "recover";
export type CoachingOutput = {
  title: string;
  message: string;
  targetStrain: readonly [number, number];
  mode: CoachingMode;
};

export interface CoachingEngine {
  recommend(input: CoachingInput): CoachingOutput;
}

/** Strain is scored 0–21. */
export const MAX_STRAIN = 21;

/** The cut-offs the rules engine uses, shared with the readiness page so it can explain them. */
export const coachingThresholds = {
  recoverBelowRecovery: 45,
  recoverBelowSleep: 55,
  pushFromRecovery: 75,
  pushBelowStrain: 12,
} as const;

/** The rules in the order they are checked, in plain words for the readiness page. */
export const coachingRules: readonly { mode: CoachingMode; when: string }[] = [
  {
    mode: "recover",
    when: `Recovery under ${coachingThresholds.recoverBelowRecovery} or sleep under ${coachingThresholds.recoverBelowSleep}`,
  },
  {
    mode: "push",
    when: `Recovery ${coachingThresholds.pushFromRecovery}+ and strain so far under ${coachingThresholds.pushBelowStrain}`,
  },
  { mode: "maintain", when: "Anything in between" },
];

export type InputEffect = "holds-back" | "allows-push" | "neutral";

/** How each input pulled on today's recommendation. */
export function explainInputs({ recovery, strain, sleep }: CoachingInput) {
  const t = coachingThresholds;
  return {
    recovery:
      recovery < t.recoverBelowRecovery
        ? "holds-back"
        : recovery >= t.pushFromRecovery
          ? "allows-push"
          : "neutral",
    sleep: sleep < t.recoverBelowSleep ? "holds-back" : "neutral",
    strain: strain < t.pushBelowStrain ? "neutral" : "holds-back",
  } satisfies Record<keyof CoachingInput, InputEffect>;
}

export class RulesCoachingEngine implements CoachingEngine {
  recommend({ recovery, strain, sleep }: CoachingInput): CoachingOutput {
    const t = coachingThresholds;
    if (recovery < t.recoverBelowRecovery || sleep < t.recoverBelowSleep) {
      return {
        title: "Make room to recover",
        message:
          "Keep training easy today. A relaxed walk and an earlier wind-down will support a stronger next session.",
        targetStrain: [4, 7],
        mode: "recover",
      };
    }
    if (recovery >= t.pushFromRecovery && strain < t.pushBelowStrain) {
      return {
        title: "You have room to build",
        message:
          "Your recovery signals are trending well. A focused session can move you forward without chasing an all-out effort.",
        targetStrain: [12, 16],
        mode: "push",
      };
    }
    return {
      title: "Stay steady today",
      message:
        "Keep your effort controlled and finish feeling capable of more. Consistent work is the win.",
      targetStrain: [8, 12],
      mode: "maintain",
    };
  }
}

export const coachingEngine: CoachingEngine = new RulesCoachingEngine();

/** The engine's input from dashboard scores, with neutral stand-ins for missing ones. */
export function coachingInputFrom(scores: {
  recoveryScore: number | null;
  strainScore: number | null;
  sleepScore: number | null;
}): CoachingInput {
  return {
    recovery: scores.recoveryScore ?? 50,
    strain: scores.strainScore ?? 0,
    sleep: scores.sleepScore ?? 50,
  };
}
