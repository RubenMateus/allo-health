# First-Launch Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The first time the app opens, a five-page swipe-through explains it (privacy, the rings, where things are), connects health data, and collects age and sex before the person reaches Home.

**Architecture:** A persisted `onboardingCompletedAt` flag in `settingsStore`, which reads synchronously, controls a `<Redirect>` in the tabs layout. The redirect sends people to a new `/onboarding` Stack route until the flag is set, so Home never mounts first. The flow's decisions (which pages show, where Skip lands, whether the profile page is needed) live in a pure module with unit tests. The screen is a horizontal paging `ScrollView`. The age and sex fields move out of `ProfileCard` into a shared `ProfileForm`, which onboarding, Biomarkers and Settings all use.

**Tech Stack:** Expo Router, React Native, NativeWind, Zustand persist on the expo-sqlite kv-store, Jest (jest-expo). Run with `bun run test`, `bun run typecheck` and `bun run lint`, never `bun test`.

**Spec:** `docs/superpowers/specs/2026-11-18-onboarding-design.md`

## Global Constraints

- No network calls and no analytics. Everything stays on the device (project privacy rule).
- Do not add any new dependencies.
- Style with NativeWind token classes only (`bg-surface`, `text-primary`, `type-*`). No hard-coded colors except gradients from `useTheme()`.
- Use the platform's source name: `Platform.OS === "ios" ? "Apple Health" : "Health Connect"`, as in `SettingsScreen`.
- Web is a dev-only target. Onboarding must still run there, using sample data.
- Commits are authored as Ruben Mateus, with no Claude references in the commit or the PR.

## Review Focus

1. If the app is killed partway through onboarding, it starts again from page 1, because the flag is only set when you finish (Task 1 test).
2. Permission denied, or `requestConnection` throws: the Connect page shows "Not granted", with Try again and sample-data options, and is never stuck (Task 2 `afterConnect` test).
3. Apple Health returns only one of birth date or sex: the profile page still shows, prefilled with the known value (Task 2 test).
4. Replay intro while already connected: the Connect page shows Connected, with no new OS prompt, and Next continues (Task 2 `connectPageState` test).
5. Android hardware back on onboarding: it goes to the previous page, and on page 1 it does nothing rather than reaching Home (Task 3, checked by hand).

---

### Task 1: Onboarding flag in the settings store

**Files:**
- Modify: `stores/settingsStore.ts`
- Test: `stores/settingsStore.test.ts`

**Interfaces:**
- Produces:
  - `useSettingsStore` state `onboardingCompletedAt: string | null`
  - `completeOnboarding(at?: Date): void` sets the flag to an ISO string
  - `resetOnboarding(): void` sets it to `null`
  - Persist `version: 2`

- [ ] **Step 1: Write failing tests** in `settingsStore.test.ts`. Extend `beforeEach` to reset `onboardingCompletedAt: null`.
  - `it("starts with onboarding not done")`: expect `getState().onboardingCompletedAt` toBeNull.
  - `it("persists finishing onboarding")`: call `completeOnboarding(new Date("2026-11-18T09:00:00.000Z"))`, then expect the persisted `state.onboardingCompletedAt` toBe `"2026-11-18T09:00:00.000Z"`.
  - `it("resets onboarding for replay")`: complete, then reset, then expect null.
  - `it("shows onboarding once to existing installs")`: set `mockMemory` to `{version:1,state:{themePreference:"light",lastSyncedAt:null}}`, then rehydrate. Expect `themePreference` toBe `"light"` and `onboardingCompletedAt` toBeNull.
  - Update the existing "persists the theme choice" expectation to include `onboardingCompletedAt: null`.
