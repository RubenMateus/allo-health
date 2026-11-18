# Week and month summary

Date: 2026-11-18. Status: short design for Ruben's approval.

## Intent

Ruben wants a weekly or monthly summary he can use for two things: reflect on the week (or month) that was, and think about the next one. It builds on browse by day (PR #45): browse by day zooms into one day, the summary zooms out, and both are reached from the same week strip and month calendar on Home.

## Goals

- A summary page for any week (Monday to Sunday) or calendar month, opened from:
  - a "Week summary ›" link under the Home week strip, for the week the strip is showing;
  - a "Month summary ›" link in the month calendar sheet, for the month on screen.
- Part 1, the period that was: how it went, compared with the period before.
- Part 2, what's next: two or three plain suggestions drawn from that period.

## Non-goals

- Goals you set and track (Ruben accepted plain suggestions over goal setting).
- Notifications ("your week is ready"). Alerts are shelved.
- A new tab. Fitness and Biomarkers stay as they are.

## Anti-goals

- No network calls, analytics or new copies of health data. Everything is worked out on open from what the app already has.
- Suggestions must not read as medical advice or nag. Plain, short, at most three.

## Approaches

1. **A summary page worked out on open (picked by Ruben).** Reads the score cache (730 days), journal entries and workouts for the period. Suggestions come from simple rules, like the readiness coach. Nothing new stored.
2. **An expandable card under the strip.** Quicker to glance at, but no room for a month or for suggestions. Not picked.

## Design

**Route:** `app/summary.tsx` with params `period=week|month` and `start=YYYY-MM-DD` (Monday, or the 1st). Header shows "16 – 22 Nov" or "November 2026", with ‹ › to step to the previous/next period (› stops at the current one). The current period is shown as "so far". (Claude's calls.)

**Part 1, the period that was** (Claude's proposal for content):
- Averages for recovery, strain and sleep score, each with the change against the previous period, and how many days were scored.
- Day-by-day strain vs recovery, reusing `LoadBalanceCard` with that period's days, plus its verdict line.
- Best and toughest day (highest and lowest recovery). Tapping one selects that day and goes back to Home, the same as tapping it on the strip.
- Workouts: count, total time and active kcal, by type, from `getWorkouts`.
- Journal: days logged, average mood and energy, most used tags. Hidden when nothing was logged.

**Part 2, next week / next month:**
- Rules, each giving one sentence when it fires, top three by priority:
  - Load balance verdict is over-reaching: "Several hard days came on low recovery. Plan an easier day after a hard one."
  - Load balance has room to push: "Recovery stayed high on easy days. You have room for a harder session."
  - Average sleep score under 70, or 2+ nights under 55: a sleep suggestion.
  - A journal tag (logged on 2+ days) is followed by recovery at least 10 points under the period's average the next day: "Recovery was N lower the day after alcohol."
  - Recovery trending down against the previous period by 5+ points.
- Shown only for the current or the previous period. Older periods show part 1 only, the same way coach advice is hidden on past days. (Claude's call.)
- Thresholds live next to `coachingThresholds` / `loadBalanceRules`, with a short "how this works" line.

**Data:** `useDayScores(start, end)` for scores (fills missing days in the background, so a page may fill in as it loads), journal store for entries, provider `getWorkouts(since)` filtered to the period. Pure functions in `services/metrics/summary.ts` (averages, deltas, best/toughest, tag effect, suggestions) so they are unit tested without UI.

**Empty states:** a period with fewer than 3 scored days shows "Not enough data yet" instead of averages and suggestions.

## Left to the builder

Layout and spacing following the theme tokens and existing cards; whether month view bars are thinner or grouped by week; exact suggestion wording.

## Testing

Unit tests for `services/metrics/summary.ts`; render tests for the summary page and the two new links; light and dark screenshots of a week and a month summary for the PR.
