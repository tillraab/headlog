# HeadLog videos

| File | Content | Format |
|---|---|---|
| `HeadLog-teaser.en.mp4` | Teaser, about 47 s | 1920 x 1080 |
| `HeadLog-teaser.en-portrait.mp4` | The same teaser for phones: intro as text, then the phone full height | 1080 x 1920 |
| `HeadLog-guide.en.mp4` | Guide, about 4:40: a look around with demo data, making it your own, installing with Obtainium | 1280 x 720 |
| `*.srt` | Subtitles. They are also burned into the picture. | |

The guide is stored at 720p because GitHub does not accept files over 100 MB.

## How they were made

Every phone screen in the videos is a screen recording of the real app (v0.20.6 to v0.21.0) on an Android emulator, not a mock-up. The notifications are real ones, triggered by moving the emulator's clock.

1. **Narration.** The script is a Markdown file with one `[beat]` line per section, for example `[forecast] A traffic light shows your headache risk for today…`. Each beat is spoken by the local text-to-speech model Kokoro (voice `af_heart`). The result is one WAV file plus a JSON file with the start time of every beat and every sentence. The sentences become the subtitles.
2. **Recording.** A Node script drives the emulator over `adb`: it taps, types, scrolls, sets the clock and records each step with `screenrecord` as its own clip (install, demo data, a headache episode, the sleep editor, the notifications, setup and so on). The display runs at 720 x 1600 so the software renderer reaches about 20 frames per second. Where the WebView does not expose its buttons to `uiautomator`, the script taps positions measured from screenshots.
3. **Frames.** Each clip is decoded with GStreamer into JPEG frames at 25 fps.
4. **Composition.** An HTML page draws one video frame for a given time `t`: the background, a phone frame with the footage, the beat title and the subtitle. A scene list gives, for each beat, which clips and which seconds play, and optionally a zoom on part of the screen. Footage plays in real time and at most 1.25 times faster when it does not fit the narration; a pacing check refuses to render otherwise.
5. **Rendering.** Playwright opens the page in Chromium at 1920 x 1080 (or 1080 x 1920 for the portrait teaser) and saves a screenshot for every frame, with four workers in parallel.
6. **Encoding.** GStreamer encodes the frames with x264 and the narration with AAC into an MP4, and writes the SRT file.

Each version was checked with contact sheets of the clips and of the rendered frames, and reviewed by independent passes for narration sync, visual glitches and whether a first-time viewer can follow it.

The recording scripts, scene lists and intermediate files are kept outside this repository. They depend on a local emulator and on large model files.
