# Local development

This guide covers running Allo Health from source on an iOS or Android device or simulator. The app is built with Expo (SDK 58), Expo Router, React Native, TypeScript, NativeWind (Tailwind CSS), React Query and Zustand. It ships for iOS and Android only. Web runs as a development-only target for quick UI work (see [Web (development only)](#web-development-only)); it is never released.

## Requirements

- [Bun](https://bun.sh) 1.3 or newer (package manager and script runner)
- Node.js 22.13 or newer (Expo's CLI and Jest run on Node)
- **iOS:** a Mac with Xcode 26.4 or newer and CocoaPods
- **Android:** Android Studio with SDK 36 and a JDK 17 install
- A physical device or simulator/emulator

Expo Go is not enough. The app uses native health libraries (`@kingstinct/react-native-healthkit` and `react-native-health-connect`), so it runs in a **development build** that you compile once and then reuse.

## First run

```sh
git clone https://github.com/RubenMateus/allo-health.git
cd allo-health
bun install
cp .env.example .env.local
```

Then build and launch the development client for your platform:

```sh
bun run ios       # expo run:ios, builds and opens the iOS simulator
bun run android   # expo run:android, builds and installs on an emulator or USB device
```

To target a connected physical device, add `--device`, for example `bunx expo run:ios --device`. iOS device builds need a signing team selected in Xcode the first time.

After the first build you only need the Metro bundler for JavaScript changes:

```sh
bunx expo start --dev-client
```

`ios/` and `android/` are generated from `app.json` and config plugins (Continuous Native Generation) and are git-ignored. Do not edit them by hand. Change `app.json` or a plugin instead and rebuild.

## Sample data vs real health data

The data source is chosen with `EXPO_PUBLIC_HEALTH_PROVIDER` in `.env.local`:

| Value | Behaviour |
| --- | --- |
| `mock` (default) | The app uses realistic local sample data and never asks for health permissions. Best for UI work. |
| `native` | The app starts in an unconnected state. Tapping connect requests read access to Apple Health on iOS or Health Connect on Android, then switches to real data. On later launches the app re-attaches to an existing grant without a prompt. |

`EXPO_PUBLIC_` variables are inlined into the JavaScript bundle at build time, so restart Metro with a cleared cache after changing it:

```sh
bunx expo start --dev-client --clear
```

If permission is denied, the request fails, or every native read fails, the app falls back to sample data and shows a message saying so.

The first launch opens the intro (`app/onboarding.tsx`) before anything else, in both modes. Its Connect step is the same permission request as the connect button in the top bar. To see the intro again, use **Replay intro** in Settings.

### Apple Health (iOS)

- The HealthKit entitlement and usage strings (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`) come from the HealthKit config plugin in `app.json`. Access is read only.
- The iOS simulator supports HealthKit but starts with no data. Open the Health app in the simulator and add samples by hand (for example resting heart rate, HRV and sleep), or use a real iPhone that already has data.
- iOS never reports which individual read types the user declined. The app treats a completed permission request as connected and shows an empty signal as unavailable.
- Workouts are read from `HKWorkoutType` for the Fitness tab and the Workouts pages. A workout's detail page also reads walking/running, cycling and swimming distance, step count, and the Apple Watch running form metrics (stride length, vertical oscillation and ground contact time) for that workout's time span.
- Date of birth and biological sex are read as characteristics for VO₂ max and body fat ratings. If either is missing, the intro and Settings ask for it and store it on the device.
- To see the permission sheet again, delete the app or reset access under Settings › Health › Data Access & Devices › Allo Health.

### Health Connect (Android)

- `minSdkVersion` is 26 (Android 8.0). On Android 14 and newer Health Connect is part of the system. On older versions install the Health Connect app from Google Play.
- Use an emulator image **with Google Play** so Health Connect is available.
- Read permissions are declared in `app.json` under `android.permissions` and wired up by the `react-native-health-connect` plugin. Add new record types there and rebuild.
- The app requests 18 permissions, all of them read only: heart rate, resting heart rate, HRV, sleep, active calories, nutrition, blood glucose, respiratory rate, exercise, weight, body fat, lean body mass, VO₂ max, oxygen saturation, distance, elevation gained and steps, plus `READ_HEALTH_DATA_HISTORY`. Without the history permission Health Connect only returns the last 30 days, which is not enough for the Fitness tab's 60-day window or for browsing older days.
- Health Connect has no date of birth or sex, so the intro (and Settings › Age and sex) asks for them.
- Unlike iOS, Health Connect reports exactly which permissions were granted.
- Seed test data with any app that writes to Health Connect, or through the Health Connect toolbox app.
- Revoke or re-grant access from Settings › Health Connect › App permissions › Allo Health.

### How native reads avoid double counting

Several devices and apps usually write the same data (a Watch and an iPhone, or a watch app and Strava). The adapters handle that the same way on both platforms, with the shared helpers in `services/health/nativeSamples.ts`:

- **Daily totals** (active energy, nutrition) come from the platform's own sum from local midnight: HealthKit statistics queries and Health Connect `aggregateRecord`. Never add up raw samples.
- **Sleep** is last night only: the latest session that ended in the past 24 hours with at least three hours asleep (else the longest one). On iOS one source is read per night, preferring staged Watch data.
- **Heart rate** for strain and stress is averaged into five-minute buckets, because a watch writes a sample every few seconds during workouts. Stress pairs each bucket with the nearest HRV reading.
- **Resting heart rate and respiratory rate** are the newest reading from the last 7 days.
- **Workouts** that overlap by more than half are one workout recorded twice; the copy with heart rate is kept.
- HRV is SDNN on iOS and RMSSD on Android. They are different measures, so values differ between platforms for the same person.

`appleHealthProvider.test.ts` and `healthConnectProvider.test.ts` cover these cases with native payload fixtures.

## Web (development only)

The web build is a quick way to work on layout and styling without a simulator. It is not a product target and is never released, so always check a change on iOS or Android before you open a pull request.

```sh
bun run web   # expo start --web, serves the app at http://localhost:8081
```

What is different on web:

- **Sample data only.** HealthKit and Health Connect don't exist in a browser. `services/health/provider.web.ts` replaces the provider module there, so neither native library is bundled and the app stays on sample data even when `EXPO_PUBLIC_HEALTH_PROVIDER=native`.
- **Browser storage instead of SQLite.** Journal entries, settings, the profile and the score history are saved to the browser's `localStorage` (keys start with `allo-health/<store>/`) through the `storage.web.ts` files next to each `storage.ts`. expo-sqlite's web build can't open several databases at once, so it is not used on web. Clear the site data in the browser to reset, which also brings the intro back.
- **Sample scores are never saved.** Scores computed from sample data are not written to the score history on any platform, so the week strip dots and the 14-day charts come from the sample provider each time.
- **Single-page output.** `app.json` sets `web.output` to `single`. Static rendering would try to run expo-sqlite in Node and fails.

If you add a module that only works on iOS and Android, give it a `.web.ts` sibling that falls back to sample data or does nothing, the same way.

### Screenshots for docs and pull requests

The README screenshots come from the web build with sample data, at a 390×844 viewport and a device scale factor of 2:

```sh
bunx expo export -p web --output-dir dist   # static build of the app
```

Serve `dist/` with any static server that falls back to `index.html` for unknown paths, so routes like `/sleep` or `/summary?period=week` load directly. Then, in the browser or a Playwright script:

- Pick the theme and skip the intro by setting `localStorage["allo-health/settings/allo-settings"]` to `{"state":{"themePreference":"dark","onboardingCompletedAt":"2026-01-01T00:00:00.000Z"},"version":2}` before the page loads. Leave `onboardingCompletedAt` as `null` to shoot the intro.
- Freeze the clock in the late afternoon (for example 17:30). Sample data is generated relative to now, and early-morning shots show a mostly empty day.
- On web, sheets (the month calendar, quick add, connect) render outside the element that carries the theme's CSS variables. Copy that element's `style` attribute onto `<body>` before taking a screenshot of a sheet.

Screenshots of features live in `docs/images/`, named `<theme>-<screen>.png`.

## What is stored on the device

Everything the app saves stays on the phone, in SQLite key-value stores (expo-sqlite) on iOS and Android:

| Database | What it holds |
| --- | --- |
| `settings.db` | Theme, last sync time, and when the intro was finished |
| `journal.db` | Journal check-ins |
| `profile.db` | Birth year and sex entered in the app |
| `scores.db` | Daily strain, recovery and sleep scores and the Energy Bank's hourly curve for up to 730 days, so the week strip, month calendar, 14-day charts and summaries load without re-reading Health |

The score history is a cache (`services/scores/history.ts`). The first time, the app computes the last 14 days from Health. After that it keeps finished days and only recomputes the last 2 (watches sync late) plus any empty day from the past week, at most every 6 hours. Days you browse further back are read live from Health and then cached. Deleting the app clears all four databases.

## When to rebuild the development client

Rebuild with `bun run ios` / `bun run android` whenever you:

- add or upgrade a package that contains native code (for example `expo-sqlite`),
- change native config in `app.json` (permissions, plugins, bundle identifier, icons),
- pull changes from someone else that did either of the above.

When a change adds new health read types, existing installs keep their old grant. Tap connect again (or reinstall) to grant the new types.

JavaScript-only changes reload instantly through Metro. If the app crashes on launch with a missing native module error, a rebuild is almost always the fix.

Add dependencies with `bunx expo install <package>` rather than `bun add`, so you get the version that matches the Expo SDK. `bunx expo-doctor` diagnoses dependency and config problems, and `bunx expo install --fix` repairs mismatched versions.

## Checks

Run these before opening a pull request:

```sh
bun run typecheck   # tsc --noEmit
bun run lint        # expo lint
bun run test        # jest, run in band
```

Tests cover the pure logic in `services/` (metrics, coaching, scores, summaries and data loading), the stores and hooks, the native adapters against payload fixtures, key screens and navigation (`RootStack.test.tsx` checks the intro gate with `expo-router/testing-library`), and the styling setup: `theme/nativewind.test.tsx` compiles the Tailwind config the way the iOS and Android builds do and checks every color, type, spacing and radius class against `theme/tokens.ts`. They run in Node and do not need a simulator. Use `bun run test`, not `bun test`: `bun test` starts Bun's own test runner, which does not work with the jest-expo preset.

## Releases

Releases are versioned, tagged and written up automatically by [release-please](https://github.com/googleapis/release-please). Nothing is sent to the app stores.

- Every push to `main` updates one open pull request called "chore(main): release X.Y.Z". It holds the next version in `package.json` and `app.json` and the new `CHANGELOG.md` entries.
- The version comes from pull request titles: `feat:` bumps the minor version and `fix:` bumps the patch version. Only features, fixes and performance changes go in the changelog; `build`, `chore`, `ci`, `docs`, `refactor`, `style` and `test` are left out. Keep titles in this format, since squash merges use them as the commit message.
- Merge the release PR when you want a release. That tags the commit `vX.Y.Z` and creates a GitHub release. Ignore it until then.
- The release PR shows no CI checks, because GitHub doesn't run workflows on PRs opened by Actions. It only changes versions and the changelog.
- Settings shows the version and the commit the build came from, for example `Allo Health 1.2.0 (abc1234)`. Builds without git show `dev`.

To go back to a known good release, check out its tag and rebuild:

```sh
git checkout v1.0.0
bunx expo prebuild --clean
bunx expo run:ios   # or run:android
```

One-time setup: enable **Allow GitHub Actions to create and approve pull requests** in the repository settings (Settings → Actions → General → Workflow permissions), or the release PR can't be opened.

## Project layout

```
app/                 Expo Router routes; every file is a screen
  (tabs)/            Bottom tabs: Home, Journal, Fitness, Biomarkers
  biomarkers/, fitness/  Metric detail pages
  workouts/          Workouts list and workout detail
  sleep, strain, recovery, readiness  Pages behind the Home rings and the coach card
  summary            Week or month summary (?period=week|month&start=YYYY-MM-DD)
  onboarding         First-launch intro
  settings           Settings
components/          UI: ui/ primitives, charts/, detail/, and one folder per screen
  navigation/        RootStack (every route, behind the intro gate), TabHeader, tab bar, quick add sheet
  day/               Week strip and month calendar sheet for browsing by day
hooks/               React Query hooks: dashboard, fitness, biomarkers, workout details, day scores, score history, period summary, sync
services/health/     HealthProvider contract, HealthKit / Health Connect / mock adapters, data loaders
services/metrics/    Pure estimates: sleep, recovery, strain, stress, energy (index.ts), daily scores (daily.ts), training load and zones (fitness.ts, training.ts), workouts, load balance, summaries
services/coaching/   Deterministic daily training guidance
services/scores/     Daily score history cache (scores.db)
services/onboarding/ Intro steps and which ones to show
services/journal, profile, settings, storage/  Persistence: SQLite on device, localStorage on web
stores/              Zustand stores (health provider and connection, selected day, journal, profile, settings)
theme/tokens.ts      Design tokens: dark and light palettes, spacing, radii, typography
theme/ThemeProvider  Applies the saved theme; useTheme() for colors outside className
theme/variables.ts   The CSS variables behind the color classes, per theme
theme/interop.ts     Registers third-party views (SafeAreaView, BlurView, ...) for className
tailwind.config.ts   Tailwind theme generated from theme/tokens.ts
global.css           Tailwind entry file, imported once in app/_layout.tsx
utils/               Formatting helpers (units, dates, locale) and cn() for class names
design/              DESIGN.md design system and reference screenshots
```

### Adding a screen

1. Add a route under `app/`. A new tab goes under `app/(tabs)/` and is registered in `app/(tabs)/_layout.tsx`; any other page is registered in `components/navigation/RootStack.tsx`, inside the `Stack.Protected` group that needs the intro finished.
2. Build it from `components/ui` and the platform-independent services. Style it with `className` and the token classes so it follows the light and dark themes (see below).
3. Read health data through the `HealthProvider` (via a hook like `hooks/useHealthDashboard`), never by importing a platform health library directly from a screen.
4. If the page shows one day's data, read the selected day from `stores/dayStore.ts` so it follows the week strip, and hide coaching advice on days that are not today.

### Design tokens

Tokens follow `design/DESIGN.md`. Its YAML frontmatter uses `#101319` / `#191c22` surface roles, while the prose describes a darker `#0D0F12` / `#14171D` / `#1C2029` hierarchy. `theme/tokens.ts` keeps both as named tokens: the frontmatter roles for canvas and text, the prose surfaces for cards, and the prose biometric hues.

### Styling with NativeWind

Components are styled with [NativeWind](https://www.nativewind.dev/) v4, which brings Tailwind CSS (v3) classes to React Native through a `className` prop. The Tailwind theme in `tailwind.config.ts` is generated from `theme/tokens.ts`, so the tokens stay the single source of truth.

| Tokens | Classes | Example |
| --- | --- | --- |
| Colors (`colors.surfaceProse`) | `bg-`, `text-`, `border-` + the token in kebab case | `bg-surface-prose`, `text-text-muted`, `border-outline-soft` |
| Typography (`typography.heading`) | `type-` + the style name, sets family, size, line height and weight | `type-heading`, `type-body-small`, `type-metric-lg` |
| Spacing (`spacing.lg`) | Any spacing utility with the token name | `p-lg`, `gap-2xs`, `px-margin`, `pb-nav-clearance` |
| Radii (`radii.card`) | `rounded-` + the token name | `rounded-card`, `rounded-full`, `rounded` (`DEFAULT`) |
| Hairlines | `hairline` | `h-hairline`, `border-b-hairline` |

Tailwind's numeric scale is in pixels (`w-11` is 44, `gap-0.5` is 2). Use an arbitrary value for anything off the scale, such as `h-[70px]` or `text-[11px]`. Size utilities override a `type-` class, so `type-badge text-[11px]` is the badge style at 11px.

```tsx
import { cn } from "@/utils/cn";

function Tag({ active, label }: { active: boolean; label: string }) {
  return (
    <View
      className={cn(
        "rounded-full border border-outline-soft px-md py-xs",
        active && "border-primary-border bg-primary-wash",
      )}
    >
      <Text
        className={cn("type-badge text-text-muted", active && "text-primary")}
      >
        {label}
      </Text>
    </View>
  );
}
```

- Combine classes with `cn()` from `utils/cn.ts`. It knows the app's token names, so a later class wins over an earlier one that sets the same thing (`cn("p-lg", compact && "p-sm")`).
- Use `active:` for pressed states on `Pressable`, for example `active:opacity-70`.
- Shared primitives (`Card`, `Hairline`, `MetricLabel`, `StatValue`) accept `className` for extra classes.
- Keep `style` for values computed at runtime, such as a width from a chart, a color picked from data, or an animated style.
- Third-party views need registering once in `theme/interop.ts` before `className` works on them. `SafeAreaView`, `LinearGradient`, `BlurView` and Reanimated's `Animated.View` are registered.
- `tabular-nums` works on iOS and Android through a custom utility in `tailwind.config.ts`, since React Native has no `font-variant-numeric`.

### Light and dark themes

Settings offers Dark (the default), Light and System. The choice is saved on the device in `settings.db` and applied before the first frame. `theme/tokens.ts` holds `darkColors` and `lightColors` with the same keys. Light mode keeps the same accent families, a step deeper so they still read on pale surfaces.

Every color class points at a CSS variable (`bg-canvas` uses `--color-canvas`). `ThemeProvider` sets the variables for the active theme at the root of the app, so classes switch theme without any `dark:` variants. It also sets NativeWind's color scheme, so `dark:` variants work if you need one.

Never write a hex value or import a palette in a component. For props that don't take a class, such as icon colors, SVG fills and strokes, gradient stops, `BlurView` tint or the glow shadows, read the active theme instead:

```tsx
const { colors, gradients, glow, scheme } = useTheme();
<HeartPulse color={colors.primary} size={18} />;
```

Helpers outside components that pick a color take `colors: ColorTokens` as a parameter.

After changing `tailwind.config.ts` or a token, restart Metro with `--clear` so the styles are rebuilt.

## Privacy rules for contributors

These are hard requirements for every change:

- Health data never leaves the device. No network request may carry health data, directly or derived.
- No analytics, telemetry, crash reporting or tracking SDKs.
- Health access stays read only.
- Any local persistence (for example journal entries or settings) stays on the device.
- "Sync" in Settings only re-reads Apple Health or Health Connect on the device. It never uploads anything.

If a feature would need a network call (weather, for example), leave it out or raise it for discussion first.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "No development build installed" or Expo Go opens | Build the client first with `bun run ios` / `bun run android`. |
| Native module not found on launch | Native dependencies changed. Rebuild the development client. |
| App still shows sample data with `native` set | Restart Metro with `--clear`, then tap connect and grant access. |
| A new data type shows as unavailable after updating | Existing installs keep their old grant. Tap connect again, or reinstall. |
| Need to see the intro again | Settings › Replay intro, or clear the app's data (site data on web). |
| Every card is unavailable on the iOS simulator | Add sample data in the simulator's Health app. |
| Health Connect missing on Android emulator | Use a Google Play system image, or install Health Connect on Android 13 and older. |
| Web build shows a red Metro error about a native module | Something imported a native-only package on web. Add a `.web.ts` fallback next to the importing file. |
| Dependency version warnings | `bunx expo install --fix`, then rebuild. |
