# Browse Health Data by Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Ruben pick any past day (week strip + month calendar on Home) and see Home, Sleep, Strain and Recovery as they stood at the end of that day.

**Architecture:** A non-persisted Zustand store holds the selected day. Every "now"-based `HealthProvider` read gains an optional `day` argument, `loadDashboardData` builds a dashboard for that day, and a new hook keys the React Query cache on it. Recovery dots for the strip and calendar come from the existing on-device score cache, backfilled one day at a time.

**Tech Stack:** Expo SDK 58 / React Native, Expo Router, TypeScript, React Query, Zustand, NativeWind, Jest (jest-expo) + Testing Library. Run tests with `bun run test`, never `bun test`.

**Spec:** `docs/superpowers/specs/2026-11-18-day-navigation-design.md`

## Global Constraints

- Health data stays on-device: no network calls, no analytics, no new storage beyond the score cache (`scores.db`).
- The app always opens on today. The selected day is never persisted.
- Omitting the new `day` argument must behave exactly as today (all existing tests keep passing unchanged).
- Coach advice (AI readiness section, TARGET STRAIN pill on Home and the Strain page, the Readiness entry) is hidden on any day that is not today.
- Fitness and Biomarkers tabs are unchanged and keep showing today.
- Swiping the week strip only browses; Home changes only when a day is tapped.
- Recovery dot colours use the app's existing recovery thresholds (`recoveryStatus` in components/recovery/RecoveryScreen.tsx): 75+ high (primary), 50–74 moderate (warning), below 50 low (danger), null = no dot. (The mockup used 67/34; Claude's call to match the rings.)
- Day keys are local `YYYY-MM-DD` strings via `toDayKey` / `fromDayKey` / `shiftDayKey` from `services/journal`.
- Commits authored as Ruben Mateus, no Claude references in commits or PR.

## Review Focus

1. **`useScoreHistory` must stay anchored to today.** It reads `useHealthDashboard().data.today`; if the dashboard hook starts following the selected day, the 14-day history and Load balance silently shift. Test in Task 4.
2. **A past day with no data must not flip the app to sample data.** `fallbackToMock` may only fire on today's load. Test in Task 4.
3. **Two writers to the score cache** (`loadScoreHistory` and the new range backfill) doing read-modify-write on the same key can drop each other's days. Writes must be serialized. Test in Task 5.
4. **Midnight while open / returning next morning:** a past day picked last night must reset to today when the app comes back on a later calendar day; "today" itself must roll over. Test in Task 1.
5. **Today stays live:** today's reads must keep ending at `now` (not 24:00) and keep today's refetch behaviour; past-day windows end at the next local midnight. Tests in Tasks 2 and 3.

---

### Task 1: Selected day store

**Files:**
- Create: `stores/dayStore.ts`, `stores/dayStore.test.ts`
- Modify: `app/_layout.tsx` (mount the reset listener)

**Interfaces:**
- Produces:
  - `useDayStore` (Zustand, not persisted) with state `{ selectedDay: string | null; leftOn: string }` and actions `selectDay(key: string, now?: Date): void`, `goToToday(): void`, `resetIfNewDay(now?: Date): void`.
  - `selectDay` with a key equal to today's key or later stores `null`.
  - `useSelectedDayKey(): string` returns `selectedDay ?? toDayKey(new Date())`.
  - `useIsToday(): boolean`.
  - `useResetDayOnForeground(): void` — subscribes to `AppState` "change" → "active" and calls `resetIfNewDay()`; on "background" records `leftOn = toDayKey(now)`.

- [ ] **Step 1: Write failing tests** in `stores/dayStore.test.ts`:
  - `selectDay("2026-11-16")` → `selectedDay === "2026-11-16"`.
  - `selectDay` with today's key and with a future key → `selectedDay === null`.
  - `goToToday()` → `null`.
  - `resetIfNewDay`: with `leftOn = "2026-11-17"`, selected `"2026-11-10"`, now = 2026-11-18 08:00 → `selectedDay === null`; same with now = 2026-11-17 23:00 → stays `"2026-11-10"`.
