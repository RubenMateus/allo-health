<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo/logo-lockup-dark.svg">
    <img src="assets/logo/logo-lockup-light.svg" alt="Allo Health" width="360">
  </picture>
</p>

# Allo Health

Allo Health is a personal health dashboard for iPhone and Android. It reads the data your phone and wearables already collect, such as heart rate, HRV, sleep, activity and nutrition, and turns it into one calm daily view of how recovered you are and how hard to push today.

Everything is computed on your device. Your health data never leaves your phone.

## Screenshots

Shown with the built-in sample data in the dark theme. Allo Health also has a light theme, or follows your phone's setting.

| Home | Pick a day | Sleep | Strain |
| --- | --- | --- | --- |
| <img src="docs/images/dark-today.png" width="180" alt="Home, dark theme"> | <img src="docs/images/dark-calendar.png" width="180" alt="Month calendar, dark theme"> | <img src="docs/images/dark-sleep.png" width="180" alt="Sleep page, dark theme"> | <img src="docs/images/dark-strain.png" width="180" alt="Strain page, dark theme"> |

| Recovery | Readiness | Week summary | Journal |
| --- | --- | --- | --- |
| <img src="docs/images/dark-recovery.png" width="180" alt="Recovery page, dark theme"> | <img src="docs/images/dark-readiness.png" width="180" alt="Readiness page, dark theme"> | <img src="docs/images/dark-week-summary.png" width="180" alt="Week summary, dark theme"> | <img src="docs/images/dark-journal.png" width="180" alt="Journal, dark theme"> |

| Fitness | Workouts | Workout detail | Biomarkers |
| --- | --- | --- | --- |
| <img src="docs/images/dark-fitness.png" width="180" alt="Fitness, dark theme"> | <img src="docs/images/dark-workouts.png" width="180" alt="Workouts list, dark theme"> | <img src="docs/images/dark-workout-detail.png" width="180" alt="Workout detail, dark theme"> | <img src="docs/images/dark-biomarkers.png" width="180" alt="Biomarkers, dark theme"> |

| Welcome | Settings |
| --- | --- |
| <img src="docs/images/dark-onboarding.png" width="180" alt="First-launch intro, dark theme"> | <img src="docs/images/dark-settings.png" width="180" alt="Settings, dark theme"> |

<details>
<summary>Light theme</summary>

| Home | Sleep | Fitness | Workout detail |
| --- | --- | --- | --- |
| <img src="docs/images/light-today.png" width="180" alt="Home, light theme"> | <img src="docs/images/light-sleep.png" width="180" alt="Sleep page, light theme"> | <img src="docs/images/light-fitness.png" width="180" alt="Fitness, light theme"> | <img src="docs/images/light-workout-detail.png" width="180" alt="Workout detail, light theme"> |

</details>

## What you get

**Home**

- **Three rings.** Strain, recovery and sleep scores built from your heart rate, heart rate variability, resting heart rate, breathing rate, sleep and active energy. Tap any ring for its own page.
- **Training guidance.** A daily recommendation to push, maintain or recover, with a target strain range set each morning. The Readiness page explains what the target means and what it is based on.
- **Stress and energy.** An estimate of today's stress load and an energy "battery" that charges with sleep and drains with strain and stress.
- **Nutrition and glucose.** Calories, macros and glucose readings, shown when your health source shares them.
- **Browse by day.** A week strip with a recovery dot for each day sits at the top of Home. Tap a day, swipe to earlier weeks, or open the month calendar to look back at any past day. Home and the Sleep, Strain, Recovery and Journal pages follow the day you pick, and the app always opens on today.
- **Week and month summary.** Open it from the week strip or the month calendar: average recovery, strain and sleep against the period before, a day-by-day chart, highs and lows, load balance, workouts and journal, plus a few plain suggestions for next week.

**Sleep, Strain and Recovery pages**

