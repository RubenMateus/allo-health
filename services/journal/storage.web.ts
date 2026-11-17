import { createBrowserStorage } from "@/services/storage/browserStorage";

// Web (development only): see services/storage/browserStorage.ts.
export const journalStorage = createBrowserStorage("journal", {
  asyncReads: true,
});