- [ ] **Step 2:** `bun run test stores/dayStore.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement the store and hooks; call `useResetDayOnForeground()` in the root layout component of `app/_layout.tsx`.
- [ ] **Step 4:** `bun run test stores/dayStore.test.ts` → PASS.
- [ ] **Step 5:** Commit `feat(day): selected day store that resets to today`.

### Task 2: Day-aware native provider reads

**Files:**
- Modify: `services/health/types.ts` (HealthProvider interface), `services/health/appleHealthProvider.ts`, `services/health/healthConnectProvider.ts`
- Test: `services/health/appleHealthProvider.test.ts`, `services/health/healthConnectProvider.test.ts`

**Interfaces:**
- Produces (interface changes; all `day` params optional, default = today, unchanged behaviour):
  - `getHeartRate(day?: Date)`, `getHRV(day?: Date)`, `getRestingHR(day?: Date)`, `getRespiratoryRate(day?: Date)`, `getActiveEnergy(day?: Date)`, `getNutrition(day?: Date)`, `getGlucose(day?: Date)`, `getStressSamples(day?: Date)`.
- Window rule for a past day: `dayWindow(day, now())` from `services/health/nativeSamples.ts` (local 00:00 → next 00:00). For today, keep the current windows exactly (36-hour recent window for HR/HRV/glucose, `todayStart()`→now for sums).
- `getRestingHR` / `getRespiratoryRate` for a past day: `latest(…, end)` where `end` is that window's end (latest reading within the 7 days before).
- `getStressSamples(day)` passes that day's HR + HRV and `end` as the "now" argument of `buildStressSamples`.

- [ ] **Step 1: Write failing tests** (one per provider file, using each file's existing mocks and fixed `NOW`):
  - `getNutrition(pastDay)` queries `startDate = pastDay 00:00`, `endDate = next day 00:00`.
  - `getHRV(pastDay)` / `getGlucose(pastDay)` query that day's window, not the last 36 hours.
  - `getRestingHR(pastDay)` queries `[end − 7 days, end]` with `end = next day 00:00`.
  - `getActiveEnergy(pastDay)` sums that day's window.
  - `getNutrition()` with no argument still queries `todayStart()`→`NOW` (regression).
- [ ] **Step 2:** `bun run test services/health/appleHealthProvider.test.ts services/health/healthConnectProvider.test.ts` → new tests FAIL.
- [ ] **Step 3:** Add the optional `day` params to the interface and both providers.
- [ ] **Step 4:** Same command → PASS. Then `bun run typecheck` → no errors.
- [ ] **Step 5:** Commit `feat(health): read any day from HealthKit and Health Connect`.

### Task 3: Mock provider days and the day's dashboard

**Files:**
- Modify: `services/health/mockProvider.ts`, `services/health/dashboard.ts`
- Test: `services/health/mockProvider.test.ts`, `services/health/dashboard.test.ts`

**Interfaces:**
- Consumes: Task 2 interface.
- Produces:
  - `loadDashboardData(provider, permissionState?, day?: Date): Promise<DashboardData>`. `DashboardData.today` keeps its name and holds the scored day (renaming is out of scope). `DashboardData` gains `date: string` (the day key it describes).
  - `readSignalHistories(provider, days?, anchor?: Date)` — window counts back from `anchor` (default now).
- Past-day rules inside `loadDashboardData`: sleep via `getSleep(asOf)` with `asOf = day at 18:00` (same rule as `computeDay` in services/scores/history.ts); `scoreDay({ …, date, now })` with `date = toDayKey(day)`; histories anchored at the day's end; every provider call receives `day`.
- Mock: each newly day-aware method returns today's values when `day` is today/omitted; for an earlier day, scales them with `dayNoise(day)` (resting HR 50–60, HRV ±25%, resp. rate 13.5–15.5, nutrition ±30%, glucose and stress samples shifted onto that day like `getStrainInputs` does).

- [ ] **Step 1: Write failing tests:**
  - mockProvider: `getRestingHR(d1) !== getRestingHR(d2)` for two different past days and is stable across calls; `getRestingHR()` is still 54.
  - dashboard: `loadDashboardData(mock, "mock", pastDay)` → `date === toDayKey(pastDay)`, `today.date === toDayKey(pastDay)`, sleep `wakeTime` falls on that day, every stress sample timestamp is within that day.
  - dashboard: `loadDashboardData(mock)` → `date === toDayKey(new Date())` (regression).
- [ ] **Step 2:** `bun run test services/health/mockProvider.test.ts services/health/dashboard.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command → PASS; `bun run typecheck` clean.
- [ ] **Step 5:** Commit `feat(health): build the dashboard for any day`.

### Task 4: Day dashboard hook

**Files:**
- Modify: `hooks/useHealthDashboard.ts`
- Create: `hooks/useHealthDashboard.test.tsx`

