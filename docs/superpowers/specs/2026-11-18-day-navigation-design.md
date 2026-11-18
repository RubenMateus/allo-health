# Browse health data by day

Date: 2026-11-18. Status: draft for Ruben's review.

## Intent

Ruben wants to pick any past day and see what his data looked like that day, one day at a time (not a week summary). Today the app only shows "now". Typical use: "how did I sleep yesterday", "what was my recovery last Monday", "how was three weeks ago".

## Goals

- Pick any past day, as far back as Apple Health / Health Connect has data.
- Home shows that day: strain, recovery and sleep rings, resting HR / HRV / respiratory rate, stress & energy, nutrition & glucose, all as they stood at the end of that day.
- The pages Home opens follow the chosen day: Sleep, Strain, Recovery.
- Journal opens on the chosen day's check-in, if there is one.
- One tap back to today.

## Non-goals

- A week or month summary view.
- Changing Fitness or Biomarkers. They show trends over weeks and ignore the chosen day.
- Coach advice for past days. On any day that is not today, the AI readiness card, the target strain pill (Home and Strain page) and the Readiness page entry are hidden (Ruben's decision).
- A second on-device copy of everything Home shows per day (approach 2, rejected).

## Anti-goals

- No network calls, analytics or new storage of raw health data beyond what the score cache already holds ([[privacy rule]]: health data stays on-device).
- The app must not reopen on a past day. Picking a day is a look-back, not a setting.
- Today's view must not get slower or change because of this.

## How you pick a day (decided with mockups)

Mockups: project files `day-navigation/day-picker-mockups.html` (the "B + C" pair).

- **Week strip on Home**, under the top bar: 7 days, Monday to Sunday, each with weekday, date and a recovery dot (green 67+, amber 34–66, red under 34, none if no score). The chosen day is filled. Days after today are greyed and not tappable.
- **Swipe the strip** to move a week back or forward (never past the current week). Swiping only browses: it shows that week's dots, and Home does not change until a day is tapped (Ruben's decision, 2026-11-18). So the strip has its own visible-week state next to the selected day.
- The month label follows the week on screen; for a week spanning two months it shows the month of that week's Thursday. The calendar sheet opens on that month. (Claude's call.)
- **Month label** at the left above the strip, e.g. "November ▾" (Ruben approved the month name in place of "Prev week"). Tapping it opens a **month calendar sheet**: ‹ › for months (› stops at the current month), a grid of days with the same recovery dots, future days greyed. Picking a day closes the sheet and moves the strip to that day's week.
- **"Today" pill** at the right above the strip, shown when a past day is chosen or the strip is showing another week. Tapping it selects today and scrolls the strip back to this week. (Claude's call on the browsing case.)
- The top bar date (TabHeader) shows the chosen day on Home, e.g. "Mon, 16 Nov", and keeps showing today on the other tabs.
- The section eyebrow on Home says which day it is for past days ("MONDAY'S DATA").

## Approaches

1. **Read the chosen day straight from Health (picked by Ruben).** A shared selected day drives what Home and its pages ask Health for. Reads that are "latest/today" today learn to take a day. Past days are read live (about as fast as Home today) and cached in memory by React Query while the app runs. Works for any day Health has.
2. **Snapshot every finished day on the phone.** Instant, but only for days the app saw, still needs approach 1 for older days, and keeps a second copy of health data on the phone. Rejected.
3. **Day in each page's route params.** Lost when switching tabs, has to be passed through every link. Rejected.

## Design

### Selected day state
- New Zustand store (not persisted), e.g. `stores/dayStore.ts`: `selectedDay: string | null` (YYYY-MM-DD local day key, null = today), `selectDay(key)`, `goToToday()`. The strip's visible week can be local component state; selecting a day (strip or calendar) moves it to that day's week.
- Resets to today on cold start. Also reset when the app returns to the foreground on a later calendar day than the one it left (so a past day chosen last night doesn't stick). Builder's call whether foregrounding on the same day keeps the selection; suggested: keep it.
- Use the existing `toDayKey` / `fromDayKey` helpers (services/journal).

### Data layer
- `HealthProvider` methods that are "now"-based gain an optional day argument, the same pattern as `getStrainInputs(day)` and `getSleep(asOf)`: `getHRV`, `getRestingHR`, `getRespiratoryRate`, `getActiveEnergy`, `getNutrition`, `getGlucose`, `getStressSamples`. Omitted = today, exactly as now. Implement in Apple, Health Connect and mock providers. The Apple provider already has `dayWindow`, `latest(…, asOf)` and range sums to build on.
- "End of day" semantics: a past day's window is local 00:00 to 24:00. Resting HR / respiratory rate / HRV use that day's daily value where the platform has one (as `scoreDay` already does via `dailyValue`), else the latest reading within the 7 days before that day's end.
- Sleep for a past day = the night that ended that morning, using the same `asOf = 18:00 that day` rule as `computeDay` in services/scores/history.ts.
- `loadDashboardData(provider, permissionState, day?)` builds DashboardData for the given day. Its `today: DailyScore` field becomes the chosen day's score (consider renaming to `day`; builder's call). For a past day, the score can come from the score cache when present instead of being recomputed, but Home's other sections still read live.
- `useHealthDashboard()` reads the selected day and includes it in the query key. Today keeps today's refresh behaviour; past-day queries can use a long `staleTime` (finished days rarely change; builder may refetch days within the last 2 days, matching `REFRESH_RECENT_DAYS`).
- The automatic fallback to mock on a failed read (`fallbackToMock`) must only fire for today's load, not for a past day that simply has no data.

### Recovery dots (strip and calendar)
- Come from the score cache (services/scores). Days in the last 14 are already there.
- When the calendar shows a month (or the strip is swiped to a week) with days missing from the cache, score those days in the background one at a time with the existing `computeDay`, save them, and fill the dots in as they arrive. Never block the sheet on this.
- The cache currently drops days older than 45 (`KEEP_DAYS`). Raise it to 730 days (two years) so looked-at months stay cached; each day is a small JSON object. Months older than that are scored again when opened, which is rare enough to accept. (Claude's call.)
- No lower stop on how far back you can go, and no "earliest data" lookup: months before Health has data simply show days with no dots and the empty states. (Claude's call; keeps providers simpler.)
- The 14-day history used by Strain/Recovery pages and the Load balance card is unchanged.

### Screens
- **Home:** week strip + month label + Today pill above "Daily readiness". On a past day: rings, vitals, stress & energy and nutrition & glucose show that day; the AI readiness section and TARGET STRAIN pill are hidden. Loading state for a past day reuses the existing syncing skeleton. A day with no data shows the existing empty states, worded for the past where they say "today".
- **Sleep / Strain / Recovery pages:** opened from a past day's rings, they show that day (they already read `useHealthDashboard`). Titles/eyebrows name the day. Strain page hides the target strain. Their "Last 14 days" bars and Load balance stay as the 14 days ending today, with the chosen day highlighted if it falls inside (builder's call, kept simple on purpose).
- **Readiness page:** only reachable from today (its entry is hidden on past days).
- **Journal:** when a past day is chosen and Ruben opens Journal, scroll to / highlight that day's check-in if one exists. Journal stays otherwise as it is and does not get its own picker.
- **Fitness, Biomarkers:** unchanged, show today.

### Mock provider
- Past days must look different from each other so the feature can be seen in mock mode and on web: vary every newly day-aware read with the existing `dayNoise(day)` helper, the way `getSleep` already varies earlier nights.

## Testing
- Unit tests for each provider's new day arguments (window boundaries, latest-within-7-days, no double counting), for `loadDashboardData` with a past day, for the day store reset rule, and for the backfill of missing calendar days.
- Screenshots of Home on a past day, the open calendar sheet, and a past-day Strain page (light and dark) for the PR, per the repo's PR convention.

## Left to the builder
- Exact visual sizes and spacing of the strip and sheet, following the theme tokens and the mockup.
- Swipe implementation (paged FlatList or similar).
- Naming (`today` vs `day` in DashboardData), and whether to read past-day scores from cache or recompute.
