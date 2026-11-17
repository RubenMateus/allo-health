import { createBrowserStorage } from "@/services/storage/browserStorage";

// Web (development only): see services/storage/browserStorage.ts.
export const profileStorage = createBrowserStorage("profile", {
  asyncReads: true,
});
