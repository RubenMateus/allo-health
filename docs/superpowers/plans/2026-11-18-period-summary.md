# Week and Month Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A summary page for any week or month (reflection on the period plus up to three suggestions for the next), opened from the Home week strip and the month calendar sheet.

**Architecture:** Pure functions in `services/metrics/summary.ts` turn day scores, journal entries and workouts into a `PeriodSummary`. A hook `usePeriodSummary` feeds them from `useDayScores`, the journal store and the provider's `getWorkouts`. `app/summary.tsx` renders `SummaryScreen` inside the existing `DetailLayout`. Nothing new is stored.

**Tech Stack:** Expo Router, React Native + NativeWind, React Query, Zustand, Jest (jest-expo) + Testing Library. Run tests with `bun run test`, never `bun test`.

**Spec:** `docs/superpowers/specs/2026-11-18-period-summary-design.md`

## Global Constraints

- No network calls, analytics, or new storage of health data. Everything is computed on open.
- Weeks run Monday to Sunday; months are calendar months. Day keys are local `YYYY-MM-DD` (`toDayKey` / `fromDayKey` / `shiftDayKey` in `services/journal`).
- At most three suggestions, plain sentences, no medical claims.
- Suggestions show only for the current period and the one before it. Older periods show part 1 only.
- Fewer than 3 scored days in the period: show "Not enough data yet" in place of averages and suggestions.
- Styling with NativeWind token classes (see theming memory / existing screens); light and dark must both work.
- Commits authored as Ruben Mateus <ruben.mateus3@gmail.com>, no Claude references in commits or PR.

## Review Focus

1. Current period part-way through: days after today must not count as "missing" or lower averages; header says "so far".
2. A month that starts mid-week, and a week that spans two months: ranges must be exact (e.g. week of 30 Nov 2026 runs 30 Nov to 6 Dec; Feb 2028 has 29 days).
3. Previous period with no data (first week of use): deltas are null and render as nothing, not "+NaN" or "−0".
4. Journal tag on the period's last day: the "day after" is outside the period, so that occurrence is skipped, not read as a null recovery.
5. Mock provider: scores are never saved, so `useDayScores` recomputes each time; the page must still render (it fills in as days arrive).

Each has a test in the task that owns it (Tasks 1, 2 and 4).

---

## File Structure

- Create `services/metrics/summary.ts`: period ranges, score summary, workout totals, journal summary, tag effects, suggestions. Pure, no React.
- Create `services/metrics/summary.test.ts`.
- Create `hooks/usePeriodSummary.ts`: wires data into `summarizePeriod`.
- Create `components/summary/SummaryScreen.tsx` (+ `SummaryScreen.test.tsx`).
- Create `app/summary.tsx`: re-exports `SummaryScreen` (same as `app/strain.tsx`).
- Modify `app/_layout.tsx`: add `<Stack.Screen name="summary" />`.
- Modify `components/day/DayStrip.tsx` and `components/day/MonthCalendarSheet.tsx`: entry links (+ their tests).

---

### Task 1: Period ranges and score summary

**Files:**
- Create: `services/metrics/summary.ts`
- Test: `services/metrics/summary.test.ts`

**Interfaces:**
- Consumes: `DailyScore` (`services/metrics/daily.ts`), `shiftDayKey`, `fromDayKey`, `toDayKey` (`services/journal`).
- Produces:
  - `type PeriodKind = "week" | "month"`
  - `type Period = { kind: PeriodKind; start: string; end: string }` (inclusive day keys)
  - `periodContaining(kind: PeriodKind, day: string): Period`
  - `shiftPeriod(period: Period, steps: number): Period`
  - `isRecentPeriod(period: Period, today: string): boolean`: true for the period containing today and the one before.
  - `daysInPeriod(period: Period, today: string): string[]`: keys from start to `min(end, today)`.
  - `type ScoreSummary = { scoredDays: number; averages: { recovery: number | null; strain: number | null; sleep: number | null }; deltas: { recovery: number | null; strain: number | null; sleep: number | null }; best: DailyScore | null; toughest: DailyScore | null }`
  - `summarizeScores(days: readonly (DailyScore | null)[], previous: readonly (DailyScore | null)[]): ScoreSummary`

