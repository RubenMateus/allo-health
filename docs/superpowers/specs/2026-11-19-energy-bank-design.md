# Energy Bank

## Why

Ruben wants to see his energy as a running balance through the day instead of one
daily number. The page should answer two things: "how much do I have left right
now?" (top of the page) and "what drained me today?" (the chart and totals).
Reference: two screenshots of another app's Energy Bank (Home card and page),
shared in the project thread on 2026-11-19.

## Today

`calculateEnergyBattery` (`services/metrics/index.ts`) gives one number per day:
45 + sleep score x 0.35 + calm minutes x 0.025 - strain x 1.15 - average stress x 0.15.
It shows on Home's "Stress & energy" card as "ENERGY BATTERY" with a meter. No page,
no intraday curve, no history.

## Goals

- A running energy balance (0 to 100) through the calendar day, in 5-minute steps.
- An Energy Bank page: current level as a battery, "Last charged to X% at HH:MM",
  Total charged and Total drained, a coaching line, and the day's curve (00:00 to 24:00).
- Home's energy row shows the running value and opens the page.
- "Lower/higher than usual at this time" from the person's own recent days.

## Non-goals

- Notifications ("your energy is low").
- Tuning the model against any external standard; it is a rule-based estimate,
  labelled as such like stress.
- Editing or logging energy by hand.

## Anti-goals

- Sample (mock) data must never be stored or used as "usual".
- No network calls; everything stays on-device.

## Approaches considered

1. **Running balance (picked by Ruben).** Start each day from a low opening
   balance, then move it every 5 minutes: sleep and calm stretches charge, stress
   and effort drain. Totals fall out directly; each finished day's curve is stored
   on-device so "usual" has real days to compare against. Home's number changes
   meaning (it no longer matches today's formula).
2. **Today's formula re-run hour by hour.** Least new code, Home stays the same,
   but the formula isn't a balance, so charged/drained totals would be invented and
   the curve can jump.
3. **Only snapshot when the app is open.** Gaps whenever the app is closed.

## Design

### Model (`services/metrics/energy.ts`, pure, unit tested)

Input for a day: a full calendar-day 5-minute stress timeline
(`calculateStressTimeline` over a new full-day read, see Data reads), and the
stages of the night that ended that morning (`SleepData.stages`, as `sleepAsOf`
already picks it).

Each 5-minute step, in order of precedence:
- **Asleep** (inside a sleep stage that is not `awake`): charge. Deep and REM charge
  more than light/asleep. A full good night (about 7.5 h) should move a balance from
  roughly 20 to roughly 90.
- **Awake, stress <= 25 (calm)**: small charge.
- **Awake, stress 26 to 50**: small drain.
- **Awake, stress > 50**: larger drain, scaling with stress.
- **No reading for that step**: no change (flat line on the chart).

Clamp to 0 to 100 after every step. Total charged = sum of positive steps, total
drained = sum of negative steps (shown as positive). "Last charged" = the end of the
most recent run of charging steps, with the balance there.

Exact rates are the builder's call, tuned so that on the mock day and a typical
real day the curve reads sensibly (rests at night, falls through the day, steeper
during workouts). Rates live as named constants with a comment, like strain/stress.

Opening balance (my call, after the builder check): every day opens at a fixed
low level, 20, at 00:00, and is computed on its own. No chaining from the previous
day's close. This matches the reference screenshots (the bank reads 1% at 01:12)
and means a day never depends on which other days were computed, synced late, or
had no readings. Sleep from that night that fell before midnight is credited at
00:00, so the curve starts at 20 + that charge.

### Data reads (my call)

`buildStressSamples` (`services/health/nativeSamples.ts`) keeps only the last 48
buckets (about 4 hours), which the Home stress chart relies on. Energy gets its own
provider method, `getDayStressSamples(day)`, returning every 5-minute bucket of the
calendar day (today: up to now) on Apple Health, Health Connect and mock. Home's
stress chart keeps its current 4-hour view. `computeDay` in
`services/scores/history.ts` gains this read and the stress baseline it needs.

### Storage

Extend `DailyScore` (`services/metrics/daily.ts`) with
`energy: { hourly: (number | null)[25]; charged: number; drained: number; close: number } | null`
(hourly = balance at each hour 00:00 to 24:00). Computed in `scoreDay`, so finished
days are saved with the existing score history (`services/scores/history.ts`,
730 days kept, mock never persisted). Today is computed live and never stored, as now.
Older stored days without `energy` get it filled in when they are next recomputed;
no migration that re-reads everything at once. A day with no stress readings
stores `energy: null` and is left out of "usual".

### Usual

"Usual at this hour" = median of the stored `hourly` value at the same hour over the
last 14 finished days that have energy. Needs at least 5 such days; otherwise the
coaching line says it is still learning the person's usual pattern.

Coaching line (today only): "Your Energy Bank is N% lower/higher than usual for
HH:MM", or "about the same as usual" within ±5. On past days the line compares the
closing balance with the usual close.

### Page `/energy`

Built on the existing detail layout, like `/sleep` and `/strain`, follows the selected
day from browse by day (`dayStore`), with the header date control those pages use.
Top to bottom:
1. Battery with current % (past days: closing %), and "Last charged to X% at HH:MM".
2. Two tiles: Total charged, Total drained.
3. Coaching card.
4. The day's curve, 00:00 to 24:00, y axis 0 to 100, with sleep shown as a shaded
   band; on today the line stops at now.
Empty state when there are no stress readings: explains that heart rate and HRV
readings build the bank.

### Home

The "ENERGY BATTERY" row on the Stress & energy card becomes "ENERGY BANK", shows
the running balance (live value for today, close for past days), keeps the meter,
gains a chevron and opens `/energy`. `dashboard.ts` computes it with the new model;
`calculateEnergyBattery` is removed once nothing uses it. Status words
(`energyStatus`) stay.

## Left to the builder

Rates and their constants, chart component reuse (existing `BarChart`/line chart
pieces), copy for empty states, test layout, light/dark screenshots for the PR.
