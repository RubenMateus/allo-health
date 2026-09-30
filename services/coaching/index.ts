export type CoachingInput = { recovery: number; strain: number; sleep: number };
export type CoachingOutput = {
  title: string;
  message: string;
  targetStrain: readonly [number, number];
  mode: "push" | "maintain" | "recover";
};

export interface CoachingEngine {
  recommend(input: CoachingInput): CoachingOutput;
}

export class RulesCoachingEngine implements CoachingEngine {
  recommend({ recovery, strain, sleep }: CoachingInput): CoachingOutput {
    if (recovery < 45 || sleep < 55) {
      return {
        title: "Make room to recover",
        message:
          "Keep training easy today. A relaxed walk and an earlier wind-down will support a stronger next session.",
        targetStrain: [4, 7],
        mode: "recover",
      };
    }
    if (recovery >= 75 && strain < 12) {
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
