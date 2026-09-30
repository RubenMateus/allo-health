import { RulesCoachingEngine } from './index';

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