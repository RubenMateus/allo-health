# First-launch onboarding

Status: draft for approval, 2026-11-18

## Why

When someone opens the app for the first time, it drops them straight onto Home with sample data. There is nothing to explain what Strain, Recovery and Sleep mean or where the tabs are. Ruben once took the sample numbers for real ones on his iPhone. Onboarding should explain where things are and what they mean, and it should get health data connected before any numbers appear.

## Goals

- A short swipe-through before Home on first launch, with five pages:
  1. **Welcome and privacy.** Health data stays on this phone. There are no accounts and no analytics.
  2. **The three rings.** What Recovery, Strain and Sleep each measure, and that you can tap a ring for detail.
  3. **Where things are.** Home, Journal, Fitness, Biomarkers, the + button (check-in and sync) and Settings.
  4. **Connect.** Apple Health or Health Connect, through the existing permission flow. A "Look around with sample data" link is the secondary option, and it says clearly that the numbers are not yours.
  5. **Age and sex.** Birth year and sex, with a "Skip for now" option. The page only shows if they're still missing after Connect. On iOS it is skipped when Apple Health already has both values. On Android it always shows.
- Skip is available on pages 1 to 3 and jumps to Connect. Connect is never skipped silently: you either connect or choose sample data.
- The intro shows once. Existing installs (Ruben's) see it once after the update.
- Settings gets a **Profile** row to edit birth year and sex, and a **Replay intro** row.

## Non-goals

- The ⓘ explainers and the getting-started checklist from option C. Ruben will decide later what to bring over.
- A spotlight tour over the real screens (option B).
- Any account, sign-in or network step.

## Anti-goals

- Home or any Health read running behind the intro. That brings back the sample-data confusion.
- Sample data that reads as yours after choosing it. The existing Home banner has to show in that state.
- Anything that leaves the device. This follows the privacy rule.

## Approaches

1. **A dedicated `/onboarding` route with a horizontal snap pager (chosen).** The root layout redirects there until a flag is set. Home never mounts behind it, and nothing new needs installing.
2. **A full-screen overlay on top of Home.** Rejected because Home loads and reads data underneath.
3. **One route per step with stack push.** Rejected because it feels like a form rather than a swipe-through, and it needs five route files.

Ruben picked 1 on 2026-11-18.

## Design

- **Flag.** Add `onboardingCompletedAt: string | null` to `settingsStore`, plus a `completeOnboarding()` setter and a `resetOnboarding()` setter. Settings storage reads synchronously from the kv-store, so the flag is known on the first render. Bump the persist version and migrate old state to `null`, so existing installs see the intro.
- **Routing.** Add `app/onboarding.tsx` as a Stack screen with gestures disabled. The root layout redirects to it while the flag is null. Finishing calls `completeOnboarding()` and then `router.replace("/")`.
- **Pager.** A horizontal `ScrollView` with `pagingEnabled`, or Reanimated, which is already a dependency. Dots and a Next button sit at the bottom, using the app's tokens and NativeWind classes. The rings page draws with the existing ring component and sample values, labelled as an example.
- **Connect page.** Calls `useHealthStore().requestConnection()`. It shows the result: Connected, Limited (partial) or Not granted, with a retry. "Use sample data" carries on without a request. On web, which is dev-only, it shows the existing "only on iOS and Android" message and continues on sample data.
- **Age and sex page.** Pull the birth year and sex fields out of `ProfileCard` into a shared form. They are used by this page, by the Biomarkers card (still shown when values are missing) and by the Settings Profile screen. After connecting, decide whether to show the page from `provider.getProfile()` merged with `profileStore`.
- **Settings.** Add a Profile row, which opens the shared form, and a Replay intro row, which calls `resetOnboarding()` and navigates to `/onboarding`.

## Left to the builder

- The exact copy on each page. Keep it short, two or three lines per idea.
- The illustration on each page, drawn from existing components and tokens.
- Tests for the redirect, the persist migration and the profile-skip logic.
- Screenshots of each page in light and dark for the PR.
