# Strain and Recovery Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tappable Home rings with a chevron cue, `/strain` and `/recovery` detail pages with 14 days of history cached on-device, and recovery scored against the user's own 30-day baselines.

**Architecture:** One pure function (`scoreDay`) turns a day's raw health inputs plus baselines into a `DailyScore`. The Home dashboard uses it for today; a history service uses it to backfill past days from date-ranged provider reads and caches finished days in a kv-store (`scores.db`). The pages read today from the dashboard query and past days from a new history query.

**Tech Stack:** Expo SDK 57 / React Native, Expo Router, TypeScript, React Query, NativeWind token classes, expo-sqlite kv-store, Jest (jest-expo) via `bun run test`.

**Spec:** `docs/superpowers/specs/2026-11-18-strain-recovery-screens-design.md`

## Global Constraints

- No network requests carrying health data, no analytics. History lives only in `scores.db` (native) / localStorage prefix `allo-health/scores/` (web).
- Baseline window: 30 days before the scored day, excluding it. Under 7 days of values: fall back to HRV 48 ms, resting HR 58 bpm, breathing 15 /min and mark the signal as building.
- History window: last 14 days including today. Only finished days are stored. Every load recomputes the last 2 finished days and any stored day under 7 days old with a null strain or recovery.
- Recovery weights unchanged: HRV 35%, resting HR 30%, sleep 25%, breathing 10%. Status thresholds unchanged (strain HIGH ≥15, MODERATE ≥9; recovery HIGH ≥75, MODERATE ≥50).
- Target strain everywhere (Home pill, Readiness, Strain page) is the morning target: the coach's range with strain treated as 0. Coach mode and message stay live.
- Styling: NativeWind token classes only, no hex. Both themes. Pages use `DetailLayout` / `DetailSection`.
- Commands: `bun run test`, `bun run typecheck`, `bun run lint` (never `bun test`).
- Commits authored as Ruben Mateus, no Claude references.

## Review Focus

1. A brand-new user with zero history: baselines all "building", 14-day bars all empty, no crash, no zeros drawn as real bars.
2. A day with heart rate but no sleep (or sleep but no HRV): strain shows, recovery is null with the missing input named, not 0.
3. Late watch sync: yesterday stored with null strain gets recomputed on the next load.
4. Device time zone / DST: day keys come from local midnight (`toDayKey`), a 23- or 25-hour day still buckets correctly.
5. Mock provider on web: every page renders full charts so screenshots work.

---

## File map

| File | Responsibility |
|---|---|
| `services/metrics/daily.ts` (new) | Baselines, strain zones and curve, `scoreDay` |
| `services/metrics/index.ts` | `calculateStrainScore` reuses the zone table |
| `services/coaching/index.ts` | `morningTargetStrain` |
| `services/health/types.ts`, `appleHealthProvider.ts`, `healthConnectProvider.ts`, `mockProvider.ts` | Date-ranged `getSleep(asOf?)`, `getStrainInputs(day?)` |
| `services/health/dashboard.ts` | Real baselines via `scoreDay`; exposes today's `DailyScore` and strain inputs |
| `services/scores/{types,storage,storage.web,history}.ts` (new) | Cache + backfill |
| `hooks/useScoreHistory.ts` (new), `hooks/useHealthSync.ts` | Query + sync refresh |
| `components/charts/GlowRing.tsx`, `components/home/HomeScreen.tsx` | Chevron + all rings tappable |
| `components/charts/StrainCurve.tsx` (new), `components/strain/StrainScreen.tsx`, `app/strain.tsx` | Strain page |
| `components/recovery/RecoveryScreen.tsx`, `app/recovery.tsx`, `components/readiness/ReadinessScreen.tsx` | Recovery page, Readiness link |
| `app/_layout.tsx` | Register `strain`, `recovery` |

---

### Task 1: Daily scoring logic

**Files:**
- Create: `services/metrics/daily.ts`, `services/metrics/daily.test.ts`
- Modify: `services/metrics/index.ts` (`calculateStrainScore` uses `strainZoneOf`)

