# Allo Health

An Expo Router / React Native health dashboard. Health reads stay on-device; the app makes no network requests with health data and includes no analytics.

## Requirements

- Node.js 22.13 or newer
- Xcode 26.4+ for iOS builds, Android Studio with SDK 36 for Android builds
- A physical device or simulator; native health APIs require a development build, not Expo Go

## Setup

```sh
npm install
cp .env.example .env.local
npx expo install --check
npm run typecheck
npm test
```

`EXPO_PUBLIC_HEALTH_PROVIDER` defaults to `mock`. The app opens with realistic local sample data and does not ask for permissions until the connect control is used.

To connect a device health source, set `EXPO_PUBLIC_HEALTH_PROVIDER=native` in `.env.local`, then make a development build:

```sh
npx expo run:ios
npx expo run:android
npx expo start --dev-client
```

The iOS build includes HealthKit usage strings and capability configuration. Android includes Health Connect read permissions and a minimum SDK of 26. After changing native config or native dependencies, rebuild the development client.

Apple Health does not disclose whether an individual read permission was denied. The app treats a completed HealthKit permission request as a connection attempt and reports an empty signal as unavailable; Health Connect reports exact granted permission counts. If permission requests fail or all native reads fail, the dashboard clearly falls back to mock data.

## Adding a screen

Add a route under `app/(tabs)/` and register it in `app/(tabs)/_layout.tsx`. Build the screen from `components/ui`, `theme/tokens.ts`, and the platform-independent services. Screens should consume `HealthProvider` through `hooks/useHealthDashboard` rather than import platform libraries directly.

## Data and estimates

`services/health/` owns the platform adapters and shared provider contract. `services/metrics/` contains pure estimates for sleep, recovery, strain, stress, and energy. `services/coaching/` contains deterministic daily guidance behind a replaceable engine interface. These scores are informational estimates, not medical output.

Nutrition and glucose appear only when the connected source shares those samples. Glucose and energy units follow the device locale's regional convention; the time display follows the device's 12/24-hour preference.

## Design source

Tokens follow `design/DESIGN.md`. Its YAML frontmatter uses `#101319` / `#191c22` surface roles, while the prose describes a darker `#0D0F12` / `#14171D` / `#1C2029` hierarchy. The app retains both sets as named tokens and uses the frontmatter roles for the canvas/text and prose surface colors for cards, with the prose-defined biometric hues.
