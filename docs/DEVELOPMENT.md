# Local development

This guide covers running Allo Health from source on an iOS or Android device or simulator. The app is built with Expo (SDK 57), Expo Router, React Native, TypeScript, React Query and Zustand. It targets iOS and Android only; the web target is not supported.

## Requirements

- Node.js 22.13 or newer, with npm
- **iOS:** a Mac with Xcode 26.4 or newer and CocoaPods
- **Android:** Android Studio with SDK 36 and a JDK 17 install
- A physical device or simulator/emulator

Expo Go is not enough. The app uses native health libraries (`@kingstinct/react-native-healthkit` and `react-native-health-connect`), so it runs in a **development build** that you compile once and then reuse.

## First run

```sh
git clone https://github.com/RubenMateus/allo-health.git
cd allo-health
npm install
cp .env.example .env.local
```

Then build and launch the development client for your platform:

```sh
npm run ios       # expo run:ios, builds and opens the iOS simulator
npm run android   # expo run:android, builds and installs on an emulator or USB device
```

To target a connected physical device, add `--device`, for example `npx expo run:ios --device`. iOS device builds need a signing team selected in Xcode the first time.

After the first build you only need the Metro bundler for JavaScript changes:

```sh
npx expo start --dev-client
```

`ios/` and `android/` are generated from `app.json` and config plugins (Continuous Native Generation) and are git-ignored. Do not edit them by hand. Change `app.json` or a plugin instead and rebuild.

## Sample data vs real health data

The data source is chosen with `EXPO_PUBLIC_HEALTH_PROVIDER` in `.env.local`:

| Value | Behaviour |
| --- | --- |
| `mock` (default) | The app uses realistic local sample data and never asks for health permissions. Best for UI work. |
| `native` | The app starts in an unconnected state. Tapping connect requests read access to Apple Health on iOS or Health Connect on Android, then switches to real data. |

`EXPO_PUBLIC_` variables are inlined into the JavaScript bundle at build time, so restart Metro with a cleared cache after changing it:

```sh
npx expo start --dev-client --clear
```

If permission is denied, the request fails, or every native read fails, the app falls back to sample data and shows a message saying so.

### Apple Health (iOS)

- The HealthKit entitlement and usage strings (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`) come from the HealthKit config plugin in `app.json`. Access is read only.
- The iOS simulator supports HealthKit but starts with no data. Open the Health app in the simulator and add samples by hand (for example resting heart rate, HRV and sleep), or use a real iPhone that already has data.
- iOS never reports which individual read types the user declined. The app treats a completed permission request as connected and shows an empty signal as unavailable.
- To see the permission sheet again, delete the app or reset access under Settings › Health › Data Access & Devices › Allo Health.

### Health Connect (Android)

- `minSdkVersion` is 26 (Android 8.0). On Android 14 and newer Health Connect is part of the system. On older versions install the Health Connect app from Google Play.
- Use an emulator image **with Google Play** so Health Connect is available.
- Read permissions are declared in `app.json` under `android.permissions` and wired up by the `react-native-health-connect` plugin. Add new record types there and rebuild.
- Unlike iOS, Health Connect reports exactly which permissions were granted.
- Seed test data with any app that writes to Health Connect, or through the Health Connect toolbox app.
- Revoke or re-grant access from Settings › Health Connect › App permissions › Allo Health.

## When to rebuild the development client

Rebuild with `npm run ios` / `npm run android` whenever you:

- add or upgrade a package that contains native code (for example `expo-sqlite`),
- change native config in `app.json` (permissions, plugins, bundle identifier, icons),
- pull changes from someone else that did either of the above.

JavaScript-only changes reload instantly through Metro. If the app crashes on launch with a missing native module error, a rebuild is almost always the fix.

Add dependencies with `npx expo install <package>` rather than `npm install`, so you get the version that matches the Expo SDK. `npx expo-doctor` diagnoses dependency and config problems, and `npx expo install --fix` repairs mismatched versions.

## Checks

Run these before opening a pull request:

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest, run in band
```

Tests cover the pure logic in `services/` (metrics, coaching and data loading). They run in Node and do not need a simulator.

## Project layout

```
app/                 Expo Router routes; every file is a screen
  (tabs)/            Bottom tabs: Home, Journal, Fitness, Biology
components/          UI: ui/ primitives, charts/, home/, navigation/, permissions/
hooks/               React Query hooks such as useHealthDashboard
services/health/     HealthProvider contract plus HealthKit, Health Connect and mock adapters
services/metrics/    Pure score estimates: sleep, recovery, strain, stress, energy
services/coaching/   Deterministic daily training guidance
stores/              Zustand stores (active health provider and connection state)
theme/tokens.ts      Design tokens
utils/               Formatting helpers (units, dates, locale)
design/              DESIGN.md design system and reference screenshots
```

### Adding a screen

1. Add a route under `app/(tabs)/` and register it in `app/(tabs)/_layout.tsx`.
2. Build it from `components/ui`, `theme/tokens.ts` and the platform-independent services.
3. Read health data through the `HealthProvider` (via a hook like `hooks/useHealthDashboard`), never by importing a platform health library directly from a screen.

### Design tokens

Tokens follow `design/DESIGN.md`. Its YAML frontmatter uses `#101319` / `#191c22` surface roles, while the prose describes a darker `#0D0F12` / `#14171D` / `#1C2029` hierarchy. `theme/tokens.ts` keeps both as named tokens: the frontmatter roles for canvas and text, the prose surfaces for cards, and the prose biometric hues.

## Privacy rules for contributors

These are hard requirements for every change:

- Health data never leaves the device. No network request may carry health data, directly or derived.
- No analytics, telemetry, crash reporting or tracking SDKs.
- Health access stays read only.
- Any local persistence (for example journal entries) stays on the device.

If a feature would need a network call (weather, for example), leave it out or raise it for discussion first.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "No development build installed" or Expo Go opens | Build the client first with `npm run ios` / `npm run android`. |
| Native module not found on launch | Native dependencies changed. Rebuild the development client. |
| App still shows sample data with `native` set | Restart Metro with `--clear`, then tap connect and grant access. |
| Every card is unavailable on the iOS simulator | Add sample data in the simulator's Health app. |
| Health Connect missing on Android emulator | Use a Google Play system image, or install Health Connect on Android 13 and older. |
| Dependency version warnings | `npx expo install --fix`, then rebuild. |