**Interfaces:**
- Consumes: `useSelectedDayKey` (Task 1), `loadDashboardData(..., day)` (Task 3).
- Produces:
  - `useHealthDashboard()` — unchanged: always today. `useScoreHistory`, Readiness and anything coach-related keep using it.
  - `useDayDashboard()` — the selected day's dashboard. Query key `["health-dashboard", provider.kind, dayKey]`; when the day is today it returns exactly what `useHealthDashboard()` returns (same key, shared cache). Past days: `staleTime` 5 minutes for days within the last 2 days (`REFRESH_RECENT_DAYS`), `Infinity` otherwise. On error for a past day, the query errors; it never calls `fallbackToMock`.

- [ ] **Step 1: Write failing tests** (renderHook with a QueryClientProvider and a mock provider whose `getSleep` etc. can be made to reject):
  - With a past day selected, `useHealthDashboard().data.date` is today's key and `useDayDashboard().data.date` is the past key.
  - All reads rejecting for a past day → `useDayDashboard().isError === true` and `useHealthStore.getState().provider` is unchanged.
- [ ] **Step 2:** `bun run test hooks/useHealthDashboard.test.tsx` → FAIL.
- [ ] **Step 3:** Implement `useDayDashboard` in `hooks/useHealthDashboard.ts`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(day): dashboard hook for the selected day`.

### Task 5: Score cache range for recovery dots

**Files:**
- Modify: `services/scores/history.ts`
- Create: `hooks/useDayScores.ts`
- Test: `services/scores/history.test.ts`

**Interfaces:**
- Consumes: `readSignalHistories(provider, days, anchor)` (Task 3).
- Produces:
  - `KEEP_DAYS = 730`.
  - `loadScoreRange(provider, storage, from: string, to: string, now?: Date, onDay?: (score: DailyScore) => void): Promise<Record<string, DailyScore | null>>` — returns stored scores for `[from, to]`; days that are today or later map to `null` and are never stored; missing finished days are computed one at a time with the existing `computeDay`, saved, and reported through `onDay` as they land. Signal histories are read once, anchored at `to`, covering `BASELINE_DAYS` before `from`.
  - All read-modify-write on the `days` key (here and in `loadScoreHistory`) goes through one module-level serial queue, `withStoredDays(fn)`.
  - `useDayScores(from: string, to: string): Record<string, DailyScore | null>` — React Query wrapper keyed `["day-scores", provider.kind, from, to]`; fills in progressively from `onDay`.

- [ ] **Step 1: Write failing tests:**
  - Range with 3 stored days and 2 missing → provider read only for the 2 missing; result has all 5; storage now holds 5.
  - Range including today and tomorrow → those are `null` and not stored.
  - `loadScoreRange` and `loadScoreHistory` started together on disjoint days → storage ends with both sets (no lost writes).
  - A stored day 731 days old is dropped on the next write; one 700 days old is kept.
- [ ] **Step 2:** `bun run test services/scores/history.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(scores): score any range of days for the calendar`.

### Task 6: Week strip and month calendar components

**Files:**
- Create: `components/day/DayStrip.tsx`, `components/day/MonthCalendarSheet.tsx`, `components/day/recoveryDot.ts`, `components/day/DayStrip.test.tsx`, `components/day/MonthCalendarSheet.test.tsx`

**Interfaces:**
- Consumes: `useDayStore`, `useSelectedDayKey`, `useIsToday` (Task 1); `useDayScores` (Task 5).
- Produces:
  - `recoveryDotColor(score: number | null, colors: ColorTokens): string | null` using the thresholds in Global Constraints.
  - `<DayStrip />` — no props. Own state `weekStart: string` (Monday key), initialised to the selected day's week and moved there whenever `selectedDay` changes. Shows: month label button (`formatMonth` of that week's Thursday, with ▾) that opens the sheet; "Today" pill when `!isToday || weekStart !== thisWeekStart`, which calls `goToToday()` and resets `weekStart`; 7 day cells Mon–Sun (weekday, date, dot); future cells disabled; selected cell filled. Horizontal swipe (or paged list) changes `weekStart` by ±7 days, never past this week; it does not call `selectDay`.
  - `<MonthCalendarSheet visible month: string /* "YYYY-MM" */ onClose onPick={(key) => void} />` — Modal sheet styled like `QuickAddSheet`; ‹ › month arrows (› disabled on the current month); Monday-first grid; dots from `useDayScores`; future days disabled; tapping a day calls `onPick(key)` then `onClose()`. `DayStrip` wires `onPick` to `selectDay`.
  - Accessibility labels: day cell `"<formatDayLabel>, recovery <n>"` or `"…, no score"`; month button `"Pick a day, <Month YYYY>"`.

- [ ] **Step 1: Write failing tests** (Testing Library, fixed system time 2026-11-18 12:00):
  - Strip renders Mon 16 … Sun 22; 19–22 are disabled; tapping 16 sets `selectedDay` to `"2026-11-16"`.
  - Swiping/pressing to the previous week shows 9–15 and leaves `selectedDay` unchanged; the Today pill becomes visible.
  - Today pill hidden on today's week with today selected; pressing it when shown sets `selectedDay` null and shows this week.
  - Week of Mon 26 Oct–Sun 1 Nov 2026 shows "October" (Thursday rule).
  - Calendar: November 2026 grid starts on Mon 26 Oct padding, 1 Nov is a Sunday; › disabled; picking 3 calls `onPick("2026-11-03")`.
  - `recoveryDotColor(80)` = primary, `(60)` = warning, `(30)` = danger, `(null)` = null.
- [ ] **Step 2:** `bun run test components/day` → FAIL.
- [ ] **Step 3:** Implement with NativeWind token classes and existing primitives (`Pill`, etc.).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(day): week strip and month calendar`.

