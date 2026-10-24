import { coachingInputFrom, explainInputs, RulesCoachingEngine } from './index';

describe('RulesCoachingEngine', () => {
  const engine = new RulesCoachingEngine();

  it('recommends recovery when recovery or sleep is low', () => {
    expect(engine.recommend({ recovery: 44, strain: 2, sleep: 80 }).mode).toBe('recover');
    expect(engine.recommend({ recovery: 80, strain: 2, sleep: 54 }).mode).toBe('recover');
  });

  it('recommends a push when recovery is high and strain is still manageable', () => {
    expect(engine.recommend({ recovery: 75, strain: 11.9, sleep: 80 })).toMatchObject({ mode: 'push', targetStrain: [12, 16] });
  });

  it('defaults to a maintain recommendation', () => {
    expect(engine.recommend({ recovery: 74, strain: 9, sleep: 70 }).mode).toBe('maintain');
  });
});
describe('explainInputs', () => {
  it('flags what held the recommendation back and what allowed a push', () => {
    expect(explainInputs({ recovery: 40, strain: 13, sleep: 50 })).toEqual({ recovery: 'holds-back', strain: 'holds-back', sleep: 'holds-back' });
    expect(explainInputs({ recovery: 80, strain: 5, sleep: 80 })).toEqual({ recovery: 'allows-push', strain: 'neutral', sleep: 'neutral' });
  });
});

describe('coachingInputFrom', () => {
  it('fills missing scores with neutral values', () => {
    expect(coachingInputFrom({ recoveryScore: null, strainScore: null, sleepScore: 70 })).toEqual({ recovery: 50, strain: 0, sleep: 70 });
  });
});
