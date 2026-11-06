<h1 align="center">HeadLog</h1>

<p align="center">
  <em>A one-tap headache, medication and water diary for Android. Tap when a headache starts, tap what you took, tap what you drank. HeadLog keeps an eye on the 10/20 rule and shows you patterns. English and German. No account, no server: all data stays on your phone.</em>
</p>

<p align="center">
  <img src="docs/screenshots/today.png" alt="Today" width="200">
  <img src="docs/screenshots/meds.png" alt="10/20 rule" width="200">
  <img src="docs/screenshots/calendar.png" alt="Calendar" width="200">
  <img src="docs/screenshots/insights-dark.png" alt="Insights, dark theme" width="200">
</p>

<p align="center"><a href="https://github.com/tillraab/headlog/releases/latest">Download the latest APK</a></p>

## Features

- **One tap when it starts.** A big button starts a headache with the current time. A live timer runs until you tap "Headache is gone". Intensity (1 to 10), symptoms and triggers (nausea, aura, stress, poor sleep, ...) and a note are optional and can be added any time.
- **Your medication as buttons.** Define your own list with name, dose, type (pain reliever, triptan, combination, opioid, preventive, other) and color. One tap logs an intake. Afterwards you can rate whether it helped.
- **Hydration.** Your own drink buttons (glass 250 ml, bottle 700 ml, coffee, tea, ...) and a daily goal with a progress bar, right at the top of Today.
- **Calendar.** Headache days shaded by intensity, dots for medication days and days you hit your water goal. Tap a day to see, edit or add entries after the fact.
- **10/20 rule.** Take acute headache medication on at most 10 out of any 30 days, so at least 20 stay free. HeadLog shows your current count, what taking something today would mean, when the next medication day drops out of the window, a 90-day rolling trend, and the monthly overuse thresholds per medication type (ICHD-3). Preventive medication doesn't count. The limit is configurable.
- **Forecast traffic light** on Today: weather (pressure forecast), hydration and last night's sleep as tiles, plus alcohol and caffeine. Green with no unfavourable factor, yellow with one, red with two or more. A coloured circle next to the date always shows it. Tap for every number and a tip. An evening notification warns when the forecast is not green.
- **Weather and sleep:** daily weather at your home town (Open-Meteo, only the town's coordinates are sent) and a sleep estimate from screen activity, with wake breaks.
- **Insights** over 30, 90 or 365 days: a timeline of headaches, hydration, sleep and air pressure with headache days marked, a comparison of headache days with other days, headache and medication days per month, average duration and intensity, which weekdays and times of day headaches start, how much you drank the day before a headache compared to the day before a clear day, how well each medication helped, and your most common triggers.
- **Doctor report (PDF)** on one page for 1 to 12 months, from Insights or Settings: key figures, a headache calendar, charts of headache and medication days per month and of the 10/20 rule over time, medication with how often it helped and your limits, and the most common triggers. CSV with every entry for the same period.
- **Personal limits per medication**, e.g. at most 5 triptan days in any 30 days, shown on the button, in the Meds tab and in the report.
- **Reminders:** a notification one hour after taking medication asking whether it helped (answer right in the notification), reminders at noon and in the evening if you are behind your hydration goal, and check-ins at times you choose that list what you logged since the last one and let you log a drink straight from the notification.
- **Undo instead of "are you sure?"** Every quick action shows an undo button.
- **Backup** as a JSON file and **CSV export** for your doctor, both through the Android share sheet.
- **Optional cloud backup** to a secret gist in your GitHub account, updated whenever you leave the app. Every backup is kept as a version, so you can go back to any earlier state by date and time.
- Swipeable tabs, light and dark theme, haptic feedback, Android back button support.

## Install on your phone

HeadLog is not in the Play Store. You install the APK from the GitHub releases, either directly or through Obtainium, which also keeps it updated.

### Option A: Obtainium (recommended, gets updates automatically)

[Obtainium](https://obtainium.imranr.dev/) watches GitHub releases and installs new versions.

1. On your phone, open <https://github.com/ImranR98/Obtainium/releases/latest>, download the APK that ends in `arm64-v8a.apk` (or the universal one) and install it. Android asks once to allow installing apps from your browser: allow it.
2. Open Obtainium, tap **Add App**, enter `https://github.com/tillraab/headlog` and tap **Add**.
3. Tap **Install**. Android asks once to allow Obtainium to install apps: allow it.

Obtainium checks for updates in the background and notifies you when a new release is out.

### Option B: download the APK directly

1. On your phone, open <https://github.com/tillraab/headlog/releases/latest>.
2. Under **Assets**, tap `headlog-<version>.apk`.
3. Open the downloaded file and allow your browser to install apps when asked.

Updates work the same way: install the newer APK over the old one. Your data stays.

### First steps

1. Open **Settings** (gear icon, top right). Edit **My medication** to match what you take, and **My drinks** to match your glasses and bottles. Set your daily water goal.
2. Try **Load demo data** (Settings → Advanced) to see every screen with 90 days of data, including a risk warning. **Delete all data** clears it again.
3. The data lives only on your phone, so uninstalling the app deletes it. Either export a JSON backup now and then (Settings → Data), or turn on the Gist backup:
   1. On GitHub, open <https://github.com/settings/personal-access-tokens/new>, give the token a name and a long expiration, and under **Account permissions** set **Gists** to **Read and write**. Generate it and copy it.
   2. In HeadLog, Settings → Cloud backup, paste the token and tap **Connect**.
   3. The backup lives in a secret gist named "HeadLog backup", visible under your GitHub profile → Gists.

## Development

Requires [Bun](https://bun.sh). For the APK also JDK 21 and the Android SDK.

```bash
bun install
bun run dev      # dev server in the browser
bun run check    # type check
bun run test     # unit tests
```

Project layout, data model, notification and release rules for contributors (human or AI agent) are in [CLAUDE.md](CLAUDE.md). The app icon is drawn in [assets/icon.svg](assets/icon.svg); `bun run icons` renders the favicon and all Android icon sizes from it.

Build the APK locally:

```bash
bun run build
bunx cap sync android
cd android && ./gradlew assembleRelease
```

### Releasing

Add the changes under a new version heading in [CHANGELOG.md](CHANGELOG.md), bump `version` in `package.json`, commit, then push a tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The [Android Release](.github/workflows/android-release.yml) workflow tests, builds and signs the APK and publishes it as a GitHub release with the changelog section as release notes. Obtainium picks it up from there.

Signing uses the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Android only installs an update when it is signed with the same key, so keep a copy of the keystore somewhere safe.

## Tech stack

SvelteKit 2 and Svelte 5 (static adapter), Tailwind CSS 4, Dexie (IndexedDB), date-fns, Lucide icons, and Capacitor 8 for the Android app. The project layout and release workflow follow [PunchClock](https://github.com/Spenhouet/punch-clock).

## Disclaimer

HeadLog is a diary, not a medical device. The 10/20 rule and the overuse thresholds are guidance. Talk to your doctor about your headaches and medication.

## License

[MIT](LICENSE)
