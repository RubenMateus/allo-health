---
name: Kinetic BioMetrics
colors:
  surface: '#101319'
  surface-dim: '#101319'
  surface-bright: '#363940'
  surface-container-lowest: '#0b0e14'
  surface-container-low: '#191c22'
  surface-container: '#1d2026'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353b'
  on-surface: '#e1e2eb'
  on-surface-variant: '#bacbbf'
  inverse-surface: '#e1e2eb'
  inverse-on-surface: '#2d3037'
  outline: '#84958a'
  outline-variant: '#3b4a42'
  surface-tint: '#00e2a0'
  primary: '#6effc3'
  on-primary: '#003825'
  primary-container: '#00e5a3'
  on-primary-container: '#006143'
  inverse-primary: '#006c4b'
  secondary: '#ffb4aa'
  on-secondary: '#690004'
  secondary-container: '#b6040e'
  on-secondary-container: '#ffc3bb'
  tertiary: '#e9e2ff'
  on-tertiary: '#31009a'
  tertiary-container: '#cdc2ff'
  on-tertiary-container: '#562fd8'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#43ffbb'
  primary-fixed-dim: '#00e2a0'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005138'
  secondary-fixed: '#ffdad5'
  secondary-fixed-dim: '#ffb4aa'
  on-secondary-fixed: '#410001'
  on-secondary-fixed-variant: '#930007'
  tertiary-fixed: '#e6deff'
  tertiary-fixed-dim: '#cabeff'
  on-tertiary-fixed: '#1c0062'
  on-tertiary-fixed-variant: '#4816cb'
  background: '#101319'
  on-background: '#e1e2eb'
  surface-variant: '#32353b'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  metric-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.03em
  metric-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  badge-label:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-2xs: 0.25rem
  space-xs: 0.375rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.25rem
  space-2xl: 1.5rem
  space-3xl: 2rem
---

## Brand & Style

The design system embodies elite athletic engineering, clinical biometrics, and quiet luxury. Designed for high-performing athletes, biohackers, and health-focused individuals, it bridges raw laboratory diagnostic telemetry with effortless consumer mobile interaction. The experience delivers immediate calm authority: dark, non-distracting canvases allow glowing physiological signals to communicate physical readiness, cardiovascular load, metabolic health, and nervous system recovery without cognitive friction.

The aesthetic blends **Sleek Minimalist Dark Mode** with **Precision Data-Dense Instrumentation**. Visual cues draw heavily from aerospace HUDs, micro-charts, and high-end physical wearables. Surfaces utilize layered charcoal tones, hairline borders, and targeted vibrant optical glows to elevate critical data states while preserving battery efficiency on OLED displays.

## Colors

The palette is rooted in an ultra-deep charcoal architecture (`#0D0F12` to `#1C2029`), engineered for OLED contrast and nocturnal reading comfort without pure black harshness. Biometric domains are mapped strictly to fixed hues:

- **Recovery & Vitality (`#00E5A3`):** High-saturation emerald teal signifying systemic equilibrium, restorative sleep, and elevated parasympathetic tone.
- **Strain & Cardiovascular Load (`#FF8A00` to `#FF2E54`):** A dynamic fiery gradient transitioning from kinetic amber-orange to crimson red as physical exertion scales.
- **Sleep & Circadian Rhythm (`#7C5CFF`):** Deep electric violet/indigo representing non-REM, REM cycles, and nighttime recovery metrics.
- **Sympathetic Stress & Autonomic Arousal (`#FF9F43`):** Warm amber denoting elevated metabolic stress, sympathetic spikes, or acute load.
- **VO2 Max & Aerobic Capacity (`#F59E0B`):** Focused gold designating benchmark endurance milestones and peak performance indicators.

Backgrounds follow a strict tonal hierarchy:
1. Canvas Root: `#0D0F12`
2. Card / Surface Level 1: `#14171D`
3. Elevated Cards & Modal Surfaces: `#1C2029`
4. Hairline Separation Strokes: `#282E3D` at 40%–60% opacity.

## Typography

Typography prioritizes tabular numerical clarity, legibility at micro sizes, and instant scannability during active movement:

- **Primary Typeface (Inter):** Applied across display metrics, section headers, card titles, and contextual coaching recommendations. Inter’s tall x-height and neutral geometric proportions ensure sharp rendering against dark backgrounds.
- **Telemetry & Timestamp Typeface (JetBrains Mono):** Deployed for precise diagnostic units (e.g., `ms`, `bpm`, `mmol/L`, timestamps, ticker tick-marks). Monospaced alignment prevents layout shifts during live data polling.
- **Numerical Metrics:** All numeric values use tabular numbers (`tnum`) and slashed zeros (`zero`) OpenType features to ensure columns and gauges remain visually anchored.
- **Section Headers & Overlines:** Subheaders use uppercase micro-labels with positive letter-spacing (`0.06em`) to establish clear data section boundaries without requiring heavy dividers.

## Layout & Spacing

