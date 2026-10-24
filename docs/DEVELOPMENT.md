# Local development

This guide covers running Allo Health from source on an iOS or Android device or simulator. The app is built with Expo (SDK 57), Expo Router, React Native, TypeScript, NativeWind (Tailwind CSS), React Query and Zustand. It targets iOS and Android only; the web target is not supported.

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

### Apple Health (iOS)

- The HealthKit entitlement and usage strings (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`) come from the HealthKit config plugin in `app.json`. Access is read only.
- The iOS simulator supports HealthKit but starts with no data. Open the Health app in the simulator and add samples by hand (for example resting heart rate, HRV and sleep), or use a real iPhone that already has data.
- iOS never reports which individual read types the user declined. The app treats a completed permission request as connected and shows an empty signal as unavailable.
- Workouts are read from `HKWorkoutType` for the Fitness tab.
- To see the permission sheet again, delete the app or reset access under Settings › Health › Data Access & Devices › Allo Health.

### Health Connect (Android)

- `minSdkVersion` is 26 (Android 8.0). On Android 14 and newer Health Connect is part of the system. On older versions install the Health Connect app from Google Play.
- Use an emulator image **with Google Play** so Health Connect is available.
- Read permissions are declared in `app.json` under `android.permissions` and wired up by the `react-native-health-connect` plugin. Add new record types there and rebuild.
- The app also requests `READ_HEALTH_DATA_HISTORY` so the Fitness tab can read a 60-day window, and `READ_EXERCISE` for workouts.
- Unlike iOS, Health Connect reports exactly which permissions were granted.
- Seed test data with any app that writes to Health Connect, or through the Health Connect toolbox app.
- Revoke or re-grant access from Settings › Health Connect › App permissions › Allo Health.

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

Tests cover the pure logic in `services/` (metrics, coaching and data loading), the health store, and the styling setup: `theme/nativewind.test.tsx` compiles the Tailwind config the way the iOS and Android builds do and checks every color, type, spacing and radius class against `theme/tokens.ts`. They run in Node and do not need a simulator. Use `bun run test`, not `bun test`: `bun test` starts Bun's own test runner, which does not work with the jest-expo preset.

## Project layout

```
app/                 Expo Router routes; every file is a screen
  (tabs)/            Bottom tabs: Home, Journal, Fitness, Biomarkers
  biomarkers/, fitness/  Detail pages
components/          UI: ui/ primitives, charts/, detail/, and one folder per screen
hooks/               React Query hooks: useHealthDashboard, useFitnessDashboard, useBiomarkers
services/health/     HealthProvider contract, HealthKit / Health Connect / mock adapters, data loaders
services/metrics/    Pure estimates: sleep, recovery, strain, stress, energy (index.ts), training load and zones (fitness.ts)
services/coaching/   Deterministic daily training guidance
stores/              Zustand stores (active health provider and connection state, journal, settings)
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

1. Add a route under `app/(tabs)/` and register it in `app/(tabs)/_layout.tsx`.
2. Build it from `components/ui` and the platform-independent services. Style it with `className` and the token classes so it follows the light and dark themes (see below).
3. Read health data through the `HealthProvider` (via a hook like `hooks/useHealthDashboard`), never by importing a platform health library directly from a screen.

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
| Every card is unavailable on the iOS simulator | Add sample data in the simulator's Health app. |
| Health Connect missing on Android emulator | Use a Google Play system image, or install Health Connect on Android 13 and older. |
| Dependency version warnings | `bunx expo install --fix`, then rebuild. |
