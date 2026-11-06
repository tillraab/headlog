# Changelog

## [Unreleased]

## [0.21.0] - 2026-11-06

### Changed

- The evening warning is about tomorrow only. It counts a pressure drop tomorrow, too little to drink today (under three quarters of the goal) and alcohol today. Last night's sleep and today's caffeine no longer trigger it. The notification names the reasons, for example "pressure drop tomorrow, alcohol today".

## [0.20.6] - 2026-11-06

### Fixed

- A long press on a label no longer selects text and leaves a Copy / Share bar on screen. Text fields stay selectable.

## [0.20.5] - 2026-11-06

### Fixed

- In My medication and My drinks, a change to one field could be lost when you went straight on to another control, for example typing 500 ml and then tapping an icon. Each change now saves only its own field.

## [0.20.4] - 2026-11-06

### Fixed

- The sleep editor's time fields cut off 12-hour times ("11:01 PM" showed as "11:01 PI"). The sleep duration now sits on its own line above them, so each field has half the width.

## [0.20.3] - 2026-11-06

### Fixed

- Caffeine in the forecast stayed grey for new users: days before the first logged drink counted as 0 mg, so the usual amount looked too low. It now averages only the days since you started logging. Caffeine is checked from 10:00 instead of noon.

## [0.20.2] - 2026-11-06

### Changed

- Confirming last night removes the sleep card from Today. To edit the night later, open the forecast (the circle next to the date) and tap the sleep tile.

## [0.20.1] - 2026-11-06

### Changed

- The sleep editor lists the wake breaks below the timeline; tapping one opens its magnified bar, so short breaks next to falling asleep or waking up are easy to reach. The magnified bar shows 45 minutes around the break instead of 90, so the edges of short breaks sit further apart.

## [0.20.0] - 2026-11-06

### Added

- Last night on Today: an estimated night waits there with "Looks right" and "Correct" until it is confirmed, then shrinks to one line. Without data it offers to enter the night.
- A morning notification (default 9:00, Settings → Sleep) asks whether last night's times are right, with the same two buttons.
- The sleep editor is a timeline from evening to noon: drag the dots to move falling asleep and waking up, tap a wake break to edit it on a magnified bar, add or remove wake breaks, and see when the screen was on. The sleep tile in the forecast opens it directly.

## [0.19.2] - 2026-11-06

### Changed

- The forecast is stricter: one unfavourable factor turns it yellow, two or more red. The evening notification therefore comes from one factor on.

## [0.19.1] - 2026-11-06

### Changed

- The Insights timelines run on into tomorrow when the weather forecast covers it: tomorrow is shaded, the air pressure line is dashed there, and tapping it shows the forecast.

## [0.19.0] - 2026-11-06

### Added

- Insights can show 3 and 7 days. For these, the timeline switches to hour by hour: headaches with their exact times and intensity, medication as ticks, hydration adding up through each day against the goal and the even pace towards it, sleep with wake breaks, and air pressure. Tapping shows that moment and what happened within half an hour.

### Changed

- The forecast next to the date is a large coloured circle, pulsing when yellow or red.

## [0.18.2] - 2026-11-05

### Changed

- The forecast next to the date is a small traffic light instead of a dot, a bit larger than the one in the forecast card, which uses the same light.

## [0.18.1] - 2026-11-05

### Changed

- Today always shows "Forecast" next to the date with a green, yellow or red dot; tapping it opens the forecast and scrolls to it. The headache-free count moves below the date.

## [0.18.0] - 2026-11-05

### Changed

- One calendar instead of two: the Calendar tab shows each medication as a dot in its colour (grey when it does not count for the 10/20 rule), the hydration goal as a blue line, and a legend of your medication. The day view says for each intake whether it counts. The 30-day grid in the Meds tab is replaced by a button to the calendar.

## [0.17.0] - 2026-11-05

### Added

- Doctor report, after the overview page: possible triggers (pressure drop, hydration, sleep, alcohol and caffeine on headache days against other days, and how many headaches each factor came with, plus the noted symptoms and triggers), then a table with a row for every headache – date, time and duration, intensity, medication with time and whether it helped, possible triggers of that day and the note – and for every intake without a headache.

