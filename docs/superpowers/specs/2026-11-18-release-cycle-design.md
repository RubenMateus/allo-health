# Release cycle design

Date: 2026-11-18 · Size: small change (short design)

## Intent
Know exactly which version of Allo Health is on the phone, and be able to rebuild a known good point. Today every PR squash-merges to main, the version has stayed at 1.0.0, and there are no tags, releases or changelog. Builds are local (`bunx expo run:ios`).

## Goals
- Versions bump automatically from PR titles (`feat:` = minor, `fix:` = patch).
- `CHANGELOG.md` written from those titles.
- A git tag `vX.Y.Z` and a GitHub release for each release.
- Ruben decides when to release by merging a PR.
- The app shows its version and commit in Settings.

## Non-goals
- Store builds, TestFlight, Play tracks, EAS (the store pipeline stays on hold).
- OTA updates and a fixed release schedule.

## Approaches
1. **release-please release PR (picked by Ruben).** A GitHub Action keeps one "chore: release X.Y.Z" PR open that updates as features merge. Merging it tags the commit and creates the GitHub release. Works from the phone and needs no local tooling.
2. Manual "Release" button (workflow_dispatch) that bumps, writes the changelog, commits to main and tags in one go. No preview, and the Action needs to push to main.
3. Local `bun run release` script. Only happens at the desk, and cloud threads can't push tags.
(changesets was dropped as too heavy for a single-package app.)

## Design
- `.github/workflows/release-please.yml` on push to main, using `googleapis/release-please-action`, permissions `contents: write` + `pull-requests: write`.
- `release-please-config.json` + `.release-please-manifest.json`, release type `node` (bumps package.json), with `app.json` `expo.version` as an extra JSON file so both stay in sync.
- Changelog sections: Features, Bug fixes; `build(deps)`, `docs`, `chore` hidden.
- **First release (my call):** v1.0.0 = everything on main today, so the current phone build has a tag. Later releases follow normal bumps.
- **Settings (my call):** a small "Version 1.2.0 (abc1234)" line at the bottom of Settings. The version comes from `expo-constants`. The commit id is injected at build time by turning `app.json` into an `app.config.ts` that reads `git rev-parse --short HEAD` into `extra.commit` (falls back to "dev").
- Rollback = `git checkout vX.Y.Z` and build locally. Documented in docs/DEVELOPMENT.md.

## Things to know
- Ruben must enable "Allow GitHub Actions to create and approve pull requests" (repo Settings → Actions → General) once.
- PRs opened by the default Actions token don't trigger CI, so the release PR shows no checks. It only touches versions and the changelog, so that's acceptable.

## Left to the builder
Exact action version, changelog header text, test for the Settings version line.
