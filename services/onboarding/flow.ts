import type { HealthProfile, PermissionState } from "@/services/health/types";

export type OnboardingPage =
  | "welcome"
  | "rings"
  | "places"
  | "connect"
  | "profile";

/** The pages everyone sees. "profile" is added after connecting when needed. */
export const INTRO_PAGES: OnboardingPage[] = [
  "welcome",
  "rings",
  "places",
  "connect",
];

/** Skip never jumps past connect: you either connect or pick sample data. */
export function skipTarget(): OnboardingPage {
  return "connect";
}

/** What the health source shares wins; what was typed in fills the gaps. */
export function mergeProfile(
  source: HealthProfile | null,
  saved: HealthProfile,
): HealthProfile {
  return {
    birthDate: source?.birthDate ?? saved.birthDate,
    sex: source?.sex ?? saved.sex,
  };
}

export function needsProfile(profile: HealthProfile): boolean {
  return profile.birthDate === null || profile.sex === null;
}

export type ConnectPageState =
  | "idle"
  | "connecting"
  | "connected"
  | "limited"
  | "notGranted"
  | "unavailable";

export function connectPageState(
  permission: PermissionState,
  connecting: boolean,
  isWeb: boolean,
): ConnectPageState {
  if (isWeb) return "unavailable";
  if (connecting) return "connecting";
  if (permission === "granted") return "connected";
  if (permission === "partial") return "limited";
  if (permission === "denied") return "notGranted";
  return "idle";
}

/** Ask for age and sex whenever one is still missing, whatever was chosen on Connect. */
export function afterConnect(profile: HealthProfile): "profile" | "done" {
  return needsProfile(profile) ? "profile" : "done";
}

/**
 * The health source's age and sex count only when access was granted. With
 * sample data the sample profile is not the person's own.
 */
export function usesSourceProfile(permission: PermissionState): boolean {
  return permission === "granted" || permission === "partial";
}

/** The line under the age and sex title, naming what the health app left out. */
export function profileIntro(
  source: HealthProfile | null,
  sourceName: string,
): string {
  if (!source) return "Add them here. They stay on this phone.";
  if (source.birthDate && !source.sex)
    return `${sourceName} shared your birth year. Add your sex to finish.`;
  if (source.sex && !source.birthDate)
    return `${sourceName} shared your sex. Add your birth year to finish.`;
  return `${sourceName} doesn't share these, so add them here.`;
}

/**
 * The page to show once a horizontal scroll settles. Only a drag by the person
 * moves the page (never past connect); Android also reports momentum for the
 * app's own scrollTo, which must not override the page it chose.
 */
export function pageAfterSwipe(
  offsetX: number,
  width: number,
  pages: OnboardingPage[],
  current: number,
  dragged: boolean,
): number {
  if (!dragged) return current;
  return Math.min(Math.round(offsetX / width), pages.indexOf("connect"));
}