**Interfaces:**
- Produces:
  - `BASELINE_DAYS = 30`, `MIN_BASELINE_DAYS = 7`, `FALLBACK_BASELINES = { hrv: 48, restingHeartRate: 58, respiratoryRate: 15 }`
  - `type SignalKind = "hrv" | "restingHeartRate" | "respiratoryRate"`
  - `type RecoverySignal = { value: number | null; baseline: number; baselineDays: number; building: boolean }`
  - `type StrainZone = { zone: 1 | 2 | 3 | 4 | 5; minutes: number; weight: number }`
  - `type DailyScore = { date: string; strain: number | null; recovery: number | null; sleepScore: number | null; strainBreakdown: { zones: StrainZone[]; activeEnergyKcal: number } | null; recoveryInputs: { hrv: RecoverySignal; restingHeartRate: RecoverySignal; respiratoryRate: RecoverySignal; sleepScore: number | null }; computedAt: string }`
  - `strainZoneOf(intensity: number): { zone: 1|2|3|4|5; weight: number }` — zones by heart-rate-reserve fraction: <0.6 → 1 (0.2), <0.7 → 2 (0.5), <0.8 → 3 (0.9), <0.9 → 4 (1.4), else 5 (2).
  - `baselineFor(kind: SignalKind, history: HealthSample[], date: string): { baseline: number; baselineDays: number; building: boolean }` — mean of values whose local day is in `[date − 30, date − 1]`.
  - `dailyValue(history: HealthSample[], date: string): number | null` — that day's value from a daily-average series.
  - `strainZones(inputs: StrainInputs): StrainZone[]` — always five entries, zone 1 first.
  - `strainCurve(inputs: StrainInputs): { timestamp: string; strain: number }[]` — running score after each bucket, same formula as `calculateStrainScore`, last point equals it.
  - `scoreDay(input: { date: string; sleep: SleepData | null; strainInputs: StrainInputs | null; signals: Record<SignalKind, number | null>; histories: Record<SignalKind, HealthSample[]>; now: Date }): DailyScore` — strain null when no HR samples and 0 kcal (current rule); recovery null if any signal or sleep missing; otherwise `calculateRecoveryScore` with the baselines.

- [ ] **Step 1: Write failing tests** in `daily.test.ts`:
  - `strainZoneOf(0.55)` → zone 1 / 0.2; `0.95` → zone 5 / 2.
  - `calculateStrainScore` gives the same result as before for an existing fixture (copy one from `services/metrics/index.test.ts`).
  - `baselineFor` with 10 daily values in the 30 days before → their mean, `building: false`; with 5 → `{ baseline: 48, baselineDays: 5, building: true }` for HRV; the scored day's own value is excluded.
  - `strainZones` minutes sum to bucket count × 5; `strainCurve(...).at(-1).strain === calculateStrainScore(...)`.
  - `scoreDay` with sleep null → `recovery: null`, `sleepScore: null`, strain still set; with no HR and 0 kcal → `strain: null`, `strainBreakdown: null`.
- [ ] **Step 2:** `bun run test services/metrics` → new tests FAIL (module missing).
- [ ] **Step 3:** Implement `daily.ts`; refactor `calculateStrainScore` to use `strainZoneOf`.
- [ ] **Step 4:** `bun run test services/metrics` → PASS.
- [ ] **Step 5:** Commit `feat(metrics): daily scoring with personal baselines`.

### Task 2: Morning target strain

**Files:** Modify `services/coaching/index.ts`, `services/coaching/index.test.ts`, `components/home/HomeScreen.tsx` (TARGET STRAIN pill), `components/readiness/ReadinessScreen.tsx` (header value and target chart).

**Interfaces:** Produces `morningTargetStrain(scores: { recoveryScore: number | null; sleepScore: number | null }): readonly [number, number]` = `coachingEngine.recommend({ ...coachingInputFrom({ ...scores, strainScore: 0 }) }).targetStrain`.

- [ ] **Step 1:** Test: recovery 80, sleep 80 → `[12, 16]` even though `recommend` with strain 14 returns `[8, 12]`; recovery 40 → `[4, 7]`.
- [ ] **Step 2:** Run `bun run test services/coaching` → FAIL.
- [ ] **Step 3:** Implement; switch Home and Readiness target displays to it (mode/title/message still from the live `recommend`).
- [ ] **Step 4:** Run → PASS; `bun run typecheck`.
- [ ] **Step 5:** Commit `feat(coaching): fix today's target strain to the morning target`.

### Task 3: Date-ranged provider reads

**Files:** Modify `services/health/types.ts`, `appleHealthProvider.ts`, `healthConnectProvider.ts`, `mockProvider.ts` and their tests.

