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

The Bun version is pinned in `packageManager` in `package.json`; CI uses the same one. Code that ships in the app goes in `dependencies`, tools for building and testing in `devDependencies`.

## Layout

- `src/routes/+page.svelte`: the whole app shell. Swipeable tabs (CSS scroll snap), bottom nav, Android back button, app lifecycle (load, Gist sync on leave, reminder rescheduling in an `$effect`, notification button handling).
- `src/lib/components/`: tabs `TodayTab` (built from snippets; medication moves above hydration during a headache), `MedsTab` (10/20 rule, personal limits, how well each medication works, recent intakes, overuse limits; single days live in the calendar), `CalendarTab` (+ `DaySheet`), `InsightsTab` (sections Overview, Connections, Hydration, Patterns; `TimelineChart`, `ComparisonChart`). Sheets: `SettingsSheet`, `MedListSheet` and `DrinkListSheet` (the lists and the hydration goal, opened from Today, Meds and Settings), `ReportSheet`, `EditorSheet` (edit any episode, intake, drink or night), `VersionsSheet`. Cards: `PrognosisCard`, `WelcomeCard` (until the first entry). Shared: `Sheet` (optional `info` puts an (i) button next to the title), `InfoButton` and `InfoPopover` (explanations behind an (i) button), `CardHeading` (card title with an optional (i) button), `Toasts`, `Celebration`, `BarChart`, `IntensityPicker`, `RuleBadge`, `OrderButtons`.
- Things go where they are used: list editing next to the list, reports in Insights, settings only for what has no better home.
- `src/lib/db.ts`: Dexie schema, entity types (`Relief`, `Draft`), default medication and drink lists, `seed`.
- `src/lib/medication.ts`: medication classes (`CATEGORIES`, `MedCategory`, `ACUTE_CATEGORIES`), the ICHD-3 limits, `guessCategory`, `fromMedication`. `drinks.ts`: `CAFFEINE`, `hydrationMl`, `fromPreset`. `colors.ts`: `MED_COLORS`, `medColor`, `intakeColor`.
- `src/lib/store.svelte.ts`: all data in one `$state` object. Every write goes to Dexie and then calls `load()`, which reloads everything. It imports no UI module.
- `src/lib/settings.ts`: `Settings`, `DEFAULT_SETTINGS` and `mergeSettings`, which fills defaults (one level deep for settings that are objects) and carries renamed settings over.
- `src/lib/migrations.ts`: one-time changes to stored data, in order, each guarded by a flag row in `settings`; `load()` runs them.
- `src/lib/analysis.ts`: pure functions for headache days, medication days, the 10/20 rule, personal limits, rolling counts, monthly counts, period stats, medication effect, overuse rows, the month summary. Well tested; put new statistics here, not in components.
- `src/lib/format.ts`: text shared by several screens (`formatComparison`, `entryDetailLines`). `days.ts`: day keys, `MINUTE`/`HOUR`/`DAY`, `hm`, `formatDuration`, `formatLiters`.
- `src/lib/thresholds.ts`: the factor thresholds shared by the forecast and the report.
- `src/lib/prognosis.ts`: the traffic light on Today. Five factors (pressure drop today per `isPressureDrop`; tomorrow only counts in `tomorrowRisk`, hydration yesterday or behind today's pace, last night under 5 h asleep or under 85 % of it asleep, alcohol yesterday or today, caffeine drop: today below half of what is usual by this time of day, or yesterday below half of the usual day, against up to 14 logged days and only from 7) are each ok, bad or unknown; 0 bad is green, 1 yellow, 2 or more red. Unknown factors never count. The same light drives the marker at the top of Today. The evening notification uses `tomorrowRisk` instead: only tomorrow's pressure drop, today's total below three quarters of the goal and alcohol today count, as they stand at the chosen hour. No percentages or estimated chances: the app counts factors and shows the user's own numbers.
- `src/lib/report.ts`: doctor PDF (jsPDF + jspdf-autotable): header with logo, key figures, calendar, two charts, medication, triggers. `reportData` computes every number and row without drawing; `doctorReport` draws from it. The overview must stay on the first A4 page for up to 12 months; after it come possible triggers (`compareDays`, `dayFactors`) and a table of every headache and intake.
- `src/lib/doctor.svelte.ts`: builds the report from the current data with the app icon as logo, or the CSV for the same period, and shares it. Used by Settings and Insights.
- `src/lib/reminders.ts`: local notifications. Hydration reminders when behind the goal, a drink reminder after N hours without a logged drink inside a daily window, "did it help?" after an intake, "still a headache?" every N hours, the evening forecast, the morning sleep question. `planAll` builds every plan from the app data.
- `src/lib/backup.ts`: JSON backup and restore, CSV export, `saveFile` (Android share sheet or browser download).
- `src/lib/gist.ts`, `sync.svelte.ts`: optional backup to a secret GitHub Gist.
- `src/lib/sleep.ts` and `android/.../ScreenEventsPlugin.java`: sleep estimate from Android's screen on/off events (`UsageStatsManager`, usage access granted by the user). `estimateNight` is pure and tested; `syncNights` recomputes the last 8 nights on app start and return, but never a night the user edited (`source: 'manual'`). Moving the emulator clock rewrites usage event times, so a night cannot be simulated there; test the algorithm with unit tests.
- `src/lib/weather.ts`: Open-Meteo place search and daily weather. `pressureDrop` is how far the daily mean pressure fell from the day before; `isPressureDrop` (more than 5 hPa) follows Kimoto et al. 2011 and is the only place that decides what a pressure drop is. Keep thresholds that come from studies with the study's own measure. (archive for old days, forecast API for the last two weeks and tomorrow), stored in the `weather` table by day. Not part of backups; it can always be fetched again. `updateWeather()` in the store syncs at most every 3 hours.
- `src/lib/i18n.svelte.ts`: `t()`, date formatting `fmt()`, numbers in the app language `num()`, tag and relief labels. The strings live in `src/lib/i18n/en.ts` and `de.ts`.
- `src/lib/ui.svelte.ts`: toasts with undo, haptics, sheet stack, the open explanation (`showInfo`), theme, datetime-local helpers.
- `src/lib/editor.svelte.ts`: which entry the editor sheet shows; `openNight` opens the sleep editor.
- `src/lib/demo.ts`: 90 days of seeded demo data (Settings → Load demo data).
- `android/`: Capacitor project. Hand-edited: `app/build.gradle` (version and signing from the environment), `AndroidManifest.xml` (`USE_EXACT_ALARM`, `PACKAGE_USAGE_STATS`), `MainActivity.java` (registers `ScreenEventsPlugin`), `res/drawable/ic_stat_headlog.xml` (notification icon). Icons and splash images are generated.
- `assets/icon.svg`: icon source. `<defs>`, then `<g id="background">`, then `<g id="foreground">` as the last element; `scripts/generate-icons.mjs` relies on that order.

## Rules that are easy to break

### Data

- Dexie schema is at `version(3)`. Adding a field that is not indexed needs no new version; make it optional in the type and handle `undefined` (see `Medication.limitDays`). Changing indexes or adding a table needs the next version (`this.version(4).stores(...)`, with an upgrade when existing rows change), never an edit of an existing version.
- Intakes and drinks copy name, dose and category from their list entry, so history survives edits and deletes of the list. Keep it that way.
- Backups are `{ app: 'headlog', version: 1, tables }`. Restoring must keep working for old backup files: tables added later (`sleep`) go into `OPTIONAL_TABLES` in `backup.ts`, so backups without them stay valid. New settings get defaults through `mergeSettings`.
- The Gist token is stored in `localStorage`, never in IndexedDB, so it never ends up inside a backup. Connecting to an account that already has a backup must offer a restore before anything is uploaded.
- Automatic Gist uploads must never replace a real backup with nothing: they skip an empty diary, and "Delete all data" and "Load demo data" pause them (`pauseSync`) until a manual "Back up now" or a restore. Keep both guards when touching sync.
- Renamed or retyped settings need a step in `mergeSettings` (see the old boolean `reliefCheck` turning into `reliefCheckMinutes`). Changes to stored rows go into `migrations.ts` as a new step at the end of the list.

### Medical logic

- 10/20 rule: acute medication on at most 10 of any 30 consecutive days, today included. Preventive medication does not count (`ACUTE_CATEGORIES`). The limit is a setting.
- Personal limit per medication: at most `limitDays` days with that medication in any `limitWindow` days (default 30). Counted per `medId`.
- Monthly overuse thresholds follow ICHD-3 8.2: simple analgesics 15 days; triptans, ergotamines, combinations and opioids 10 days (`MONTHLY_LIMITS`); several of these classes together 10 days (`MULTIPLE_CLASSES_LIMIT`, ICHD-3 8.2.6). Preventive medication and antiemetics do not count. `guessCategory` maps known active ingredients and brands to a class.
- `ruleStatus`: caution from 80% of the limit, over above the limit.
- The app is a diary, not medical advice; keep the disclaimer wording.

### Notifications

- Fixed id ranges: water 100–113, "still a headache?" 200–211, drink reminder 300–353, evening forecast 400, morning sleep question 500–501, "did it help?" 100000 + intake id. They are `RANGES` in `reminders.ts`; keep new kinds out of these ranges. The "did it help?" notification carries the intake's time, and an answer only counts while the intake still has it.
- Every scheduling call goes through `serial()` in `reminders.ts`. Without it, an older plan can finish after a newer one and leave stale notifications.
- Rescheduling is declarative: `+page.svelte` applies `planAll` whenever data or settings change and on return to the app. Add new reminder kinds the same way (pure `plan…` function with tests, added to `planAll` and `RANGES`, `apply…` that calls `replaceRange`).
- The manifest declares `USE_EXACT_ALARM`, which Android grants on install for apps outside Google Play. Without it, the plugin opens the "Alarms & reminders" settings screen on its own, or falls back to alarms up to 45 minutes late.
- Notification buttons launch the app; the plugin keeps the event until the listener in `+page.svelte` is registered. All button sets are registered together in `registerActions()`, because registering replaces the whole set.
- `saveSettings` snapshots the merged object. Never write `$state` proxies (e.g. an array taken from `data.settings`) to IndexedDB: the Android WebView refuses them, fake-indexeddb in the tests does not, so only the device shows the failure.

### UI

- Colors, radii and type sizes are tokens in `src/app.css` (`bg-surface`, `text-pain`, `text-med`, `text-water`, `text-caption`, `text-axis`, …). The type scale is raised for reading on a phone: `text-sm` is body text (16 px), `text-xs` secondary text (14 px), `text-caption` the smallest text (12 px), `text-axis` only for chart axes. Use the `card`, `press`, `tabular` utilities.
- Touch targets are at least 44 px (`size-11`, `min-h-11`); icons in buttons 20–24 px.
- Text that explains rather than labels goes behind an (i) button: `InfoButton`, `CardHeading info=…` or `Sheet info=…`. Keep short labels and instructions needed to act on the screen.
- Frequent actions are one tap. Reversible actions show an undo toast instead of a confirmation; `confirm()` only for replacing or deleting all data.
- Sheets open through `openSheet(id)` with an id from `SheetId`; the Android back button closes an open explanation first, then the newest sheet.
- Every string goes through `t()` and needs an English and a German entry; `de` is typed against `en`, so a missing key is a type error. Dates go through `fmt()`, written German-style (`d. MMM`); English drops the dot.

## Testing

- Vitest runs in Node with `fake-indexeddb`, `TZ=Europe/Berlin` and the app language set to English, whatever the machine's locale. Tests that need a database create their own `new HeadLogDb(random name)`.
- Mock only `fetch` (GitHub) and native plugins; everything else runs for real. Tests that mock Capacitor plugins live in `*.native.test.ts` (`vi.mock` and a dynamic import of the module under test).
- `bun run test:coverage` prints the coverage of `src/lib`.
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
3. `.github/workflows/android-release.yml` checks that the tag matches `version` in `package.json`, then tests, builds, signs and publishes `headlog-X.Y.Z.apk`. Obtainium picks it up.

`versionCode` is `major*10000 + minor*100 + patch` and must grow with every release. The signing key is a repository secret; the owner keeps the keystore outside the repository. Android only installs updates signed with the same key, so never change the signing setup.