- [ ] **Step 2:** Run `bun run test stores/settingsStore.test.ts`. Expected: FAIL (`completeOnboarding is not a function`).
- [ ] **Step 3: Implement.** Add the state, the two setters, `version: 2`, and `migrate: (state) => ({ ...(state as object), onboardingCompletedAt: null })`.
- [ ] **Step 4:** Run the same test. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(onboarding): persist whether the intro was finished`.

### Task 2: Flow logic

**Files:**
- Create: `services/onboarding/flow.ts`
- Test: `services/onboarding/flow.test.ts`

**Interfaces:**
- Consumes: `HealthProfile` and `PermissionState` from `@/services/health/types`
- Produces:
  - `type OnboardingPage = "welcome" | "rings" | "places" | "connect" | "profile"`
  - `const INTRO_PAGES: OnboardingPage[] = ["welcome", "rings", "places", "connect"]`
  - `skipTarget(): OnboardingPage`, which returns `"connect"`
  - `mergeProfile(source: HealthProfile | null, saved: HealthProfile): HealthProfile`. Each field takes the source value first, then the saved value, using the same precedence as `services/health/biomarkers.ts`.
  - `needsProfile(profile: HealthProfile): boolean`, true when `birthDate` or `sex` is null
  - `type ConnectPageState = "idle" | "connecting" | "connected" | "limited" | "notGranted" | "unavailable"`
  - `connectPageState(permission: PermissionState, connecting: boolean, isWeb: boolean): ConnectPageState`
  - `afterConnect(permission: PermissionState, profile: HealthProfile): "profile" | "done"`

- [ ] **Step 1: Write failing tests.**
  - `skipTarget()` is `"connect"`.
  - `mergeProfile({birthDate:"1990-03-14",sex:null}, {birthDate:null,sex:"female"})` equals `{birthDate:"1990-03-14",sex:"female"}`.
  - `mergeProfile(null, saved)` equals `saved`.
  - `needsProfile`: true for `{birthDate:"1990-07-01",sex:null}`, true for `{birthDate:null,sex:"male"}`, false when both are set.
  - `connectPageState`:
    - `("unrequested", true, false)` returns `"connecting"`
    - `("granted", false, false)` returns `"connected"`
    - `("partial", false, false)` returns `"limited"`
    - `("denied", false, false)` returns `"notGranted"`
    - `("unrequested", false, false)` returns `"idle"`
    - `("mock", false, false)` returns `"idle"`
    - `(anything, false, true)` returns `"unavailable"`
  - `afterConnect`:
    - `("granted", {birthDate:null,sex:null})` returns `"profile"`
    - `("partial", complete)` returns `"done"`
    - `("denied", missing)` returns `"done"`, because Biomarkers' card catches up later
    - `("mock", missing)` returns `"done"`
- [ ] **Step 2:** Run `bun run test services/onboarding`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement the pure functions with no React imports.
- [ ] **Step 4:** Run the same tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(onboarding): flow rules for skip, connect and profile pages`.

### Task 3: Shared profile form, onboarding screen and routing

**Files:**
- Create: `components/profile/ProfileForm.tsx`, `services/profile/birthYear.ts`, `services/profile/birthYear.test.ts`
- Modify: `components/biomarkers/ProfileCard.tsx`, which becomes a `Card` with its existing title and copy wrapping `<ProfileForm>`
- Create: `components/onboarding/OnboardingScreen.tsx`, `components/onboarding/pages.tsx`, `app/onboarding.tsx`
- Modify: `app/_layout.tsx` to add `<Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />`
- Modify: `app/(tabs)/_layout.tsx` to return `<Redirect href="/onboarding" />` while `onboardingCompletedAt === null`, before rendering `Tabs`

**Interfaces:**
- Consumes: Task 1 setters, Task 2 functions, `useHealthStore().requestConnection`, `provider.getProfile()`, `useProfileStore().setProfile`, `GlowRing` and `RingMetric`
- Produces:
  - `isValidBirthYear(year: string, now?: Date): boolean`, which moves the existing rule out of `ProfileCard` (4 digits, between 100 and 13 years ago)
  - `<ProfileForm initial={HealthProfile} submitLabel?: string onSaved?: () => void />`, which saves `${year}-07-01` exactly as `ProfileCard` does today and keeps the "Stored only on this phone" line

- [ ] **Step 1: Write failing tests** for `isValidBirthYear`, with now = 2026-11-18:
  - `"1990"` returns true
  - `"2014"` returns false (12 years old)
  - `"2013"` returns true
  - `"1926"` returns true
  - `"1925"` returns false
  - `"199"` returns false
  - `""` returns false
