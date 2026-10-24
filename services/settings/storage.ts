import { SQLiteStorage } from "expo-sqlite/kv-store";
import type { StateStorage } from "zustand/middleware";

// App preferences live in a local SQLite file on the device, next to the
// journal. Nothing here talks to the network.
const database = new SQLiteStorage("settings.db");

// Reads are synchronous so the saved theme is applied before the first frame,
// without a flash of the default theme.
export const settingsStorage: StateStorage = {
  getItem: (key) => database.getItemSync(key),
  setItem: (key, value) => database.setItemSync(key, value),
  removeItem: (key) => {
    database.removeItemSync(key);
  },
};
