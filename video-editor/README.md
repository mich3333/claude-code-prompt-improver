# ClipCraft — desktop video editor

A desktop video editor (Electron + React + Motion, with FFmpeg for export) with a Hebrew, right-to-left interface, for putting together a video from your clips and photos, with text, music, color filters, transitions and speed changes. FFmpeg is bundled, so there's nothing else to install.

## Features

- **Cut and join**: import videos and photos, drag to reorder, trim by dragging clip edges (or set start/end at the playhead), and split at the playhead.
- **Split screen**: put a photo or video on a layer above the main video, in the top or bottom part of the frame or full frame, with a soft blended edge between the halves.
- **Automatic captions**: transcribes the speech in your clips with ElevenLabs Scribe and adds short, punchy captions (1–4 words each) timed to the words.
- **Text and captions**: multi-line titles with full Hebrew/RTL support, 5 fonts, size, color, bold, shadow/outline/box styles, and fade in/out. Drag text directly on the preview to position it.
- **Music and audio**: a background music track with volume, start point, "skip intro", loop, and fade in/out. Each clip has its own volume and mute.
- **Filters**: 8 color presets (B&W, Sepia, Vintage, Vivid, Dramatic, Faded, Cool) plus brightness, contrast and saturation.
- **Transitions**: crossfade, fade through black/white, wipe, slide, and circle open.
- **Speed**: 0.25× to 4×. Audio keeps its pitch.
- **Frame size**: choose 16:9, 9:16 (Reels/TikTok/Shorts), 1:1 or 4:5 for each project. Each clip can be set to *Fit* (black bars) or *Fill* (crop).
- **Export**: MP4 (H.264 + AAC) at 720p–4K, 24/25/30/60 fps, three quality levels, with progress, a time estimate, and cancel.
- Undo/redo, saving and opening projects (`.clipcraft`), drag-and-drop import, and keyboard shortcuts.

The preview is drawn by the same rules the export uses, so what you see is what you get. Text is rendered by the editor itself and passed to FFmpeg as images, and color filters use the same math in the preview (CSS) and the export (FFmpeg); a test checks they agree within 3/255.