- **Sleep.** Your sleep score, time in bed and asleep, efficiency, and a night timeline of awake, REM, light and deep sleep with minutes per stage.
- **Strain.** How today's strain built up against the target band, which heart-rate zones and how much active energy it came from, and the last 14 days.
- **Recovery.** Each input (HRV, resting heart rate, sleep, breathing) against your own 30-day average and how much it counts, and the last 14 days.
- **Load balance.** On both pages, a 14-day view of whether your strain matched your recovery: balanced, over-reaching, or room to push.

**Fitness**

- **Training load.** Cardio and muscular load gauges that compare your last 7 days with your usual week.
- **Activity summary.** Active time over the last 30 days compared with the 30 before, and an activity calendar shaded by how many sessions you did each day.
- **Cardio.** Active duration and energy this week against last week, VO₂ max, heart-rate recovery, cardio focus and time in heart-rate zones, each with its own detail page.
- **Workouts.** Every session from the last 30 days, filterable by runs, strength, cycling and other, with this week's training load. Each workout has a detail page with its heart-rate curve, time in zones, strain, splits, elevation and, for runs recorded on Apple Watch, running form.

**Biomarkers**

- **Fitness age.** The age your VO₂ max matches, compared with your real age.
- **Trends.** Weight, body fat, lean mass, HRV, resting heart rate, VO₂ max, blood oxygen and respiratory rate, each with a trend against your recent baseline and a detail page with history.

**Journal**

- **Daily check-in.** Mood, energy and habits like caffeine, alcohol or late meals, with a weekly overview. Entries are stored only on your phone.

**Getting started and settings**

- **First-launch intro.** A short swipe-through explains the privacy model, what the three rings mean and where everything is, then offers to connect your health source and asks for your age and sex if it can't read them.
- **Settings.** Tap the ••• button to choose a dark, light or system theme, edit your age and sex (used for VO₂ max ratings, body fat ratings and fitness age), re-sync your health data on demand, or replay the intro.
- **Quick add.** The + button in the tab bar opens a journal check-in, today's readiness and sync.

Units follow your region (for example mg/dL or mmol/L for glucose, kcal or kJ for energy, km or miles for distance), and times follow your phone's 12 or 24 hour setting.

## Your data stays on your phone

Privacy is the core design rule of Allo Health, not a setting.

- **Read only.** The app asks Apple Health or Health Connect for read access only. It never writes to your health records.
- **No network requests with health data.** Scores, estimates and guidance are calculated locally. Nothing is uploaded to a server.
- **No analytics or tracking.** There are no analytics SDKs, crash reporters or ad trackers in the app.
- **You stay in control.** You can revoke access at any time in the Health app on iPhone or in Health Connect on Android.

## Where the data comes from

| Platform | Health source |
| --- | --- |
| iPhone | Apple Health (HealthKit) |
| Android 8.0 and newer | Health Connect |

Any app or wearable that syncs into Apple Health or Health Connect, such as Apple Watch, Garmin, Oura, Withings or Samsung Health, can feed the dashboard.

Until you connect a health source, Allo Health shows realistic sample data so you can explore the app first, with a sample badge so it is never mistaken for your own. It only asks for permissions when you tap connect (in the intro or from the top bar), and if access is not granted it says so clearly and keeps showing sample data. Once connected, it reconnects on its own each time you open it, without asking again.

A note on Apple Health: iOS does not tell apps which individual data types you declined. If a card shows a signal as unavailable, check that Allo Health is allowed to read it under Settings › Health › Data Access & Devices.

## Not medical advice

Allo Health's scores and guidance are informational estimates to help you notice trends. They are not a diagnosis or a substitute for advice from a doctor or other qualified professional.

## Running it yourself

Allo Health is not in the App Store or Google Play yet. To build and run it on your own device or a simulator, follow the [local development guide](docs/DEVELOPMENT.md). The project uses [Bun](https://bun.sh) as its package manager:

```sh
bun install
bun run ios       # or: bun run android
```

## License

Allo Health is open source under the [MIT License](LICENSE).
