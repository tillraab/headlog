# HeadLog

Android app for logging headaches, medication and water, with a 10/20 rule tracker, insights, a doctor PDF and reminders. A SvelteKit single-page app wrapped by Capacitor. No server: all data lives in IndexedDB on the phone. The user installs releases through Obtainium from GitHub releases.

## Commands

```bash
bun install
bun run dev        # browser dev server; native features (haptics, notifications, share) are no-ops there
bun run check      # svelte-check, must report 0 errors
bun run test       # vitest, all tests must pass
bun run build      # static build into build/
bunx cap sync android && (cd android && ./gradlew assembleRelease)   # APK, needs JDK 21 and the Android SDK
bun run icons      # regenerate favicon and all Android icons from assets/icon.svg
```

Run `bun run check` and `bun run test` before every commit.

## Layout

- `src/routes/+page.svelte`: the whole app shell. Swipeable tabs (CSS scroll snap), bottom nav, Android back button, app lifecycle (load, Gist sync on leave, reminder rescheduling in an `$effect`, notification button handling).
- `src/lib/components/`: `TodayTab`, `CalendarTab` (+ `DaySheet`), `MedsTab` (10/20 rule and personal limits), `InsightsTab`, `SettingsSheet`, `EditorSheet` (edit any episode, intake or drink), shared `Sheet`, `Toasts`, `BarChart`, `IntensityPicker`, `RuleBadge`.
- `src/lib/db.ts`: Dexie schema, entity types, default medication and drink lists, `seed`.
- `src/lib/store.svelte.ts`: all data in one `$state` object. Every write goes to Dexie and then calls `load()`, which reloads everything. `Settings` lives here with its defaults.
- `src/lib/analysis.ts`: pure functions for headache days, medication days, the 10/20 rule, personal limits, rolling counts, monthly counts, period stats. Well tested; put new statistics here, not in components.
- `src/lib/report.ts`: doctor PDF (jsPDF + jspdf-autotable).
- `src/lib/reminders.ts`: local notifications. Water reminders, "did it help?" one hour after an intake, "still a headache?" every N hours.
- `src/lib/backup.ts`: JSON backup and restore, CSV export, `saveFile` (Android share sheet or browser download).
- `src/lib/gist.ts`, `sync.svelte.ts`: optional backup to a secret GitHub Gist.
- `src/lib/i18n.svelte.ts`: English and German strings, `t()`, date formatting `fmt()`, tag labels.
- `src/lib/ui.svelte.ts`: toasts with undo, haptics, sheet stack, theme, datetime-local helpers.
- `src/lib/editor.svelte.ts`: which entry the editor sheet shows.
- `src/lib/demo.ts`: 90 days of seeded demo data (Settings → Load demo data).
- `android/`: Capacitor project. Hand-edited: `app/build.gradle` (version and signing from the environment), `AndroidManifest.xml` (`USE_EXACT_ALARM`), `res/drawable/ic_stat_headlog.xml` (notification icon). Icons and splash images are generated.
- `assets/icon.svg`: icon source. `<defs>`, then `<g id="background">`, then `<g id="foreground">` as the last element; `scripts/generate-icons.mjs` relies on that order.

## Rules that are easy to break

### Data

- Dexie schema is at `version(1)`. Adding a field that is not indexed needs no new version; make it optional in the type and handle `undefined` (see `Medication.limitDays`). Changing indexes needs `this.version(2).stores(...)` with an upgrade, never an edit of version 1.
- Intakes and drinks copy name, dose and category from their list entry, so history survives edits and deletes of the list. Keep it that way.
- Backups are `{ app: 'headlog', version: 1, tables }`. Restoring must keep working for old backup files. New settings get defaults through the merge in `load()`.
- The Gist token is stored in `localStorage`, never in IndexedDB, so it never ends up inside a backup. Connecting to an account that already has a backup must offer a restore before anything is uploaded.
- Automatic Gist uploads must never replace a real backup with nothing: they skip an empty diary, and "Delete all data" and "Load demo data" pause them (`pauseSync`) until a manual "Back up now" or a restore. Keep both guards when touching sync.
- Renamed or retyped settings need a migration in `load()` (see the old boolean `reliefCheck` turning into `reliefCheckMinutes`).

### Medical logic

- 10/20 rule: acute medication on at most 10 of any 30 consecutive days, today included. Preventive medication does not count (`ACUTE_CATEGORIES`). The limit is a setting.
- Personal limit per medication: at most `limitDays` days with that medication in any `limitWindow` days (default 30). Counted per `medId`.
- Monthly overuse thresholds follow ICHD-3: simple analgesics 15 days, triptans, combinations and opioids 10 days (`MONTHLY_LIMITS`).
- `ruleStatus`: caution from 80% of the limit, over above the limit.
- The app is a diary, not medical advice; keep the disclaimer wording.

### Notifications

- Fixed id ranges: water 100–113, "still a headache?" 200–211, "did it help?" 100000 + intake id. Keep new kinds out of these ranges.
- Every scheduling call goes through `serial()` in `reminders.ts`. Without it, an older plan can finish after a newer one and leave stale notifications.
- Rescheduling is declarative: `+page.svelte` recomputes the plans whenever data or settings change and on return to the app. Add new reminder kinds the same way (pure `plan…` function with tests, `apply…` that cancels its id range and schedules).
- The manifest declares `USE_EXACT_ALARM`, which Android grants on install for apps outside Google Play. Without it, the plugin opens the "Alarms & reminders" settings screen on its own, or falls back to alarms up to 45 minutes late.
- Notification buttons launch the app; the plugin keeps the event until the listener in `+page.svelte` is registered.

### UI

- Colors, radii and type sizes are tokens in `src/app.css` (`bg-surface`, `text-pain`, `text-med`, `text-water`, `text-2xs`, …). Use the `card`, `press`, `tabular` utilities.
- Frequent actions are one tap. Reversible actions show an undo toast instead of a confirmation; `confirm()` only for replacing or deleting all data.
- Sheets open through `openSheet(id)`; the Android back button closes the newest sheet first.
- Every string goes through `t()` and needs an English and a German entry; `de` is typed against `en`, so a missing key is a type error. Dates go through `fmt()`, written German-style (`d. MMM`); English drops the dot.

## Testing

- Vitest runs in Node with `fake-indexeddb` and `TZ=Europe/Berlin`. Tests that need a database create their own `new HeadLogDb(random name)`.
- Mock only `fetch` (GitHub) and native plugins; everything else runs for real.
- UI check in a browser: `bun run build && bunx vite preview`, then Playwright. Restart `vite preview` after every build, it keeps serving the old asset hashes.
- On Android: an emulator with an x86_64 Google APIs image works headless (`emulator -avd <name> -no-window`). `adb root` plus `adb shell date MMDDhhmmYYYY.ss` moves the clock forward to fire reminders; `uiautomator dump` finds notification buttons to tap.

## Releases

1. Add the changes under a new version heading in `CHANGELOG.md` (the release notes are cut from it), bump `version` in `package.json`.
2. Commit, then `git tag vX.Y.Z && git push origin main vX.Y.Z`.
3. `.github/workflows/android-release.yml` checks, tests, builds, signs and publishes `headlog-X.Y.Z.apk`. Obtainium picks it up.

`versionCode` is `major*10000 + minor*100 + patch` and must grow with every release. The signing key is a repository secret; the owner keeps the keystore outside the repository. Android only installs updates signed with the same key, so never change the signing setup.
