# Strain and Recovery pages, and a tap hint on the Home rings

## Why

Home is a short summary: three rings (Strain, Recovery, Sleep) and a few vitals.
Since PR #40 the Sleep ring opens a full Sleep page, but nothing on the ring says it
can be tapped, and Strain and Recovery open nothing. Ruben wants a visible tap cue,
and Strain and Recovery pages that give the detail behind each number, including how
it has moved over past days.

## Goals

- All three Home rings are tappable and show the same small cue.
- A Strain page: today's score against the coach's target, what built it, and the
  last 14 days.
- A Recovery page: today's score, what moved it compared to your own normal, and the
  last 14 days.
- Recovery compares you to your own 30-day averages, not constants in the code.

## Non-goals

- Comparing strain against recovery over time, and reminders or alerts. These moved
  to their own thread.
- Sleep history on the Sleep page (it may reuse this work later, but not here).
- Changing how strain or recovery are calculated, beyond swapping in real baselines.

## Anti-goals

- Any network request carrying health data, or analytics. History stays on the phone.
- Pages that load slowly every time they open because they re-read weeks of
  per-minute heart rate.
- Numbers that claim to be "your average" but are not.

## Constraints

- iOS (HealthKit) and Android (Health Connect) only; web is a dev target that uses
  the mock provider and must keep working.
- Read-only health access. No new permissions are expected: HR, HRV, resting HR,
  respiratory rate, active energy and sleep are already read.
- On-device storage uses `expo-sqlite/kv-store` (as journal, profile and settings do),
  with a web variant (`*.web.ts`) like the existing storage modules.

## Approaches considered

1. **Recalculate past days from Health every time a page opens.** Full history from
   day one, but strain needs per-minute heart rate for each day, so each open reads
   a lot from HealthKit / Health Connect.
2. **Save each day's scores on the phone as the app computes them.** Cheap, but the
   chart starts empty and has gaps on days the app was not opened.
3. **Backfill the last 14 days from Health once, then keep finished days on the
   phone (picked by Ruben).** Full chart from the first open; after that only today
   is read. More code than 2.

## Design

### Tap hint (Home)

- Strain, Recovery and Sleep rings are all `Pressable`, opening `/strain`,
  `/recovery` and `/sleep`, with haptics and `active:opacity-70` as Sleep has now.
- Each ring label gets a small chevron (`STRAIN ›`). The chevron is part of
  `GlowRing`'s label row, shown when the ring is given an `onPress` (or a
  `showChevron` prop). Accessibility label and hint per ring, like Sleep's.

### Real baselines

- Baseline = the average of the daily values over the 30 days before the day being
  scored (not including that day), from `getBiomarkerHistory` for `hrv`,
  `restingHeartRate` and `respiratoryRate`. These reads already exist for the
  Biomarkers tab.
- **Daily value of a signal (my call):** for every day, past or today, HRV, resting HR
  and breathing rate are that date's daily average from `getBiomarkerHistory`. If
  today has no reading yet, today falls back to the latest reading (the current
  behaviour, up to 7 days back). No new provider reads are needed for these three.
- If fewer than 7 days of a signal exist, fall back to today's constants (HRV 48,
  RHR 58, resp 15) and the Recovery page says "Building your baseline" for that row
  instead of showing a comparison.
- The Home dashboard uses the same baselines, so today's Recovery number on Home and
  on the page always match. The stress timeline's HRV baseline (48) switches to the
  HRV baseline too.
- Today's Home recovery will shift once real baselines are in. That is expected.

### Daily history

- A new daily record per local date:
  `{ date, strain, recovery, sleepScore, strainBreakdown, recoveryInputs }`, where
  `strainBreakdown` holds minutes per HR zone and active kcal, and `recoveryInputs`
  holds HRV / RHR / resp / sleep values plus the baselines used.
- Stored with kv-store under a new `scores.db`, keyed by date. Only finished days
  (before today) are stored; today is always computed live.
- **Late syncs (my call):** watches often sync late, so a stored day is not frozen
  at once. Every history load (and every manual sync) recomputes the last 2 finished
  days and any stored day under 7 days old that has a null score. Each record keeps a
  `computedAt` stamp.
- On first open of either page, any missing days in the last 14 are backfilled from
  Health, oldest to newest, then saved. Later opens backfill only the gap since the
  last saved day.
- Providers need date-ranged variants of existing reads: strain inputs for a given
  day (HR bucketed 5-min for that day, active energy sum for that day, resting HR as
  of that day) and the sleep night ending on that day's morning. The cleanest shape
  is optional `day?: Date` arguments (or a `getDay(date)` helper) on the existing
  methods, defaulting to today, so the dashboard code doesn't change.
- A day with no data stores nulls and shows as an empty bar, not zero.
- The mock provider returns plausible varied values for past days so web screenshots
  show a full chart.
- History is served through a React Query hook whose key is in
  `HEALTH_QUERY_KEYS`, so a manual sync refreshes it.

### Strain page (`/strain`)

Built on `DetailLayout`, same pattern as `/sleep`:

- Header: score `/ 21`, status word (LOW / MODERATE / HIGH, same thresholds as Home),
  caption with today's coach target range.
- **Target is the morning target, fixed for the day (Ruben's choice).** It is the
  coach's range from today's recovery and sleep with strain treated as 0, so it no
  longer jumps once strain passes 12. Home's TARGET STRAIN pill switches to the same
  fixed range; the coach's mode and message are otherwise unchanged.
- **Today**: cumulative strain through the day (from the 5-min HR buckets) with the
  target range shaded. `CumulativeChart` is the starting point.
- **Where it came from**: minutes in each HR zone today, each zone's weight, and
  active calories.
- **Last 14 days**: one bar per day (`BarChart`), with a line or label for the
  14-day average.
- **How the score works**: short explanation of zone weighting and the 21 cap.
- No data today: an empty state like the Sleep page's.

### Recovery page (`/recovery`)

- Header: score `%` and status word (same thresholds as Home).
- **What moved it**: one row per input, with today's value, 30-day average,
  difference (direction-aware: lower resting HR and breathing rate are better), and
  its weight (HRV 35%, resting HR 30%, sleep 25%, breathing 10%). Sleep shows the
  sleep score and links to `/sleep`.
- **Last 14 days**: one bar per day, coloured by LOW / MODERATE / HIGH.
- **How the score works**.
- Missing inputs: show the score as no data and list which input is missing.

### Readiness page

- The "Behind recovery" card (HRV / resting HR / breathing rate and the weights)
  becomes a short tappable card linking to `/recovery`, so the numbers live in one
  place. "What it's based on" (the inputs and the coaching rule each one affects)
  stays as it is.

## Left to the builder

- Exact chart styling, spacing and copy, following DESIGN.md and the Sleep page.
- Whether date-ranged reads are new methods or optional arguments.
- How the backfill is batched (sequential vs a few days in parallel), as long as the
  page shows a loading state and today's numbers first.
- Tests: score history storage and backfill logic, baseline calculation (including
  the under-7-days fallback), and the per-day bucketing for both providers.
- PR screenshots of both pages in light and dark (mock data, web build).
