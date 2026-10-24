# Allo Health

Allo Health is a personal health dashboard for iPhone and Android. It reads the data your phone and wearables already collect, such as heart rate, HRV, sleep, activity and nutrition, and turns it into one calm daily view of how recovered you are and how hard to push today.

Everything is computed on your device. Your health data never leaves your phone.

## What you get

**Today**
- **Daily readiness.** Recovery, sleep and strain scores built from your resting heart rate, heart rate variability, sleep and active energy.
- **Training guidance.** A daily recommendation to push, maintain or recover, with a target strain range for the day.
- **Stress and energy.** An estimate of today's stress load and an energy "battery" that charges with sleep and drains with strain and stress.
- **Nutrition and glucose.** Calories, macros and glucose readings, shown when your health source shares them.

**In progress**
- **Fitness.** Training load, cardio zones, heart-rate recovery, an activity calendar and your strength and cardio mix.
- **Journal.** A quick daily check-in for mood, energy and habits like caffeine, alcohol or late meals, with a weekly overview.
- **Biology.** Longer-term biomarkers and trends.

Units follow your region (for example mg/dL or mmol/L for glucose, kcal or kJ for energy), and times follow your phone's 12 or 24 hour setting.

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

Until you connect a health source, Allo Health shows realistic sample data so you can explore the app first. It only asks for permissions when you tap connect, and if access is not granted it says so clearly and keeps showing sample data.

A note on Apple Health: iOS does not tell apps which individual data types you declined. If a card shows a signal as unavailable, check that Allo Health is allowed to read it under Settings › Health › Data Access & Devices.

## Not medical advice

Allo Health's scores and guidance are informational estimates to help you notice trends. They are not a diagnosis or a substitute for advice from a doctor or other qualified professional.

## Running it yourself

Allo Health is not in the App Store or Google Play yet. To build and run it on your own device or a simulator, follow the [local development guide](docs/DEVELOPMENT.md).

## License

Allo Health is open source under the [MIT License](LICENSE).