## Run it

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
cd video-editor
npm install
npm start        # builds the UI and opens the app
npm run dev      # development: hot reload while you edit the UI
```

### Build an installer

```bash
npm run dist
```

This builds for the OS you run it on: `.dmg` on macOS, an `.exe` installer on Windows, `.AppImage` on Linux. The output goes to `dist/`.

## How to make a video

1. **ייבוא מדיה** (Import media): click it or drop files into the window. Clips are added to the timeline in order.
2. Click a clip on the timeline to edit it in the settings panel (on the left): trim, speed, color, volume, and the transition from the previous clip.
3. **הוספת טקסט** (Add text) puts a title at the playhead. Type it in the settings panel and drag it on the preview to move it.
4. **הוספת מוזיקה** (Add music) sets the background track. Click the green bar to change volume, start point and fades.
5. Pick the **מסגרת** (Frame) size at the top, then **ייצוא** (Export).

## Split screen

For the "graphic on top, talking head below" look common in vertical videos:

1. Put your talking-head video on the main video track. Frame it so your face sits in the lower half.
2. Add the graphic (a photo, screen recording or chart animation) as a layer: click the layers button next to it in the media library (it is placed at the playhead), or drag it onto the **שכבה עליונה** (Overlay) track at the time you want.
3. In the settings panel, choose **למעלה / למטה / מסך מלא** (top / bottom / full frame), the height of the area (30–70%), and how soft the edge between the halves is.
4. Drag the layer on the timeline to move it, or drag its edges to trim it. Layers are muted by default, so your voice from the main track carries on; turn on "include sound" if you need the layer's audio.

Layers can overlap: later layers are drawn on top. Each layer fades in and out over a quarter of a second (you can turn this off).

A layer can be a transparent video: a VP8/VP9 WebM with an alpha channel (for example word-highlight captions or a cut-out presenter rendered by Remotion) keeps its transparency in the preview and in the export, where it is decoded with libvpx (FFmpeg's built-in VP9 decoder would drop the alpha).

The interface is in Hebrew and laid out right to left. The timeline and the playback controls stay left to right, because time runs that way in every video editor. Keyboard shortcuts use physical keys, so they work on a Hebrew keyboard layout too.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Play / pause |
| S | Split clip at playhead |
| T | Add text at playhead |
| Delete | Remove selected item |
| ← / → | Step one frame (Shift: one second) |
| Home / End | Go to start / end |
| Ctrl+Z / Ctrl+Y (⌘Z / ⌘⇧Z) | Undo / redo |
| Ctrl+S, Ctrl+O, Ctrl+I, Ctrl+M, Ctrl+E | Save, open, import, music, export |
| Ctrl + mouse wheel | Zoom timeline |

## Automatic captions

**כתוביות** (Captions) in the toolbar turns the speech in your video into short captions, timed to each word, in the Reels/TikTok style.

1. Put the video where you talk on the video track (muted clips and clips without sound are skipped).
2. Click **כתוביות** and paste an [ElevenLabs](https://elevenlabs.io) API key (account settings → API Keys). Tick "remember" to keep it on this computer; it is encrypted with the operating system's keychain and never leaves the app's main process.
3. Choose the language (or automatic detection), how many words per caption (1–4), and where they go: top, middle or bottom. With a split screen, the middle (the seam between the halves) is the default.
4. Click **יצירת כתוביות**. The sound of each clip is sent to ElevenLabs Scribe, and the captions are added to the text track as one undo step.

Each caption is a normal text item: fix a word, move it, or change its timing. Style one caption and click **החלת המראה על כולן** (apply to all) to restyle all of them. Running it again replaces the previous captions.

Transcription is billed by ElevenLabs per minute of audio, and the audio is sent to their servers. Captions are exported efficiently: still texts share a few FFmpeg inputs instead of one input each, so long videos with many captions export quickly.

## Black-and-gold templates

The **תבניות** (Templates) tab opens with a black-and-gold set for vertical "explainer" videos: the graphic sits in the top half and you talk in the bottom half.

| Template | What it adds |
| --- | --- |
| מספר גדול (big number) | A gold number that counts up ($2T, ×7, 3,830 ₪), with a small title and an optional year strip |
| גרף עמודות (bar chart) | Gold bars that grow one after another, with values and labels (one `label: value` line per bar) |
| ציר שנים (year timeline) | A big year and a timeline whose gold dot slides to it |
| כתוביות אדומות (red captions) | Turns the captions red and puts them on the seam between the halves, and makes this the default look for new captions |

Each graphic is drawn by the editor and saved as a short video in the app's data folder, then placed at the playhead as a split-screen layer. Select it to edit the title, the number or the bars, and click **עדכון הגרפיקה** (update); its timing and placement stay as they are.

## Get the app

Ready-made installers are built by GitHub Actions on every push and published as the **ClipCraft (latest build)** pre-release under the repository's Releases:

- **Mac (Apple Silicon)**: `ClipCraft-…-mac-arm64.dmg`. Open it and drag ClipCraft to Applications. The app is not notarized by Apple, so the first time macOS blocks it: open **System Settings → Privacy & Security** and click **Open Anyway** (or right-click the app → Open). If macOS says the app "is damaged", run `xattr -cr /Applications/ClipCraft.app` in Terminal once.
- **Windows**: `ClipCraft-…-win-x64.exe`. If SmartScreen warns, click **More info → Run anyway**.
- **Linux**: `ClipCraft-…-linux-x86_64.AppImage`. Make it executable and run it.

## Claude-style templates

The **תבניות** (Templates) tab next to the media library adds ready-made pieces in a Claude-inspired style: warm cream and charcoal backgrounds, a terracotta accent, an editorial serif (Frank Ruhl Libre) with Rubik for supporting text, and calm motion. Titles rise gently into place, and scenes dissolve into each other. The style is imitated only; no logos or brand marks are included.

| Template | What it adds |
| --- | --- |
| פתיח בהיר / פתיח כהה (light / dark intro) | A cream or charcoal title card at the start, with a title and a subtitle that arrive one after the other |
| ציטוט (quote) | A terracotta card with a quote, after the clip under the playhead |
| כותרת תחתונה (lower third) | A "name · role" label over the video at the playhead |
| סיום (outro) | A "thanks for watching" card at the end |
| צבע חם (warm grade) | A soft, warm colour grade on every video and photo |

Inserting a card moves the texts and music that come after it, so they stay in sync with their clips. Templates are a single undo step. The fonts ship with the app, so text looks the same on every computer and in the exported video.

## Motion and interaction design

The UI follows Emil Kowalski's design-engineering guidelines. The tokens live in `src/renderer/motion.js` and `styles.css`.

- **Fast and purposeful:** UI motion lasts 150–250ms with a strong ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`), and exits are quicker than entrances. Nothing uses ease-in.
- **No motion for frequent actions:** selecting, scrubbing, trimming, dragging and keyboard shortcuts are instant, and dragging follows the pointer 1:1. Animating things people do hundreds of times a day only slows them down.
- **Motion that explains change:** after a clip is dropped in a new spot, its neighbours glide to their new places. The segmented controls' active pill slides between options (a bounce-free spring, so it can be interrupted).
- **Physical feedback:** buttons scale to 0.97 while pressed. Hover styles apply only on devices with a real pointer (`@media (hover: hover)`).
- **Entering elements:** the export dialog enters from scale 0.96 (never from 0) and fades in. Toasts slide up from below and restack smoothly, like Sonner. The play/pause icon cross-fades with a slight scale and blur.
- **Performance:** only `transform` and `opacity` are animated. For example, the export progress bar uses `scaleX`, not `width`.
- **Accessibility:** `MotionConfig reducedMotion="user"` and a CSS `prefers-reduced-motion` rule drop transform motion for people who turned it off in their OS.

