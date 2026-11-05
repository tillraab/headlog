# Changelog

## [Unreleased]

## [0.5.0] - 2026-11-05

### Added

- Personal medication limits take any number of days in any window, for example at most 5 days in 30 or 2 days in 7.
- The question whether a medication helped can come after 30 minutes up to 4 hours, or be switched off.
- The doctor export offers PDF or CSV for the chosen period.

### Changed

- Settings: doctor export and backup file each have their own section with buttons side by side. Demo data and deleting all data are folded away under Advanced.

### Fixed

- Deleting all data or loading demo data no longer overwrites the Gist backup when leaving the app. Automatic backup pauses until you back up or restore manually, and an empty diary is never uploaded automatically.

## [0.4.0] - 2026-11-05

### Added

- While a headache is ongoing, a notification every few hours asks whether it is still there, with Still there / Gone buttons. Gone ends the headache. Every 1, 2, 3 (default), 4 or 6 hours, or off.

### Fixed

- Today no longer says "No headache today" after a headache that ended today.
- A reminder plan made just before a change could be scheduled after it, leaving stale notifications.

## [0.3.1] - 2026-11-05

### Changed

- New app icon: a brain in sagittal view with a lightning bolt.

## [0.3.0] - 2026-11-05

### Added

- Doctor report as PDF: key figures, a headache calendar per month, monthly overview, medication with relief ratings and personal limits, triggers, and a list of all headaches. Choose 1, 3, 6 or 12 months and an optional name.
- Personal limit per medication, for example at most 5 days with a triptan in any 30 days. Shown on the medication button, in the Meds tab and in the report.
- Notification one hour after taking medication asking whether it helped, with No / A bit / Yes buttons.
- Water reminders: at noon when less than half the daily goal is reached, in the evening when the goal is not reached. Times are adjustable.

### Changed

- Removed the extra "+ Medication" button from today's log. Past intakes can be added from the calendar.

## [0.2.0] - 2026-11-05

### Added

- Optional cloud backup to a secret GitHub Gist, updated whenever you leave the app, with restore on a new phone.
- Today asks whether a medication helped, from 45 minutes after taking it.
- The calendar shows the last 12 months at a glance, with headache intensity and medication days.

## [0.1.0] - 2026-11-05

### Added

- One-tap headache logging with live duration, intensity from 1 to 10, symptom and trigger tags and a note.
- Medication quick buttons from your own list, with dose, type and color. Rate afterwards whether it helped.
- Water tracker with your own drink buttons (glass, bottle, coffee, ...) and a daily goal.
- Calendar with headache days shaded by intensity, medication and water-goal markers, and a day view to add or edit entries.
- 10/20 rule tracker: medication days in the last 30 days, what taking something today would mean, when the next day drops out, a 90-day trend and monthly overuse thresholds by medication type.
- Insights over 30, 90 or 365 days: headache and medication days per month, weekday and time-of-day patterns, water before headache days versus clear days, medication relief and the most common triggers.
- Swipeable tabs, light and dark theme, English and German.
- JSON backup and restore, CSV export for your doctor, demo data.
