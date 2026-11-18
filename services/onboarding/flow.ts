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

/**
 * After connecting, ask for age and sex only if the source left one out. When
 * access wasn't granted, the Biomarkers card asks later instead.
 */
export function afterConnect(
  permission: PermissionState,
  profile: HealthProfile,
): "profile" | "done" {
  if (permission !== "granted" && permission !== "partial") return "done";
  return needsProfile(profile) ? "profile" : "done";
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

/** Replaying from Settings returns to the Home underneath; first launch replaces the intro. */
export function finishRoute(canGoBack: boolean): "dismissTo" | "replace" {
  return canGoBack ? "dismissTo" : "replace";
}
