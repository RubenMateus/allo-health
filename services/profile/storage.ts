import { SQLiteStorage } from "expo-sqlite/kv-store";
import type { StateStorage } from "zustand/middleware";

// The age and sex someone types in stay in a local SQLite file on the device.
// Nothing here talks to the network.
const database = new SQLiteStorage("profile.db");

export const profileStorage: StateStorage = {
  getItem: (key) => Promise.resolve(database.getItemAsync(key)),
  setItem: (key, value) => database.setItemAsync(key, value),
  removeItem: async (key) => {
    await database.removeItemAsync(key);
  },
};
