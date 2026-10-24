import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  removeEntry,
  upsertEntry,
  type JournalDraft,
  type JournalEntry,
} from "@/services/journal";
import { journalStorage } from "@/services/journal/storage";

type JournalStore = {
  entries: JournalEntry[];
  hydrated: boolean;
  loadFailed: boolean;
  saveEntry: (draft: JournalDraft) => void;
  deleteEntry: (date: string) => void;
};

export const useJournalStore = create<JournalStore>()(
  persist(
    (set) => ({
      entries: [],
      hydrated: false,
      loadFailed: false,
      saveEntry: (draft) =>
        set((state) => ({ entries: upsertEntry(state.entries, draft) })),
      deleteEntry: (date) =>
        set((state) => ({ entries: removeEntry(state.entries, date) })),
    }),
    {
      name: "allo-journal",
      version: 1,
      storage: createJSONStorage(() => journalStorage),
      partialize: (state) => ({ entries: state.entries }),
      // Storage reads are always async, so this runs after `useJournalStore` exists.
      onRehydrateStorage: () => (_state, error) => {
        useJournalStore.setState({ hydrated: true, loadFailed: !!error });
      },
    },
  ),
);
