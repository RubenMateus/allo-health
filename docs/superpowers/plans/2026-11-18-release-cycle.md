# Release Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatic version bumps, tags, GitHub releases and a CHANGELOG via a release-please PR, plus the commit id next to the version in Settings.

**Architecture:** release-please (manifest mode, `node` release type) runs on every push to main and maintains one release PR; `app.json` is an extra file so its `expo.version` moves with package.json. A thin `app.config.ts` extends `app.json` with `extra.commit`; Settings formats version + commit through a pure helper.

**Tech Stack:** GitHub Actions, googleapis/release-please-action@v4, Expo config (app.config.ts), expo-constants, Jest (jest-expo) via `bun run test`.

**Spec:** `docs/superpowers/specs/2026-11-18-release-cycle-design.md`

## Global Constraints

- Tags are `vX.Y.Z`; first release is v1.0.0 covering everything on main today.
- `feat:` = minor bump, `fix:` = patch. Changelog shows Features and Bug fixes only; `build`, `docs`, `chore`, `ci`, `test`, `refactor`, `style` hidden.
- `app.json` stays the static base config (release-please edits `$.expo.version`).
- Settings label: `Allo Health 1.2.0 (abc1234)`; commit falls back to `dev`.
- No network calls carrying health data; no new runtime dependencies.
- Run tests with `bun run test`, never `bun test`.

## Review Focus

1. Build with no git available (tarball, CI without .git): config must not throw; commit = `dev`. Test in Task 1.
2. `extra` missing or commit not a string at runtime (web dev build, Expo Go): label still renders version alone. Test in Task 1.
3. `release-as: 1.0.0` left in config after v1.0.0 ships would pin every later release to 1.0.0. Task 2 documents the removal step.
4. Version in package.json and app.json drifting: both listed in release-please config; Task 2 verifies the extra-files jsonpath.
5. Existing `expo.extra` keys (e.g. router/eas) must survive the spread in app.config.ts. Test in Task 1.

---

### Task 1: Commit id in config and Settings

**Files:**
- Create: `app.config.ts`, `lib/appVersion.ts`, `lib/appVersion.test.ts`
- Modify: `components/settings/SettingsScreen.tsx:196-198`

**Interfaces:**
- Produces: `formatVersionLabel(version?: string | null, commit?: unknown): string` and `resolveCommit(run?: () => string): string` in `lib/appVersion.ts`; `app.config.ts` default export `({ config }: ConfigContext) => ExpoConfig` adding `extra.commit`.

- [ ] **Step 1: Write failing tests** in `lib/appVersion.test.ts`:
  - `formatVersionLabel("1.2.0", "abc1234")` → `"Allo Health 1.2.0 (abc1234)"`
  - `formatVersionLabel("1.2.0", undefined)` and `(…, 42)` → `"Allo Health 1.2.0"`
  - `formatVersionLabel(undefined, undefined)` → `"Allo Health"`
  - `resolveCommit(() => "abc1234\n")` → `"abc1234"`; `resolveCommit(() => { throw new Error() })` → `"dev"`; `resolveCommit(() => "")` → `"dev"`
  - app.config: calling the default export with `{ config: { name: "x", slug: "x", extra: { keep: 1 } } }` returns `extra.keep === 1` and a string `extra.commit`.
- [ ] **Step 2:** `bun run test lib/appVersion` → FAIL (module not found).
- [ ] **Step 3: Implement.** `resolveCommit` defaults `run` to `execSync("git rev-parse --short HEAD", { stdio: ["ignore","pipe","ignore"] }).toString()`; import `child_process` lazily inside the default so the app bundle never pulls it (only app.config.ts calls `resolveCommit` without an argument). `app.config.ts` spreads `config` and `config.extra`, sets `commit: resolveCommit()`. Settings uses `formatVersionLabel(Constants.expoConfig?.version, Constants.expoConfig?.extra?.commit)`.
- [ ] **Step 4:** `bun run test lib/appVersion`, `bun run typecheck`, `bun run lint`, and `bunx expo config --json | grep -E '"version"|"commit"'` shows `1.0.0` and a sha → PASS.
- [ ] **Step 5: Commit** `feat(settings): show build commit next to the version`.

### Task 2: release-please workflow

**Files:**
- Create: `.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`
- Modify: `docs/DEVELOPMENT.md` (new "Releases" section)

**Interfaces:** consumes nothing from Task 1.

- [ ] **Step 1: Config.** Manifest `{ ".": "0.0.0" }`. Config: package `.`, `release-type: node`, `package-name: allo-health`, `include-component-in-tag: false`, `release-as: "1.0.0"`, `extra-files: [{ "type": "json", "path": "app.json", "jsonpath": "$.expo.version" }]`, `changelog-sections`: feat → "Features", fix → "Bug fixes", perf → "Performance", others `hidden: true`.
- [ ] **Step 2: Workflow.** `on: push: branches: [main]`, `permissions: contents: write, pull-requests: write`, one job running `googleapis/release-please-action@v4` with `config-file` and `manifest-file` set.
- [ ] **Step 3: Verify.** `python3 -c 'import json;[json.load(open(f)) for f in ["release-please-config.json",".release-please-manifest.json"]]'`, yaml parses, and `bunx release-please release-pr --dry-run --repo-url=RubenMateus/allo-health --token=$GITHUB_TOKEN` if a token is available (else note it as untested until merge).
- [ ] **Step 4: Docs.** "Releases" section: how the release PR works, one-time repo setting "Allow GitHub Actions to create and approve pull requests", release PR has no CI checks, rollback = `git checkout vX.Y.Z && bunx expo prebuild --clean && bunx expo run:ios`, and **remove `release-as` from the config after v1.0.0 is tagged**.
- [ ] **Step 5: Commit** `ci: add release-please release workflow`.