- [ ] **Step 1: Write the failing tests**

```ts
describe("periodContaining", () => {
  it("weeks run Monday to Sunday across a month boundary", () => {
    expect(periodContaining("week", "2026-12-02")).toEqual({ kind: "week", start: "2026-11-30", end: "2026-12-06" });
  });
  it("months are calendar months, leap years included", () => {
    expect(periodContaining("month", "2028-02-10")).toEqual({ kind: "month", start: "2028-02-01", end: "2028-02-29" });
  });
});
it("shiftPeriod moves whole periods", () => {
  expect(shiftPeriod(periodContaining("month", "2026-01-15"), -1).start).toBe("2025-12-01");
  expect(shiftPeriod(periodContaining("week", "2026-11-18"), 1).start).toBe("2026-11-23");
});
it("isRecentPeriod is true only for this and the previous period", () => {
  const today = "2026-11-18";
  const week = periodContaining("week", today);
  expect(isRecentPeriod(week, today)).toBe(true);
  expect(isRecentPeriod(shiftPeriod(week, -1), today)).toBe(true);
  expect(isRecentPeriod(shiftPeriod(week, -2), today)).toBe(false);
});
it("daysInPeriod stops at today for the current period", () => {
  expect(daysInPeriod(periodContaining("week", "2026-11-18"), "2026-11-18")).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
});
describe("summarizeScores", () => {
  // score(date, recovery, strain, sleep) builds a DailyScore with the rest filled by a fixture helper.
  it("averages scored days, skips nulls, picks best and toughest by recovery", () => {
    const s = summarizeScores([score("2026-11-16", 80, 10, 70), null, score("2026-11-18", 40, 14, 60)], []);
    expect(s.scoredDays).toBe(2);
    expect(s.averages).toEqual({ recovery: 60, strain: 12, sleep: 65 });
    expect(s.best?.date).toBe("2026-11-16");
    expect(s.toughest?.date).toBe("2026-11-18");
  });
  it("deltas are null when the previous period has no scores", () => {
    expect(summarizeScores([score("2026-11-16", 80, 10, 70)], [null, null]).deltas).toEqual({ recovery: null, strain: null, sleep: null });
  });
  it("deltas compare with the previous period's averages", () => {
    expect(summarizeScores([score("2026-11-16", 80, 10, 70)], [score("2026-11-09", 70, 12, 70)]).deltas).toEqual({ recovery: 10, strain: -2, sleep: 0 });
  });
});
```

A day counts as scored when `recovery !== null`. Averages are each over the days that have that value. Round averages and deltas to 1 decimal.

