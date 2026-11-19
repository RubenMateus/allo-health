# Energy Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single daily energy number into a 5-minute running balance with its own `/energy` page, stored per finished day so "usual" can be compared.

**Architecture:** A pure model (`services/metrics/energy.ts`) walks a full calendar day of 5-minute stress readings plus the night's sleep stages and returns the curve and totals. `scoreDay` stores a compact summary (`DailyScore.energy`) in the existing score history; the dashboard keeps the 5-minute points for the page. A new full-day provider read feeds it; the Home stress chart keeps its 4-hour read.

**Tech Stack:** Expo / React Native, Expo Router, TypeScript, React Query, Zustand, NativeWind, Jest (jest-expo). Use `bun run test`, `bun run typecheck`, `bun run lint` (never `bun test`).

**Spec:** `docs/superpowers/specs/2026-11-19-energy-bank-design.md`

## Global Constraints

- Balance is 0 to 100, clamped after every 5-minute step.
- Every day opens at 20 at 00:00, computed on its own (no chaining). Sleep of that night before midnight is credited at 00:00.
- Step precedence: asleep (stage not `awake`) charges, deep and REM more than light/asleep; awake stress <= 25 small charge; 26 to 50 small drain; > 50 larger drain scaling with stress; no reading = no change.
- A good ~7.5 h night should take roughly 20 to roughly 90. Rates are named constants with a comment.
- Usual = median of stored `hourly[h]` over the last 14 finished days with energy; needs >= 5 such days. "About the same" within ±5.
- Mock scores are never persisted (existing `scoreStorageFor`); no network calls.
- Styling: NativeWind token classes only, both themes; no hard-coded hex.
- Commits authored as Ruben Mateus, no Claude references.

## Review Focus

