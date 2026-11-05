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
- `src/lib/components/`: tabs `TodayTab` (built from snippets; medication moves above hydration during a headache), `MedsTab` (10/20 rule, personal limits, how well each medication works, recent intakes), `CalendarTab` (+ `DaySheet`), `InsightsTab` (sections Overview, Connections, Hydration, Patterns; `TimelineChart`, `ComparisonChart`). Sheets: `SettingsSheet`, `MedListSheet` and `DrinkListSheet` (the lists and the hydration goal, opened from Today, Meds and Settings), `ReportSheet`, `EditorSheet` (edit any episode, intake, drink or night), `VersionsSheet`. Cards: `PrognosisCard`, `WelcomeCard` (until the first entry). Shared: `Sheet`, `Toasts`, `Celebration`, `BarChart`, `IntensityPicker`, `RuleBadge`, `OrderButtons`.
- Things go where they are used: list editing next to the list, reports in Insights, settings only for what has no better home.
- `src/lib/db.ts`: Dexie schema, entity types, default medication and drink lists, `seed`.
- `src/lib/store.svelte.ts`: all data in one `$state` object. Every write goes to Dexie and then calls `load()`, which reloads everything. `Settings` lives here with its defaults.
- `src/lib/analysis.ts`: pure functions for headache days, medication days, the 10/20 rule, personal limits, rolling counts, monthly counts, period stats. Well tested; put new statistics here, not in components.
- `src/lib/prognosis.ts`: the traffic light on Today. Five factors (pressure drop today or tomorrow per `isPressureDrop`, hydration yesterday or behind today's pace, last night under 6 h, alcohol yesterday or today, caffeine drop from noon) are each ok, bad or unknown; 0–1 bad is green, 2 yellow, 3 or more red. Unknown factors never count. The same light drives the marker at the top of Today and the evening notification (the forecast at the chosen hour, if nothing more is logged). No percentages or estimated chances: the app counts factors and shows the user's own numbers.
- `src/lib/report.ts`: one-page doctor PDF (jsPDF + jspdf-autotable): header with logo, key figures, calendar, two charts, medication, triggers. It must stay on one A4 page for up to 12 months; `report.test.ts` checks the page count.
- `src/lib/doctor.svelte.ts`: builds the report from the current data with the app icon as logo, or the CSV for the same period, and shares it. Used by Settings and Insights.
- `src/lib/reminders.ts`: local notifications. Hydration reminders when behind the goal, drink check-ins at fixed times with drink buttons, "did it help?" after an intake, "still a headache?" every N hours.
- `src/lib/backup.ts`: JSON backup and restore, CSV export, `saveFile` (Android share sheet or browser download).
- `src/lib/gist.ts`, `sync.svelte.ts`: optional backup to a secret GitHub Gist.
- `src/lib/sleep.ts` and `android/.../ScreenEventsPlugin.java`: sleep estimate from Android's screen on/off events (`UsageStatsManager`, usage access granted by the user). `estimateNight` is pure and tested; `syncNights` recomputes the last 8 nights on app start and return, but never a night the user edited (`source: 'manual'`). Moving the emulator clock rewrites usage event times, so a night cannot be simulated there; test the algorithm with unit tests.
- `src/lib/weather.ts`: Open-Meteo place search and daily weather. `pressureDrop` is how far the daily mean pressure fell from the day before; `isPressureDrop` (more than 5 hPa) follows Kimoto et al. 2011 and is the only place that decides what a pressure drop is. Keep thresholds that come from studies with the study's own measure. (archive for old days, forecast API for the last two weeks and tomorrow), stored in the `weather` table by day. Not part of backups; it can always be fetched again. `updateWeather()` in the store syncs at most every 3 hours.
- `src/lib/i18n.svelte.ts`: English and German strings, `t()`, date formatting `fmt()`, tag labels.
- `src/lib/ui.svelte.ts`: toasts with undo, haptics, sheet stack, theme, datetime-local helpers.
- `src/lib/editor.svelte.ts`: which entry the editor sheet shows.
- `src/lib/demo.ts`: 90 days of seeded demo data (Settings → Load demo data).
- `android/`: Capacitor project. Hand-edited: `app/build.gradle` (version and signing from the environment), `AndroidManifest.xml` (`USE_EXACT_ALARM`, `PACKAGE_USAGE_STATS`), `MainActivity.java` (registers `ScreenEventsPlugin`), `res/drawable/ic_stat_headlog.xml` (notification icon). Icons and splash images are generated.
- `assets/icon.svg`: icon source. `<defs>`, then `<g id="background">`, then `<g id="foreground">` as the last element; `scripts/generate-icons.mjs` relies on that order.

## Rules that are easy to break

### Data

- Dexie schema is at `version(1)`. Adding a field that is not indexed needs no new version; make it optional in the type and handle `undefined` (see `Medication.limitDays`). Changing indexes needs `this.version(2).stores(...)` with an upgrade, never an edit of version 1.
- Intakes and drinks copy name, dose and category from their list entry, so history survives edits and deletes of the list. Keep it that way.
- Backups are `{ app: 'headlog', version: 1, tables }`. Restoring must keep working for old backup files: tables added later (`sleep`) go into `OPTIONAL_TABLES` in `backup.ts`, so backups without them stay valid. New settings get defaults through the merge in `load()`.
- The Gist token is stored in `localStorage`, never in IndexedDB, so it never ends up inside a backup. Connecting to an account that already has a backup must offer a restore before anything is uploaded.
- Automatic Gist uploads must never replace a real backup with nothing: they skip an empty diary, and "Delete all data" and "Load demo data" pause them (`pauseSync`) until a manual "Back up now" or a restore. Keep both guards when touching sync.
- Renamed or retyped settings need a migration in `load()` (see the old boolean `reliefCheck` turning into `reliefCheckMinutes`).

### Medical logic

- 10/20 rule: acute medication on at most 10 of any 30 consecutive days, today included. Preventive medication does not count (`ACUTE_CATEGORIES`). The limit is a setting.
- Personal limit per medication: at most `limitDays` days with that medication in any `limitWindow` days (default 30). Counted per `medId`.
- Monthly overuse thresholds follow ICHD-3 8.2: simple analgesics 15 days; triptans, ergotamines, combinations and opioids 10 days (`MONTHLY_LIMITS`); several of these classes together 10 days (`MULTIPLE_CLASSES_LIMIT`, ICHD-3 8.2.6). Preventive medication and antiemetics do not count. `guessCategory` maps known active ingredients and brands to a class.
- `ruleStatus`: caution from 80% of the limit, over above the limit.
- The app is a diary, not medical advice; keep the disclaimer wording.

### Notifications

- Fixed id ranges: water 100–113, "still a headache?" 200–211, drink check-ins 300–355, evening forecast 400, "did it help?" 100000 + intake id. Keep new kinds out of these ranges.
- Every scheduling call goes through `serial()` in `reminders.ts`. Without it, an older plan can finish after a newer one and leave stale notifications.
- Rescheduling is declarative: `+page.svelte` recomputes the plans whenever data or settings change and on return to the app. Add new reminder kinds the same way (pure `plan…` function with tests, `apply…` that cancels its id range and schedules).
- The manifest declares `USE_EXACT_ALARM`, which Android grants on install for apps outside Google Play. Without it, the plugin opens the "Alarms & reminders" settings screen on its own, or falls back to alarms up to 45 minutes late.
- Notification buttons launch the app; the plugin keeps the event until the listener in `+page.svelte` is registered. All button sets are registered together in `registerActions()`, because registering replaces the whole set.
- `saveSettings` snapshots the merged object. Never write `$state` proxies (e.g. an array taken from `data.settings`) to IndexedDB: the Android WebView refuses them, fake-indexeddb in the tests does not, so only the device shows the failure.

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

## Branches and pull requests

`main` is protected: no direct pushes, not even for admins. Every change goes through a pull request whose `CI` check (type check, tests, build) passes, and is squash-merged; the branch is deleted on merge.

1. Branch off the latest `main`: `feature/<slug>` for features, `fix/<slug>` for fixes, `release/X.Y.Z` for a release.
2. Commit, push, open a PR: `gh pr create -B main -t "<title>" -b "<what and why, how it was tested>"`.
3. Add a line under `## [Unreleased]` in `CHANGELOG.md` in the same PR.
4. Wait for CI (`gh pr checks --watch`), then `gh pr merge --squash`.

## Releases

Releases are cut from `main` only.

1. Branch `release/X.Y.Z`: move the `## [Unreleased]` entries under a new `## [X.Y.Z] - <date>` heading (the release notes are cut from it) and bump `version` in `package.json`. PR and merge as above.
2. Tag the merged commit on `main`: `git checkout main && git pull && git tag vX.Y.Z && git push origin vX.Y.Z`.
3. `.github/workflows/android-release.yml` checks, tests, builds, signs and publishes `headlog-X.Y.Z.apk`. Obtainium picks it up.

`versionCode` is `major*10000 + minor*100 + patch` and must grow with every release. The signing key is a repository secret; the owner keeps the keystore outside the repository. Android only installs updates signed with the same key, so never change the signing setup.