The layout is built for fluid touch optimization within mobile viewports, utilizing a compact rhythmic spacing system based on a 4px/8px modular scale.

- **Canvas Gutters & Margins:** Edge margin is locked to `1rem` (16px) on mobile, ensuring edge-to-edge breathing room while maximizing visual width for telemetry cards. Card grids use a `0.75rem` (12px) gutter when displaying dual-column stats (e.g., Cardio Focus alongside Heart Rate Recovery).
- **Internal Card Paddings:** Standard metric tiles adopt `1rem` vertical and horizontal internal padding. Compact summary rows (e.g., Other Biomarkers) use `0.75rem` vertical and `1rem` horizontal padding.
- **Vertical Flow Rhythm:** Related metric groupings are separated by `0.75rem` gaps. Distinct logical sections (e.g., "Stress & Energy" to "Nutrition") are divided by `1.5rem` to `2rem` spacing with an uppercase tracking header.
- **Adaptation & Safe Areas:** Fully compliant with mobile dynamic island and home-indicator safe insets, reserving `4.5rem` bottom clearance for floating dock navigation tabs.

## Elevation & Depth

Visual hierarchy does not use drop shadows or faux 3D blurs. Instead, depth is established via **Tonal Layering**, **Hairline Glass Borders**, and **Localized Luminescence**:

1. **Base Layer (Level 0):** Background surface `#0D0F12`, completely flat.
2. **Surface Layer (Level 1):** Main telemetry container cards styled with `#14171D` fill, bound by a crisp 1px stroke of `rgba(255, 255, 255, 0.07)` or `#282E3D`.
3. **Elevated Elements (Level 2):** Floating circular buttons, bottom floating dock, and dropdown filter pills set to `#1C2029` with a subtle gradient ring (`rgba(255, 255, 255, 0.12)` top, `transparent` bottom).
4. **Active Biometric Glow:** Key interactive elements and metric indicators (like active circular strain gauges or sparkline endpoints) project a soft, high-intensity atmospheric radial aura (`box-shadow: 0 0 16px rgba(var(--color-primary), 0.35)`).
5. **Backdrop Filter:** Modal sheets and sticky floating navigation bars leverage `backdrop-filter: blur(20px)` over `rgba(20, 23, 29, 0.85)` to subtly reveal underlying telemetry data during scrolling.

## Shapes

The geometric identity balances industrial precision with organic anatomy:

- **Metric & Module Containers:** Primary dashboard cards feature an outer corner radius of `1.25rem` (20px), echoing modern device hardware bezels.
- **Interactive Controls & Status Badges:** Segmented controls, status chips (e.g., "Active", "Decreasing"), and filter switches use absolute full pill geometry (`border-radius: 9999px`).
- **Internal Chart Bars & Cells:** Activity heatmap blocks use soft micro-radii (3px to 4px) to present discrete daily activity chunks cleanly without visual harshness.
- **Action Buttons & Floating Docks:** Circular FABs and the floating bottom navigation bar sport continuous squircle or pill curvatures that rest ergonomically under one-handed thumb interaction.

## Components

### Gauge Rings & Radial Arc Indicators
- **Structure:** Concentric circular arcs with a muted track (`rgba(255, 255, 255, 0.08)`) and an illuminated stroke path.
- **Stroke Dynamics:** Continuous gradient fills matching metric context (e.g., Strain gradient from `#FF8A00` to `#FF2E54`).
- **Center Telemetry:** Displays the scalar number in `Inter 24px/600` with the label directly below in `caption` muted text. A luminous indicator bead pins the leading edge of the active stroke.

### Metric Cards & Trend Rows
- **Layout:** Top row holds the category icon and section label with a secondary trailing arrow (`→`). The middle row highlights the primary measurement (`Inter 20px-24px/700`) and trend state badge. The right container is reserved for an embedded micro-sparkline or mini-gauge.
- **Micro Sparklines:** Minimal vector lines (1.5px stroke) with a terminal glowing point dot. Baseline dashed reference rules denote physiological normal zones.

### Activity Grid Heatmap
- **Matrix:** 7-column calendar grid representation displaying day-of-week letterings above micro rounded-pill activity cells.
- **State Tiers:** Inactive days use `#1C2029`. Graduated intensity levels scale from muted emerald green (`rgba(0, 229, 163, 0.35)`) up to neon green (`#00E5A3`) and sky blue for peak multi-session thresholds.

### Segmented Controls & Pills
- **Container:** Dark track in `#14171D` with 1px border.
- **Selection State:** Active item sits on an elevated `#282E3D` or `#1C2029` pill surface with crisp white text and a micro-glow, while inactive tabs display muted text (`#616A7D`).

### Floating Bottom Navigation Bar
- **Form:** Floating island pill elevated 16px above the device home indicator, surrounded by a 1px boundary stroke.
- **Composition:** Icon and micro-label tabs (Home, Journal, Fitness, Biology) accompanied by an offset circular Quick Add (`+`) floating trigger button on the far right.