- [ ] **Step 2:** Run `bun run test services/profile`. Expected: FAIL. Then implement it, extract `ProfileForm`, and switch `ProfileCard` over to them. Run the tests again. Expected: PASS.
- [ ] **Step 3: Build `OnboardingScreen`.** A horizontal `ScrollView` uses `pagingEnabled` and tracks the page from `onMomentumScrollEnd`. Use `INTRO_PAGES`, and append `"profile"` once `afterConnect` returns `"profile"`. Swiping past Connect is blocked until a choice is made: add `scrollEnabled={false}` on the Connect page. The bottom bar has dots, then **Next**, then **Skip** on pages 1 to 3 (which scrolls to `skipTarget()`). On Android, hardware back goes to the previous page and is a no-op on page 1 (use `BackHandler`). Finishing calls `completeOnboarding()` and then `router.replace("/")`.
- [ ] **Step 4: Page copy** in `pages.tsx`. Keep it short. The builder writes the final wording; these are the points each page must make:
  - **welcome:** the Allo mark, "Your health, on your phone", and "Allo reads from {source} and keeps everything on this device. No accounts, no analytics."
  - **rings:** three `GlowRing`s (the Home ring metrics with fixed example values: Strain 9.6/21, Recovery 72/100, Sleep 86/100), each labelled "Example". One line each for Recovery, Strain and Sleep, taken from the spec's meanings, plus "Tap a ring on Home for the full breakdown."
  - **places:** rows with each tab's icon (Home, Journal, Fitness, Biomarkers), the + button (check-in and sync), and Settings (theme and profile), one line each.
  - **connect:** the primary button "Connect {source}". It is driven by `connectPageState`:
    - connecting: a spinner
    - connected: "Connected" and Next
    - limited: "Limited access" and Next
    - notGranted: "Not granted" and Try again
    - unavailable: the existing "only on iOS and Android" message
    - Secondary link: "Look around with sample data (not your numbers)", which finishes the intro.
  - **profile:** a short intro ("Used to rate VO₂ max, body fat and Fitness Age"), then `<ProfileForm initial={merged} submitLabel="Finish" onSaved={finish} />`, then "Skip for now", which finishes.
- [ ] **Step 5: Routing.** Wire up `app/onboarding.tsx` and the two layout changes. Run `bun run typecheck && bun run lint`. Expected: both clean.
- [ ] **Step 6:** Run `bun run test`. Expected: all pass.
- [ ] **Step 7:** Commit with `feat(onboarding): first-launch welcome screens`.

### Task 4: Settings rows

**Files:**
- Modify: `components/settings/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `ProfileForm`, `useProfileStore`, `resetOnboarding()`

- [ ] **Step 1:** Add a "Profile" section with eyebrow "About you", title "Age and sex", and a Card containing `<ProfileForm initial={savedProfile} submitLabel="Save" />`. Put it between Theme and Sync.
- [ ] **Step 2:** Add a "Replay intro" pressable row above the privacy footer. It calls `resetOnboarding()` and then `router.replace("/onboarding")`.
- [ ] **Step 3:** Run `bun run typecheck && bun run lint && bun run test`. Expected: clean.
- [ ] **Step 4:** Commit with `feat(settings): edit age and sex, replay the intro`.

### Task 5: Verify on web and open the PR

- [ ] **Step 1:** Run the web build using the screenshot recipe in project memory (`navigation-and-screenshots`). Fresh storage must land on `/onboarding`. Then walk through all pages. Choosing sample data must reach Home with the flag set, and a reload must stay on Home. Replay from Settings must return to page 1.
- [ ] **Step 2:** Screenshot every page plus the Settings rows, in dark and light, at a phone viewport. Save the shots to `/mnt/project-files/onboarding/`.
- [ ] **Step 3:** Push `claude/project-thread-jhgz01` and open the PR with the screenshots and the on-device checks from Review Focus 2, 3 and 5.