## Tests

```bash
npm test                      # unit tests: timeline math, FFmpeg command builder, effects
npm run test:export           # renders real videos with FFmpeg and checks them with FFprobe
xvfb-run -a npm run test:e2e  # builds the UI and drives the real app (Linux; drop xvfb-run elsewhere)
```

## Project layout

```
main.js                 Electron main process: window, menus, dialogs, export jobs, media:// file server
preload.cjs             safe bridge exposed to the UI as window.api
vite.config.js          builds the React UI into build/renderer (scripts/dev.mjs runs it with hot reload)
src/shared/             pure logic shared by UI and export
  templates.js          the Claude-style templates (palette, cards, texts)
  timeline.js           project model, layout, transitions, split
  effects.js            color presets → CSS filters (preview) and FFmpeg filters (export)
  ffmpeg.js             builds the FFmpeg filter graph for a project
  captions.js           automatic captions: what to transcribe, word timing, short caption grouping
  graphics.js           black-and-gold graphics: types, defaults, count-up and bar parsing
src/main/media.js       runs FFprobe/FFmpeg (probe, thumbnails, audio extraction, export with progress)
src/main/scribe.js      ElevenLabs Scribe speech-to-text client
src/renderer/           the editor UI in React
  components/           App, Timeline, Inspector, Preview, MediaBin, ExportDialog, Toaster
  state.js              store/player singletons and their React hooks
  player.js             canvas preview engine (the same compositing rules as the export)
  graphics.js           draws the black-and-gold graphics frame by frame
  motion.js             motion tokens (easing curves, durations)
test/                   unit, export and UI tests
```

## Known limitations

- The preview uses Chromium's video decoders. HEVC/H.265 (some iPhone videos) previews only where the OS supports it (macOS, most Windows PCs). Export always works because it uses FFmpeg.
- One music track, one main video track, one overlay track, and a text track. Overlays always span the full frame width.

---

## התחלה מהירה (עברית)

1. התקינו [Node.js](https://nodejs.org) (גרסה 18 ומעלה).
2. בטרמינל: `cd video-editor`, אחר כך `npm install`, ואז `npm start`. לפיתוח עם רענון אוטומטי: `npm run dev`.
3. לחצו על **ייבוא מדיה** (או גררו קבצים לחלון), ערכו על ציר הזמן, והוסיפו טקסט (**הוספת טקסט**) ומוזיקה (**הוספת מוזיקה**).
   בלשונית **תבניות** יש פתיח, ציטוט, כותרת תחתונה, סיום וצבע חם בסגנון Claude. לחיצה אחת מוסיפה אותם.
   **שחור וזהב**: בלשונית **תבניות** יש מספר גדול, גרף עמודות, ציר שנים וכתוביות אדומות, בסגנון סרטוני ההסבר האנכיים: הגרפיקה למעלה, אתם למטה. את התוכן עורכים בפאנל ההגדרות.
   **כתוביות אוטומטיות**: לחצו על **כתוביות**, הדביקו מפתח API של ElevenLabs, ובחרו שפה, כמה מילים בכל כתובית ומיקום. הדיבור מתומלל והכתוביות נוספות למסלול הטקסט, כל אחת בזמן שבו אומרים אותה.
   **מסך מפוצל**: שימו את הסרטון שלכם (עם הפנים) במסלול הווידאו, ואת הגרפיקה הוסיפו כשכבה עליונה בכפתור השכבות שליד הקובץ בספריית המדיה. בפאנל ההגדרות בוחרים למעלה / למטה / מסך מלא, את הגובה ואת ריכוך הקצה.
4. בחרו גודל **מסגרת** ולחצו על **ייצוא** כדי לשמור את הסרטון כ-MP4.

ליצירת קובץ התקנה למחשב שלכם: `npm run dist`.