**Interfaces:**
- `getSleep(asOf?: Date): Promise<SleepData | null>` — read window `[asOf − 36h, asOf]`, `pickMainSleep(nights, asOf)`. Default `asOf = now`.
- `getStrainInputs(day?: Date): Promise<StrainInputs>` — HR read and bucketed over `[local midnight of day, min(next midnight, now)]`, active energy summed over the same window, resting HR = latest reading in the 7 days before the window end. Default today (current behaviour).
- History callers pass `asOf` = 18:00 local on the scored day for sleep, so the night ending that morning is picked and an afternoon nap (< 3 h) is not.
- Apple `latest()` and HC `latest()` gain an optional `asOf: Date` end.
- Mock: past days return deterministic variations (seed from the day key) so bars differ day to day; today unchanged.

- [ ] **Step 1:** Tests (existing provider test files mock the native APIs): `getStrainInputs(new Date(2026, 10, 15))` queries HR and energy with start 2026-11-15 00:00 and end 2026-11-16 00:00 local; `getSleep(asOf)` passes a window ending at `asOf`; no-arg calls keep current windows. Mock: two different past days give different strain inputs; same day twice gives identical inputs.
- [ ] **Step 2:** Run `bun run test services/health` → FAIL.
- [ ] **Step 3:** Implement on all three providers.
- [ ] **Step 4:** Run → PASS; `bun run typecheck`.
- [ ] **Step 5:** Commit `feat(health): read sleep and strain inputs for a given day`.

### Task 4: Dashboard uses real baselines

**Files:** Modify `services/health/dashboard.ts`; create `services/health/dashboard.test.ts`.

**Interfaces:**
- Consumes `scoreDay`, `baselineFor`, `dailyValue` (Task 1).
- `loadDashboardData` additionally reads `getBiomarkerHistory` for `hrv`, `restingHeartRate`, `respiratoryRate` since today − 31 days (in the same `allSettled`). Today's signal = today's daily value, else the current latest reading.
- `DashboardData` gains `today: DailyScore` and `strainInputs: StrainInputs`. Existing `recoveryScore`, `strainScore`, `sleepScore` equal `today.recovery/strain/sleepScore`. Stress timeline HRV baseline = `today.recoveryInputs.hrv.baseline`.
- A failed history read means that signal's baseline is building (fallback), not a dashboard error.