1. Today before any reading (just after midnight, no stress samples): page and Home show the empty state, not 20%. → Task 3 test `energy is null when the day has no stress readings`.
2. Watch removed for hours mid-day: the curve stays flat over the gap, totals unaffected. → Task 1 test `gaps leave the balance unchanged`.
3. Sleep night that started before midnight and a nap in the afternoon: only the night ending that morning counts (that's what `sleepAsOf` reads); pre-midnight part credited at 00:00. → Task 1 test `credits pre-midnight sleep at the first point`.
4. Fewer than 5 stored days (new users, sample data): coaching shows the "still learning" copy, never a comparison against mock days. → Task 4 test `usual is null with fewer than 5 days`.
5. Past day selected via browse by day: page shows closing value, compares close with usual close, line runs to 24:00. → Task 5 test `past day shows closing balance and close comparison`.

---

### Task 1: Energy model

**Files:**
- Create: `services/metrics/energy.ts`
- Test: `services/metrics/energy.test.ts`

**Interfaces:**
- Consumes: `StressSummary["samples"]` (`{ timestamp: string; value: number }[]`, output of `calculateStressTimeline` in `services/metrics/index.ts`), `SleepSegment` (`services/health/types.ts`).
- Produces:
  ```ts
  export const ENERGY_OPENING = 20;
  export type EnergyPoint = { timestamp: string; value: number };
  export type EnergySummary = {
    hourly: (number | null)[]; // 25 values, 00:00..24:00; null after the last reading of today
    charged: number;           // rounded
    drained: number;           // rounded, positive
    close: number;             // balance at the last point
    lastCharged: { at: string; value: number } | null;
  };
  export type EnergyDay = EnergySummary & { points: EnergyPoint[] };
  export function calculateEnergyDay(input: {
    date: string;                                   // YYYY-MM-DD, local day
    stress: { timestamp: string; value: number }[]; // 5-min, any order
    sleepStages: SleepSegment[];                    // night ending that morning
  }): EnergyDay | null;                             // null when stress is empty
  ```

- [ ] **Step 1: Write the failing tests** in `energy.test.ts`, building inputs with small helpers (`at("08:05")` → ISO timestamp on `2026-11-10`):
  - `returns null without stress readings` → `calculateEnergyDay({date, stress: [], sleepStages: []})` is `null`.
  - `opens at 20` → one calm-ish reading (value 30) at 09:00: `points[0].value` is within 20 ± 1.
  - `charges overnight` → stages deep/rem/light 00:00–07:30, stress 5-min readings all night value 10: `hourly[7]` between 80 and 95.
  - `calm awake charges, stress drains` → awake readings value 10 for 1 h raise balance; value 80 for 1 h lowers it more than value 40 for 1 h does.
  - `gaps leave the balance unchanged` → readings 09:00–10:00 and 14:00–15:00 at value 40: `hourly[11]`, `hourly[12]`, `hourly[13]` equal the balance at 10:00.
  - `clamps to 0..100` → 20 h of value 100 never below 0; 12 h of deep sleep never above 100.
  - `totals add up` → `ENERGY_OPENING + charged - drained` equals `close` (±1 for rounding).
  - `credits pre-midnight sleep at the first point` → stages 22:30 (previous day)–06:30: `points[0].value` > 20, and is higher than the same input with stages starting 00:00.
  - `lastCharged is the end of the latest charging run` → sleep to 07:00 then drains: `lastCharged.at` is 07:00's point, `value` equals the balance there.
  - `hourly is null after the last reading` → readings only to 13:00: `hourly[14]` through `hourly[24]` are `null`.

- [ ] **Step 2: Run** `bun run test services/metrics/energy.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `calculateEnergyDay`** in `services/metrics/energy.ts`. Sort stress by time; for each reading decide asleep from `sleepStages` (stage !== "awake" covering the reading's time) else from stress value; apply the step's delta and clamp. Pre-midnight credit = asleep minutes of `sleepStages` before 00:00 of `date` × the matching sleep rates, added to the opening before the first point. `hourly[h]` = balance at the last point at or before h:00 (h=0 uses opening + credit), `null` once past the last reading. Rates are named constants (`SLEEP_DEEP_RATE`, `SLEEP_REM_RATE`, `SLEEP_LIGHT_RATE`, `CALM_RATE`, `MILD_DRAIN_RATE`, `STRESS_DRAIN_PER_POINT`), per 5 minutes, tuned until the overnight test passes.

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "feat: energy bank model"`.

### Task 2: Full-day stress read

**Files:**
- Modify: `services/health/nativeSamples.ts` (beside `buildStressSamples`), `services/health/types.ts:157`, `services/health/appleHealthProvider.ts:532`, `services/health/healthConnectProvider.ts:439`, `services/health/mockProvider.ts:375`, and `services/health/provider.web.ts` if it implements the interface itself.
- Test: `services/health/nativeSamples.test.ts`, `services/health/mockProvider.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // nativeSamples.ts
  export function buildDayStressSamples(heartRate: HealthSample[], hrv: HealthSample[], from: Date, to: Date): StressSample[];
  // HealthProvider
  /** Every 5-minute stress bucket of the calendar day (today: up to now). */
  getDayStressSamples(day?: Date): Promise<StressSample[]>;
  ```

- [ ] **Step 1: Write the failing tests**
  - `buildDayStressSamples keeps every bucket of the day` → heart rate every minute 00:00–12:00: returns 144 samples, first timestamp 00:05, last 12:00.
  - `buildDayStressSamples ignores readings outside the window` → a reading the previous evening is not included.
  - mock: `getDayStressSamples covers the whole past day` → for `daysAgo(2)` every sample is on that day and there are more than 48.
- [ ] **Step 2: Run** `bun run test services/health/nativeSamples.test.ts services/health/mockProvider.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Extract the HRV-nearest pairing from `buildStressSamples` into a shared helper so both use it; `buildDayStressSamples` buckets over `[from, to]` with no `count` slice. Native providers: window = local midnight of `day` (default today) to the day's end or now, reading heart rate and HRV for that window. Mock: same pairing as `getStressSamples`, unsliced. `buildStressSamples` behaviour stays as is.
- [ ] **Step 4: Run** the same command plus `bun run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: full-day stress read for energy"`.

### Task 3: Store energy with the day's scores; dashboard uses it

**Files:**
- Modify: `services/metrics/daily.ts` (`DailyScore`, `scoreDay`), `services/scores/history.ts:276` (`computeDay`), `services/health/dashboard.ts`, `services/metrics/index.ts` (remove `calculateEnergyBattery`), `components/home/HomeScreen.tsx` (read the new field; full Home change is Task 6)
- Test: `services/metrics/daily.test.ts`, `services/scores/history.test.ts`, `services/health/dashboard.test.ts`, `services/metrics/index.test.ts` (drop battery tests)

**Interfaces:**
- Consumes: `calculateEnergyDay`, `EnergySummary`, `EnergyPoint` (Task 1); `getDayStressSamples` (Task 2).
- Produces:
  - `DailyScore.energy: EnergySummary | null` (optional when read from storage: older stored days lack it; treat `undefined` as `null`).
  - `scoreDay` input gains `dayStress: StressSample[]`; stress values use `calculateStressTimeline(dayStress, recoveryInputs.restingHeartRate baseline, recoveryInputs.hrv baseline)`, stages from `sleep?.stages ?? []`.
  - `DashboardData.energyPoints: EnergyPoint[]` (empty when `today.energy` is null); `DashboardData.energyBattery` removed.

- [ ] **Step 1: Write the failing tests**
  - daily: `energy is null when the day has no stress readings`; `scoreDay stores energy summary without points` (`"points" in score.energy` is false, `hourly.length === 25`).
  - history: `computeDay reads the full-day stress` (fake provider records a `getDayStressSamples` call with that day; stored day has `energy`); `stored days without energy load as energy null`.
  - dashboard: `dashboard exposes energy points for the selected day` (mock provider, past day: `energyPoints.length > 0`, last point on that day; `today.energy.close` equals last point value).
- [ ] **Step 2: Run** those four test files — Expected: FAIL.
- [ ] **Step 3: Implement.** `scoreDay` calls `calculateEnergyDay` and strips `points`; `computeDay` adds `provider.getDayStressSamples(day)` to its `allSettled` reads (rejected → `[]`); `loadDashboardData` adds the same read to its list and keeps `points` from its own `calculateEnergyDay` run for `energyPoints` (call the model once: have `scoreDay` accept an optional precomputed `EnergyDay`, or compute in dashboard and pass it in — builder's choice, one computation per load). Remove `calculateEnergyBattery`, `restorativeMinutes` and `energyBattery`; Home temporarily reads `data.today.energy?.close ?? null` (today: the last point's value).
- [ ] **Step 4: Run** `bun run test && bun run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: store energy bank with daily scores"`.

### Task 4: Usual and coaching

**Files:**
- Modify: `services/metrics/energy.ts`
- Create: `hooks/useEnergyUsual.ts`
- Test: `services/metrics/energy.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const USUAL_DAYS = 14;
  export const MIN_USUAL_DAYS = 5;
  export function energyUsual(days: DailyScore[], hour: number): number | null; // median of hourly[hour], last 14 days with energy before the given set's end
  export function energyCoaching(input: { value: number; usual: number | null; at: string /* "HH:MM" */; isToday: boolean }): string;
  export function useEnergyUsual(dayKey: string, hour: number): number | null; // hooks/useEnergyUsual.ts, uses useDayScores(dayKey-14, dayKey-1)
  ```

- [ ] **Step 1: Write the failing tests**
  - `usual is null with fewer than 5 days` (4 days with energy → `null`; days with `energy: null` don't count).
  - `usual is the median at that hour` (hourly[9] values 40, 50, 60, 70, 90 → 60).
  - `uses only the latest 14 days` (16 days given, the 2 oldest have extreme values → ignored).
  - coaching copy, exact strings:
    - `usual: null` → `"Still learning your usual pattern. Check back after a few more days."`
    - today, value 42, usual 55, at "14:00" → `"Your Energy Bank is 13% lower than usual for 14:00."`
    - today, value 70, usual 60 → `"Your Energy Bank is 10% higher than usual for 14:00."`
    - within ±5 → `"Your Energy Bank is about the same as usual for 14:00."`
    - past day (`isToday: false`), value 30, usual 45 → `"You ended the day 15% lower than usual."` (higher / about the same analogously: `"You ended the day 8% higher than usual."`, `"You ended the day about the same as usual."`)
- [ ] **Step 2: Run** `bun run test services/metrics/energy.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the two pure functions and the hook (past day: `hour = 24`, i.e. usual close).
- [ ] **Step 4: Run** again — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: energy bank usual and coaching"`.

### Task 5: Energy Bank page

**Files:**
- Create: `app/energy.tsx` (re-exports the screen like `app/strain.tsx`), `components/energy/EnergyScreen.tsx`, `components/charts/EnergyCurve.tsx`
- Modify: `components/navigation/RootStack.tsx` (add `<Stack.Screen name="energy" />` beside `strain`)
- Test: `components/energy/EnergyScreen.test.tsx` (pattern: `components/strain/StrainScreen.test.tsx`)

**Interfaces:**
- Consumes: `useDayDashboard()` (`data.today.energy`, `data.energyPoints`, `data.sleep?.stages`), `useEnergyUsual`, `energyCoaching`, `useIsToday`, `usePastDayEyebrow`, `DetailLayout`/`DetailSection`/`useDetailChartWidth`, `EmptyState`, `Card`.
- Produces: route `/energy`; `EnergyCurve({ points, sleepBands, now, width, height?, endLabel?, accessibilityLabel })` where `sleepBands: { start: string; end: string }[]`.

- [ ] **Step 1: Write the failing tests**
  - `shows today's balance, last charged, totals and coaching` → title "Energy Bank", value is the last point, text "Last charged to X% at HH:MM", "Total charged", "Total drained", coaching string from `energyCoaching`.
  - `past day shows closing balance and close comparison` → selected past day: value is `today.energy.close`; coaching starts "You ended the day".
  - `empty state without readings` → text "Heart rate and HRV readings build your Energy Bank through the day." and no chart.
- [ ] **Step 2: Run** `bun run test components/energy` — Expected: FAIL.
- [ ] **Step 3: Implement.** Order: `DetailLayout` header with the battery value and status (`energyStatus` words, moved from HomeScreen into `services/metrics/energy.ts` as `energyStatus(value: number | null): string`), "Last charged" line, two stat tiles (Total charged / Total drained), coaching card, chart section "ENERGY LEVEL" with `EnergyCurve` (0–100 y axis, 00:00–24:00 x axis, sleep stages not `awake` merged into shaded bands, line stops at now on today; base it on `StrainCurve`'s axes and sizing), `PrivacyNote`. The battery visual can be the existing `BatteryMeter` from HomeScreen (export it) at page width.
- [ ] **Step 4: Run** `bun run test components/energy && bun run typecheck && bun run lint` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: energy bank page"`.

### Task 6: Home row opens the page; screenshots

**Files:**
- Modify: `components/home/HomeScreen.tsx:420-442`
- Test: `components/home/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `energyStatus` (Task 5), `data.today.energy`, `data.energyPoints`.

- [ ] **Step 1: Write the failing test** `opens energy bank` → the row labelled "ENERGY BANK" shows the live value and pressing it calls `router.push("/energy")`.
- [ ] **Step 2: Run** it — Expected: FAIL.
- [ ] **Step 3: Implement.** Label "ENERGY BANK", value = last point (today) or `close` (past day), keep `BatteryMeter`, add a chevron like the other tappable Home rows, wrap in the same pressable pattern used by the rings (`router.push`).
- [ ] **Step 4: Run** `bun run test && bun run typecheck && bun run lint` — Expected: all PASS.
- [ ] **Step 5: Screenshots.** Web build with the mock provider (recipe in `docs/DEVELOPMENT.md`): Home and `/energy`, light and dark, today and a past day. Save under `/mnt/project-files/energy-bank/`; for the PR, commit-then-remove as in earlier PRs.
- [ ] **Step 6: Commit** `git commit -m "feat: energy bank on home"`.
