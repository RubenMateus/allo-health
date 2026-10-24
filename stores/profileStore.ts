import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { HealthProfile } from "@/services/health/types";
import { profileStorage } from "@/services/profile/storage";

type ProfileStore = HealthProfile & {
  hydrated: boolean;
  setProfile: (profile: HealthProfile) => void;
};

/**
 * Age and sex entered by hand. Health Connect does not share them, so Android asks
 * once; on iOS these only fill in what Apple Health leaves blank.
 */
export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      birthDate: null,
      sex: null,
      hydrated: false,
      setProfile: ({ birthDate, sex }) => set({ birthDate, sex }),
    }),
    {
      name: "allo-profile",
      version: 1,
      storage: createJSONStorage(() => profileStorage),
      partialize: ({ birthDate, sex }) => ({ birthDate, sex }),
      onRehydrateStorage: () => () => {
        useProfileStore.setState({ hydrated: true });
      },
    },
  ),
);