## [0.16.0] - 2026-11-05

### Added

- Medication classes follow ICHD-3: new classes ergotamine (overuse from 10 days a month) and against nausea (not counted). Each class explains itself with examples in the medication list, and known active ingredients and brands set the class automatically when you name a medication, including combinations such as "ASS + Paracetamol + Coffein".
- Overuse limits in the Meds tab: days per class this month against the ICHD-3 limits, plus the rule for several classes together (10 days), with an explanation of what medication-overuse headache means.

### Changed

- Meds tab, last 30 days: a calendar with weekdays and month labels, a coloured dot per medication, a legend of what counts for the 10/20 rule, and tap a day to see what you took and whether it counts.
- Calendar: instead of the overview of the last 12 months, a chart of headache days in the last 30 days, rolling, with a line at 15 days, from which ICHD-3 speaks of chronic headache. Tap a day for its count.
- Pressure drops follow the measure of the study they come from (Kimoto et al. 2011): the daily mean pressure against the day before, unfavourable at more than 5 hPa. Before, HeadLog took the largest fall within any 24 hours and 6 hPa. Weather stored so far is fetched again once.

## [0.15.1] - 2026-11-05

### Fixed

- After switching the period in Insights, a day selected before stayed in the detail box and the cursor sat in the wrong place. The selection now follows the date: it stays if the day is in the new period and clears otherwise.

## [0.15.0] - 2026-11-05

### Changed

- The opened forecast explains itself: how the light is made, and for every factor its status (fine, unfavourable, no data), a "why" sentence with your numbers and the rule with its thresholds.

### Fixed

- The detail box above the Insights charts keeps its height, so the charts no longer jump while you move through the days.

## [0.14.1] - 2026-11-05

### Fixed

- The forecast showed hydration as unfavourable on the first day of tracking, because the day before counted as a day without drinking. Days before your first logged drink are now unknown, also in the Insights timeline and its average.
- Hydration in the forecast is favourable once today's goal is reached, even if yesterday was low.

## [0.14.0] - 2026-11-05

### Changed

- Charts in Insights and the 10/20 trend have a time axis with dates and gridlines, and value labels on the left.
- Tap or drag across a chart to see a day: a line runs through all charts, and a box shows the date, headache, hydration, sleep, pressure, headache times, medication and the pressure drop. Dragging on a chart no longer switches tabs.

## [0.13.0] - 2026-11-05

### Changed

- When the forecast is not green, a marker at the top of Today says so; tapping it opens the forecast.
- No more estimated chances in percent: the forecast counts unfavourable factors and shows your numbers. The evening notification follows the same traffic light and names the unfavourable factors.

## [0.12.0] - 2026-11-05

### Added