- [ ] **Step 2: Run `bun run test services/metrics/summary.test.ts`.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement the functions above in `services/metrics/summary.ts`.** Week start = Monday (`(getDay() + 6) % 7` days back).
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(summary): period ranges and score summary`.

### Task 2: Workouts, journal, tag effects and suggestions

**Files:**
- Modify: `services/metrics/summary.ts`
- Test: `services/metrics/summary.test.ts`

**Interfaces:**
- Consumes: Task 1; `Workout` (`services/health/types.ts`); `JournalEntry`, `JournalTag` (`services/journal/types.ts`); `loadBalance`, `LoadDay`, `LoadVerdict` (`services/metrics/loadBalance.ts`).
- Produces:
  - `type WorkoutTotals = { count: number; minutes: number; activeEnergyKcal: number; byCategory: Record<WorkoutCategory, number> }`
  - `summarizeWorkouts(workouts: readonly Workout[], period: Period): WorkoutTotals`: counts workouts whose `startedAt` local day is in the period.
  - `type JournalSummary = { loggedDays: number; averageMood: number | null; averageEnergy: number | null; topTags: { tag: JournalTag; days: number }[] }` (top 3, most days first)
  - `summarizeJournal(entries: readonly JournalEntry[], period: Period): JournalSummary`
  - `type TagEffect = { tag: JournalTag; days: number; recoveryDifference: number }` (next-day recovery average minus the period's recovery average; negative = lower)
  - `tagEffects(entries, scoresByDay: Record<string, DailyScore | null>, period: Period): TagEffect[]`: only tags on 2+ days whose next day is inside the period and scored.
  - `summaryRules = { sleepAverageBelow: 70, poorNightBelow: 55, poorNightsForSuggestion: 2, tagDifferenceAtLeast: 10, recoveryDropAtLeast: 5, maxSuggestions: 3 } as const`
  - `type Suggestion = { id: "over-reaching" | "room-to-push" | "sleep" | "tag" | "recovery-drop"; text: string }`
  - `suggestionsFor(input: { days: readonly (DailyScore | null)[]; scores: ScoreSummary; tagEffects: TagEffect[] }): Suggestion[]`

Suggestion rules in priority order (copy from the spec):
1. `loadBalance` over the period's last 7 days is `over-reaching`: "Several hard days came on low recovery. Plan an easier day after a hard one."
2. `room-to-push`: "Recovery stayed high on easy days. You have room for a harder session."
3. Average sleep under 70, or 2+ nights with sleepScore under 55: "Sleep was the weak spot. An earlier, steadier bedtime is the easiest win."
4. Strongest negative tag effect with `recoveryDifference <= -10`: "Recovery was {N} lower the day after {tag label}." (N = rounded absolute value; tag label = tag with `-` as space, e.g. "late meal").
5. Recovery delta `<= -5`: "Recovery averaged {N} lower than the period before. Keep an eye on load and sleep."

Return at most 3. Return `[]` when `scores.scoredDays < 3`.

- [ ] **Step 1: Write the failing tests:** `summarizeWorkouts` counts only workouts inside the period and sums minutes from `startedAt`/`endedAt` and kcal (nulls as 0); `summarizeJournal` with no entries gives `loggedDays: 0` and null averages; `tagEffects` ignores a tag whose only next day is outside the period (entry on the period's last day plus one other: no effect returned); `tagEffects` returns `-15` for alcohol on two days followed by recovery 15 under average; `suggestionsFor` returns `[]` with 2 scored days; returns the over-reaching text for 2 days of strain 14 on recovery 40 plus a third scored day; caps at 3 when all five rules fire, in the order above.
- [ ] **Step 2: Run `bun run test services/metrics/summary.test.ts`.** Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run again.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(summary): workouts, journal and next-period suggestions`.

### Task 3: `usePeriodSummary` hook

**Files:**
- Create: `hooks/usePeriodSummary.ts`
- Test: `hooks/usePeriodSummary.test.tsx` (follow `hooks/useDayScores.test.tsx` for the provider/query wrapper)

**Interfaces:**
- Consumes: Tasks 1–2; `useDayScores(from, to)`; `useJournalStore((s) => s.entries)`; `useHealthStore((s) => s.provider).getWorkouts(since: Date)`; `useTodayKey()`.
- Produces: `usePeriodSummary(period: Period): { loading: boolean; days: string[]; scoresByDay: Record<string, DailyScore | null>; scores: ScoreSummary; workouts: WorkoutTotals | null; journal: JournalSummary; suggestions: Suggestion[] | null }`. `suggestions` is `null` when `!isRecentPeriod(period, today)`. `loading` is true until every key in `days` is present in `scoresByDay`.

Workouts via `useQuery({ queryKey: ["period-workouts", provider.kind, period.start, period.end], queryFn: () => provider.getWorkouts(fromDayKey(period.start)) })`, then `summarizeWorkouts`. Previous period scores via a second `useDayScores` over `shiftPeriod(period, -1)`.

