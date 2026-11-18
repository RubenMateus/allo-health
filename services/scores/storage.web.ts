import { createBrowserStorage } from "@/services/storage/browserStorage";

import type { ScoreStorage } from "./types";

// Web (development only): see services/storage/browserStorage.ts.
export const scoreStorage: ScoreStorage = createBrowserStorage("scores", {
  asyncReads: true,
}) as ScoreStorage;
