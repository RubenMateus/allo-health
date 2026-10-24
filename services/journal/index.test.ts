import {
  calculateStreak,
  NOTE_MAX_LENGTH,
  removeEntry,
  shiftDayKey,
  summarizeWeek,
  toDayKey,
  upsertEntry,
  type JournalEntry,
} from './index';

const entry = (date: string, mood: JournalEntry['mood'] = 3, energy: JournalEntry['energy'] = 3): JournalEntry => ({
  date, mood, energy, tags: [], note: '', updatedAt: '2026-10-24T08:00:00.000Z',
});

describe('journal day keys', () => {
  it('uses the local calendar day', () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('shifts across month and year boundaries', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('journal entries', () => {
  it('replaces the entry for the same day and keeps newest first', () => {
    const now = new Date('2026-10-24T09:00:00.000Z');
    const entries = upsertEntry([entry('2026-10-22'), entry('2026-10-24', 2)], {
      date: '2026-10-24', mood: 5, energy: 4, tags: [], note: '',
    }, now);
    expect(entries.map((e) => e.date)).toEqual(['2026-10-24', '2026-10-22']);
    expect(entries[0]).toMatchObject({ mood: 5, energy: 4, updatedAt: now.toISOString() });
  });

  it('trims and caps notes and keeps tags in a stable order without duplicates', () => {
    const [saved] = upsertEntry([], {
      date: '2026-10-24', mood: 3, energy: 3,
      tags: ['stress', 'caffeine', 'stress'],
      note: `  ${'a'.repeat(NOTE_MAX_LENGTH + 50)}  `,
    });
    expect(saved.tags).toEqual(['caffeine', 'stress']);
    expect(saved.note).toHaveLength(NOTE_MAX_LENGTH);
  });

  it('removes an entry by day', () => {
    expect(removeEntry([entry('2026-10-23'), entry('2026-10-24')], '2026-10-23').map((e) => e.date)).toEqual(['2026-10-24']);
  });
});

describe('journal summaries', () => {
  it('counts a streak that ends today or yesterday, and resets after a gap', () => {
    const entries = [entry('2026-10-21'), entry('2026-10-22'), entry('2026-10-23')];
    expect(calculateStreak(entries, '2026-10-24')).toBe(3);
    expect(calculateStreak([...entries, entry('2026-10-24')], '2026-10-24')).toBe(4);
    expect(calculateStreak(entries, '2026-10-25')).toBe(0);
    expect(calculateStreak([], '2026-10-24')).toBe(0);
  });

  it('summarizes the last seven days oldest first', () => {
    const summary = summarizeWeek([entry('2026-10-24', 5, 4), entry('2026-10-20', 2, 3), entry('2026-10-10', 1, 1)], '2026-10-24');
    expect(summary.days.map((day) => day.date)).toEqual([
      '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24',
    ]);
    expect(summary).toMatchObject({ loggedDays: 2, averageMood: 3.5, averageEnergy: 3.5, streak: 1 });
  });

  it('reports no averages for an empty week', () => {
    expect(summarizeWeek([], '2026-10-24')).toMatchObject({ loggedDays: 0, averageMood: null, averageEnergy: null, streak: 0 });
  });
});
