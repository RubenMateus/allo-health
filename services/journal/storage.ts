import { SQLiteStorage } from "expo-sqlite/kv-store";
import type { StateStorage } from "zustand/middleware";

// Journal entries live only in a local SQLite file on the device. Nothing here
// talks to the network.
const database = new SQLiteStorage("journal.db");

// `Promise.resolve` hands zustand a promise from this runtime's global
// `Promise`, so it always treats reads as async and finishes hydrating after
// the store has been created.
export const journalStorage: StateStorage = {
  getItem: (key) => Promise.resolve(database.getItemAsync(key)),
  setItem: (key, value) => database.setItemAsync(key, value),
  removeItem: async (key) => {
    await database.removeItemAsync(key);
  },
};
