const mockMemory = new Map<string, string>();

jest.mock('@/services/journal/storage', () => ({
  journalStorage: {
    getItem: async (key: string) => mockMemory.get(key) ?? null,
    setItem: async (key: string, value: string) => { mockMemory.set(key, value); },
    removeItem: async (key: string) => { mockMemory.delete(key); },
  },
}));

import { useJournalStore } from './journalStore';

describe('journal store', () => {
  beforeEach(() => {
    mockMemory.clear();
    useJournalStore.setState({ entries: [] });
  });

  it('persists saved entries to on-device storage only', async () => {
    useJournalStore.getState().saveEntry({ date: '2026-10-24', mood: 4, energy: 3, tags: ['sauna'], note: ' Felt good ' });
    await Promise.resolve();

    const persisted = JSON.parse(mockMemory.get('allo-journal') ?? '{}');
    expect(persisted.version).toBe(1);
    expect(persisted.state).toEqual({ entries: [expect.objectContaining({ date: '2026-10-24', tags: ['sauna'], note: 'Felt good' })] });
    expect(persisted.state.hydrated).toBeUndefined();
  });

  it('flags a failed load instead of showing an empty journal', async () => {
    mockMemory.set('allo-journal', '{not json');
    await useJournalStore.persist.rehydrate();
    expect(useJournalStore.getState()).toMatchObject({ hydrated: true, loadFailed: true });
  });

  it('rehydrates entries and deletes them', async () => {
    mockMemory.set('allo-journal', JSON.stringify({
      version: 1,
      state: { entries: [{ date: '2026-10-23', mood: 2, energy: 2, tags: [], note: '', updatedAt: '2026-10-23T20:00:00.000Z' }] },
    }));
    await useJournalStore.persist.rehydrate();
    expect(useJournalStore.getState()).toMatchObject({ hydrated: true, loadFailed: false, entries: [expect.objectContaining({ date: '2026-10-23' })] });

    useJournalStore.getState().deleteEntry('2026-10-23');
    expect(useJournalStore.getState().entries).toEqual([]);
  });
});