- [ ] **Step 1: Failing test:** with the mock provider and a past week, `suggestions` is `null`; with the current week, `days` ends at today and `suggestions` is an array once loaded.
- [ ] **Step 2: Run `bun run test hooks/usePeriodSummary.test.tsx`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run again.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(summary): usePeriodSummary hook`.

### Task 4: Summary screen and route

**Files:**
- Create: `components/summary/SummaryScreen.tsx`, `components/summary/SummaryScreen.test.tsx`, `app/summary.tsx`
- Modify: `app/_layout.tsx` (add `<Stack.Screen name="summary" />` after `recovery`)

**Interfaces:**
- Consumes: Task 3; `DetailLayout`, `DetailSection` (`components/detail/DetailLayout.tsx`); `LoadBalanceCard` (`components/loadBalance/LoadBalanceCard.tsx`, props `days: LoadDay[]`, `width`); `loadBalanceSummary`; `useDayStore((s) => s.selectDay)`; `useLocalSearchParams` / `router` from expo-router.
- Produces: route `/summary?period=week|month&start=YYYY-MM-DD`. Invalid or missing params fall back to the current week.

Layout, top to bottom:
- Title "Week summary" / "Month summary"; subtitle the range ("16 – 22 Nov" or "November 2026"), plus "so far" when the period contains today. ‹ › buttons (`accessibilityLabel` "Previous week"/"Next week" or "…month"), › disabled on the current period; they replace the route params (`router.setParams`).
- "Not enough data yet" `EmptyState` when `scores.scoredDays < 3` (journal and workouts still show).
- Averages row: Recovery, Strain, Sleep with deltas ("+4 vs last week"; nothing when null).
- `LoadBalanceCard` with the period's days and its summary line.
- Best and toughest day rows; tapping calls `selectDay(date)` then `router.dismissTo("/")`.
- Workouts: count, total time, kcal, per category. Hidden when count is 0.
- Journal: logged days, average mood/energy, top tags. Hidden when `loggedDays` is 0.
- "Next week" / "Next month" section with the suggestions, only when `suggestions` is non-null and non-empty, followed by a one-line "How this works" note naming the rules' thresholds from `summaryRules`.

- [ ] **Step 1: Failing render tests** (mock provider, fixed clock 2026-11-18 17:30 as the Strain screen tests do): current week shows "so far" and a disabled next button; a week 3 weeks back shows no "Next week" section; tapping the best day calls `selectDay` with its date; a week with fewer than 3 scored days shows "Not enough data yet".
- [ ] **Step 2: Run `bun run test components/summary`.** Expected: FAIL.
- [ ] **Step 3: Implement screen, route and Stack entry.**
- [ ] **Step 4: Run again.** Expected: PASS. Also `bunx tsc --noEmit`, expected no errors.
- [ ] **Step 5: Commit** `feat(summary): summary page`.

### Task 5: Entry links from the strip and calendar

**Files:**
- Modify: `components/day/DayStrip.tsx`, `components/day/DayStrip.test.tsx`, `components/day/MonthCalendarSheet.tsx`, `components/day/MonthCalendarSheet.test.tsx`

**Interfaces:**
- Consumes: route from Task 4.
- Produces: in `DayStrip`, a "Week summary ›" text link under the day cells, for the strip's visible `weekStart`, that pushes `/summary?period=week&start=<weekStart>`. In `CalendarContent`, a "Month summary ›" link under the grid for the shown month that closes the sheet and pushes `/summary?period=month&start=<shown>-01`.

- [ ] **Step 1: Failing tests:** after swiping/actioning to the previous week, pressing "Week summary" pushes `start=2026-11-09` (with today 2026-11-18); in the sheet, after "Previous month", pressing "Month summary" pushes `start=2026-10-01` and calls `onClose`.
- [ ] **Step 2: Run `bun run test components/day`.** Expected: FAIL.
- [ ] **Step 3: Implement** (mock `expo-router`'s `router.push` in the tests as existing tests do, or add the mock if none).
- [ ] **Step 4: Run again.** Expected: PASS. Then the full suite once: `bun run test`, expected all green.
- [ ] **Step 5: Commit** `feat(summary): open week and month summaries from Home`.

### Task 6: Screenshots and PR

- [ ] Take light and dark screenshots of Home (with the new link), a week summary and a month summary using the web dev build (mock provider) and the recipe in the navigation-and-screenshots memory; save copies to project files `period-summary/`.
- [ ] Commit the PNGs, push, reference them by commit SHA in the PR body, then remove them in a follow-up commit (repo PR convention).
- [ ] Open the PR against main.