### Task 7: Home on a chosen day

**Files:**
- Modify: `components/home/HomeScreen.tsx`, `components/navigation/TabHeader.tsx`
- Test: `components/home/HomeScreen.test.tsx` (create if missing)

**Interfaces:**
- Consumes: `useDayDashboard`, `useIsToday`, `<DayStrip />`.
- Produces: `TabHeader` gains optional `date?: Date` (default today) rendered with `formatToday(date)`.

Changes: Home uses `useDayDashboard()`; `<DayStrip />` sits between `TabHeader` and "Daily readiness"; TabHeader shows the selected day; on a past day the Daily readiness eyebrow is `"<WEEKDAY>'S DATA"` (e.g. "MONDAY'S DATA", or "YESTERDAY'S DATA" for yesterday), the AI readiness section and the TARGET STRAIN pill are not rendered, and empty-state copy that says "today" says "that day". Ring links still go to /sleep, /strain, /recovery.

- [ ] **Step 1: Write failing tests:** with mock provider and a past day selected: no "AI readiness" text, no "TARGET STRAIN" text, eyebrow "MONDAY'S DATA" for 2026-11-16 (system time 2026-11-18); with today selected both coach texts present.
- [ ] **Step 2:** `bun run test components/home` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(home): show any chosen day`.

### Task 8: Sleep, Strain, Recovery pages and Journal follow the day

**Files:**
- Modify: `components/sleep/SleepScreen.tsx`, `components/strain/StrainScreen.tsx`, `components/recovery/RecoveryScreen.tsx`, `components/journal/JournalScreen.tsx`
- Test: add cases to existing tests for these screens, or create `components/strain/StrainScreen.test.tsx`, `components/journal/JournalScreen.test.tsx`

**Interfaces:**
- Consumes: `useDayDashboard`, `useIsToday`, `useSelectedDayKey`.

Changes:
- Sleep / Strain / Recovery: read the day section from `useDayDashboard()`; page title/eyebrow names the day on past days (same wording as Home's eyebrow); Strain hides the morning target on past days. "Last 14 days" bars and Load balance keep using `useScoreHistory()` (ending today); the bar for the selected day gets the selected style when it is inside the 14 days.
- Journal: when a past day is selected and an entry exists for it, the list scrolls to that entry and marks it (highlight border). No entry → Journal behaves as today.

- [ ] **Step 1: Write failing tests:** Strain page with a past day → no target text, title contains the weekday; Journal with selected day that has an entry → that entry has the highlighted accessibility state (`accessibilityState={{ selected: true }}`).
- [ ] **Step 2:** `bun run test components/strain components/journal` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command → PASS. Then the whole suite once: `bun run test`, `bun run typecheck`, `bun run lint` → all pass.
- [ ] **Step 5:** Commit `feat(day): detail pages and journal follow the chosen day`.

### Task 9: Screenshots and pull request

- [ ] **Step 1:** `bunx expo export -p web`, serve `dist` with an SPA static server, and take Playwright screenshots (deviceScaleFactor 2, phone width) in light and dark of: Home on a past day, the open calendar sheet, Strain page on a past day. Save to project files `day-navigation/`.
- [ ] **Step 2:** Push the branch and open the PR with the screenshots in the description, assign Ruben and request his review.