- Forecast on Today: a traffic light for the headache risk with tiles for weather, hydration and sleep. Weather (pressure drop today or tomorrow), hydration (yesterday, or behind today's pace), sleep (under 6 h), alcohol and caffeine each count when unfavourable: green up to one, yellow with two, red with three or more. Tap for the exact numbers, wake breaks, your sleep average, alcohol and caffeine, your personal estimate and a tip.

### Changed

- The forecast replaces the sleep card and the separate risk warnings on Today.
- The medication badge on Today is shorter and stays on one line.

## [0.11.0] - 2026-11-05

### Added

- Welcome card on Today until the first entry: set up medication, drinks and hydration goal, and the optional extras, with a pointer to the demo data.
- Meds tab: how well each medication works (relief ratings of the last 90 days as a bar), the last eight intakes with their rating, tap to edit or rate, and a button to edit your medication.
- Pencil buttons on the hydration and medication cards of Today open the drink and medication lists directly.

### Changed

- The hydration goal sits with your drinks.
- Your medication and drink lists open as their own panels from Today, Meds and Settings, instead of filling the top of Settings.
- Insights is grouped into Overview, Connections, Hydration and Patterns. The report button opens a sheet with name, period and PDF or CSV; the doctor section left Settings. How well medication works moved to the Meds tab.
- Today: risk warnings take one line each and open on tap; last night's sleep comes after medication; during a headache, medication comes before hydration; the hydration streak shows from the first day.

## [0.10.0] - 2026-11-05

### Added

- Demo data shows every part of the app: links between headaches and pressure drops, short nights, little to drink and wine, caffeine, sleep with wake breaks, a hydration streak, a personal medication limit, notes, an open "did it help?" question and a pressure drop forecast for tomorrow, so the risk warnings appear.
- Headache risk for today and tomorrow, learned from your own data: for each factor (pressure drop, little to drink the day before, short night, alcohol, less caffeine than usual) HeadLog compares how often a headache started with and without it. Today shows a warning with the estimated chance (the headache rate on days with the strongest active factor, a little higher for each further one), the usual chance, the reasons and a tip. An evening notification (20:00 by default, adjustable or off) warns when tomorrow looks risky.

### Changed

- The pressure drop hint on Today is part of the new risk warning.

## [0.9.0] - 2026-11-05

### Added

- Insights timeline: headaches, hydration, sleep and air pressure as charts on one time axis, with headache days marked as red bands through all of them.
- Insights comparison: hydration, caffeine and alcohol the day before, sleep the night before and pressure drops on the day, for days a headache started against days without headache.
- Demo data includes sleep and weather.

### Changed

- Insights shows average sleep among the key figures; the separate hydration comparison is part of the new comparison.
- Deleting all data also deletes the stored weather.
- The Meds tab comes second, before Calendar.

## [0.8.0] - 2026-11-05

### Added

- Each headache in the calendar's day view shows how much you drank in the 72 hours before it, compared with what is usual for you.
- Sleep estimate from screen activity (Android 9+, needs usage access): the night is the longest screen-off stretch, joined across wake breaks of up to 90 minutes, which are listed and left out of the sleep time. Today shows last night, the calendar's day view each night, Insights the average. Every night can be corrected by hand. Backups include the nights.
- Weather: choose your home town in Settings, and HeadLog stores the weather of every day since your first entry from Open-Meteo: air pressure and its largest 24-hour drop, temperatures, humidity and rain. The calendar's day view shows it, and Today warns when the pressure falls by 6 hPa or more today or tomorrow. Only the town's coordinates are sent.
- Caffeine and alcohol: each drink in My drinks can have a caffeine amount and be marked as alcoholic. Today shows the caffeine of the day, Insights the average caffeine and the days with alcohol. Alcoholic drinks do not count toward the hydration goal. Coffee (80 mg) and tea (40 mg) get their caffeine automatically, including drinks already logged.
- Hydration goal streak: 🔥 days in a row on Today, current and best streak in Insights, and a small celebration with confetti when you reach the goal, with milestones at 3, 7, 14, 21, 30, 50 and 100 days.

### Changed

- Tapping a notification or one of its buttons always opens Today, not the screen the app was left on.

## [0.7.0] - 2026-11-05

### Added

- Insights has a button for the doctor report, covering the period selected there.

### Changed

- The doctor report fits on one page and looks new: app logo, key figures including hydration, the headache calendar, charts of headache and medication days per month and of the 10/20 rule over time, medication with how often it helped and personal limits, and the most common triggers. The list of every headache moved out; the CSV export still has every entry.
- Drink check-ins list what you logged since the previous check-in (expand the notification to see time and amount of the last three), or say that nothing was logged.

## [0.6.1] - 2026-11-05

### Changed

- Drink check-ins name your last drink: "What did you drink since 10:20?", or "Last drink: yesterday 21:30" for the first check-in of the day.

## [0.6.0] - 2026-11-05

### Added

- Restore an earlier state of the Gist backup: every backup is kept as a version, listed by day and time, with a preview of what it contains.
- Drink check-ins at times you choose ("What did you drink?"), with your first three drinks as buttons in the notification to log one without opening the app. Skipped when you logged a drink in the hour before.

### Changed

- Today shows hydration above medication.
- "Water" is now called "Hydration" (German "Trinken"), since coffee and tea count too.
- Switching the language also renames the default drinks (Glass, Bottle, Coffee, Tea) unless you renamed them yourself.

### Fixed

- Switching on hydration reminders or check-ins could silently fail to save on Android while the switch looked on.

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
