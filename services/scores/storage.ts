import { SQLiteStorage } from "expo-sqlite/kv-store";

import type { ScoreStorage } from "./types";

// Daily strain and recovery scores live only in a local SQLite file on the
// device. Nothing here talks to the network.
const database = new SQLiteStorage("scores.db");

export const scoreStorage: ScoreStorage = {
  getItem: (key) => database.getItemAsync(key),
  setItem: (key, value) => database.setItemAsync(key, value),
};