- [ ] **Step 1:** Test with `mockHealthProvider`: `data.recoveryScore === data.today.recovery`; baselines come from mock history (`building: false`); a provider stub whose `getBiomarkerHistory` rejects still returns a recovery score using fallbacks with `building: true`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun run test services/health` → PASS.
- [ ] **Step 5:** Commit `feat(recovery): score recovery against 30-day personal baselines`.

### Task 5: Score history cache and backfill

**Files:** Create `services/scores/types.ts`, `storage.ts` (`new SQLiteStorage("scores.db")`), `storage.web.ts` (`createBrowserStorage("scores", { asyncReads: true })`), `history.ts`, `history.test.ts`, `hooks/useScoreHistory.ts`. Modify `hooks/useHealthSync.ts` (`HEALTH_QUERY_KEYS` += `"score-history"`).

**Interfaces:**
- `type ScoreStorage = { getItem(key: string): Promise<string | null> | string | null; setItem(key: string, value: string): Promise<void> | void }` (both storage files satisfy it). One key, `"days"`, holding `Record<string, DailyScore>`; entries older than 45 days are dropped on write.
- `HISTORY_DAYS = 14`, `REFRESH_RECENT_DAYS = 2`, `RETRY_NULL_DAYS = 7`.
- `loadScoreHistory(provider: HealthProvider, storage: ScoreStorage, today: DailyScore, now = new Date()): Promise<DailyScore[]>` — 14 entries oldest first, last is `today` (passed in from the dashboard, never stored). For each of the 13 past days: use the stored entry unless it is missing, within the last 2 finished days, or under 7 days old with null strain or recovery; recompute those with `scoreDay` from `getSleep(18:00 that day)`, `getStrainInputs(day)` and one set of biomarker histories read once since `now − 14 − 31` days. Days computed sequentially oldest first; one failing day becomes a null-score entry, not a thrown error. Save once at the end.
- `useScoreHistory()` — `queryKey: ["score-history", provider.kind]`, enabled once the dashboard has data; returns `DailyScore[]`.

- [ ] **Step 1:** Tests with an in-memory storage and a counting stub provider: first load computes 13 days and stores 13; second load the same day recomputes only 2 (days −1, −2); a stored day 4 days old with `strain: null` is recomputed, one 10 days old is not; result length 14, last item is `today`; today is not in storage; a provider throwing for one day yields a null entry for that day.
- [ ] **Step 2:** Run `bun run test services/scores` → FAIL.
- [ ] **Step 3:** Implement `history.ts`, storage files, hook; add the key to `HEALTH_QUERY_KEYS`.
- [ ] **Step 4:** Run → PASS; also `bun run test hooks`.
- [ ] **Step 5:** Commit `feat(scores): cache 14 days of strain and recovery on-device`.

### Task 6: Tap cue on the Home rings

**Files:** Modify `components/charts/GlowRing.tsx`, `components/home/HomeScreen.tsx`.

**Interfaces:** `GlowRing` gains `onPress?: () => void` and `accessibilityHint?: string`. With `onPress`, the whole ring is a `Pressable` (`active:opacity-70`, `accessibilityRole="button"`) and the label row reads `STRAIN` + a `ChevronRight` icon (lucide, size 12, `colors.textMuted`). Home passes `onPress` for all three rings (`/strain`, `/recovery`, `/sleep`) with `Haptics.selectionAsync()`; the Sleep-only special case goes away.

- [ ] **Step 1:** Implement (UI only; no unit test, covered by screenshots in Task 9).
- [ ] **Step 2:** `bun run typecheck && bun run lint` → clean.
- [ ] **Step 3:** Commit `feat(home): make every ring tappable with a chevron cue`.

### Task 7: Strain page

**Files:** Create `app/strain.tsx`, `components/strain/StrainScreen.tsx`, `components/charts/StrainCurve.tsx`. Modify `app/_layout.tsx` (`<Stack.Screen name="strain" />`).

**Interfaces:** Consumes `useHealthDashboard().data.{today, strainInputs, recoveryScore, sleepScore}`, `strainCurve`, `strainZones` (via `today.strainBreakdown`), `morningTargetStrain`, `useScoreHistory`.
- `StrainCurve({ points, band, width, height?, accessibilityLabel })`: 0–21 y-axis, time-of-day x-axis from midnight to now, shaded `band`.
- Layout: `DetailLayout title="Strain" value={score} unit="/ 21" status={LOW|MODERATE|HIGH} caption="Target today 12–16"`. Sections: "Today" (curve), "Where it came from" (five zone rows: zone, minutes, ×weight; then active kcal), "Last 14 days" (`BarChart`, null days drawn as empty, label = 14-day average of non-null days, `band` = none), "How the score works" (zone weighting, 21 cap). No strain today → empty state like `SleepScreen`'s.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `bun run typecheck && bun run lint` → clean.
- [ ] **Step 3:** Commit `feat(strain): add the Strain page`.

### Task 8: Recovery page and Readiness link

**Files:** Create `app/recovery.tsx`, `components/recovery/RecoveryScreen.tsx`. Modify `app/_layout.tsx`, `components/readiness/ReadinessScreen.tsx`.

**Interfaces:** Consumes `data.today.recoveryInputs`, `useScoreHistory`.
- Pure helper in `services/metrics/daily.ts` (add test there): `compareToBaseline(kind: SignalKind, signal: RecoverySignal): { percent: number; better: boolean } | null` — null when building or value null; `better` is higher-is-better for HRV, lower-is-better for resting HR and breathing.
- Layout: `DetailLayout title="Recovery" value={score} unit="%" status=...`. "What moved it": rows HRV (35%), Resting HR (30%), Sleep (25%, row taps to `/sleep`), Breathing (10%), each with today, "avg N", and `+11%` / `better` / `worse`, or "Building your baseline (N of 7 days)". Recovery null → "No data" and the rows say which input is missing. "Last 14 days": `BarChart` bars coloured by status (success / warning / danger tokens per existing status colours). "How the score works".
- Readiness: replace the "Behind recovery" card body with a tappable card "See what moved recovery" → `/recovery`. "What it's based on" unchanged.

- [ ] **Step 1:** Add `compareToBaseline` test: HRV 52 vs 47 → `{ percent: 11, better: true }`; resting HR 56 vs 58 → `better: true`; building → null. Run → FAIL, implement, run → PASS.
- [ ] **Step 2:** Implement screens.
- [ ] **Step 3:** `bun run typecheck && bun run lint && bun run test` → clean.
- [ ] **Step 4:** Commit `feat(recovery): add the Recovery page and link it from Readiness`.

### Task 9: Verify, screenshot, PR

- [ ] **Step 1:** `bun run typecheck && bun run lint && bun run test` → all pass.
- [ ] **Step 2:** `bunx expo export -p web`, serve, Playwright screenshots (light and dark, phone width) of Home rings, `/strain`, `/recovery`, `/readiness`; copy to `/mnt/project-files/strain-recovery/`.
- [ ] **Step 3:** Push branch, open PR to main with screenshots linked by commit SHA (commit PNGs, then remove in the next commit), body without attribution footers.
