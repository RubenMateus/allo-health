# Sleep screen (first version)

## Why

A screen that answers "how did I sleep last night?" at a glance. Ruben asked for a
0 to 100 sleep score, total time in bed, and a graph of REM, light and deep sleep.
The first version is meant to be seen on a real screen and adjusted from there.

## Goals

- Sleep score (the existing `calculateSleepScore`) with its status word.
- Time in bed, time asleep, efficiency and awake time.
- The night as a stage timeline (awake / REM / light / deep), with minutes and
  share per stage underneath.

## Non-goals (for now)

Sleep debt, bedtime consistency, overnight vitals (skin temperature, SpO2) and the
insight card from `design/screens/sleep.png`. Each needs new health reads or weeks
of stored history.

## Approaches considered

- **Night timeline (picked, with per-stage minutes underneath).** Shows when each
  stage happened and when you woke. The native readers already see the stage
  intervals, so keeping them is a small data change.
- **Split bar with totals only.** Simpler and needs only totals, but can't show
  when anything happened.

## Design

- `SleepData` gains `lightMinutes`, `awakeMinutes`, `inBedMinutes`, `bedtime`,
  `wakeTime` and `stages` (a gap-free timeline). `buildSleepTimeline` in
  `services/health/nativeSamples.ts` builds it: overlaps go to the earlier
  interval, uncovered time is awake.
- HealthKit: in-bed samples set the window only; unspecified sleep is `asleep`.
  Health Connect: codes 1/3/7 awake, 2 asleep, 4 light, 5 deep, 6 REM; a session
  without stages is one `asleep` stretch. Unstaged nights show Awake/Asleep rows
  and a note.
- The page is `/sleep`, built on `DetailLayout`, opened by tapping the Sleep ring
  on Home. Where Sleep lives in the tab bar is still Ruben's call.
- Stage colors are new tokens (`stageAwake`, `stageRem`, `stageLight`,
  `stageDeep`) in both palettes.
- Everything stays on-device; nothing new is requested from HealthKit or Health
  Connect.
