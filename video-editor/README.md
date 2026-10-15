# ClipCraft — desktop video editor

A desktop video editor (Electron + React + Motion, with FFmpeg for export) for putting together a video from your clips and photos, with text, music, color filters, transitions and speed changes. FFmpeg is bundled, so there's nothing else to install.

## Features

- **Cut and join**: import videos and photos, drag to reorder, trim by dragging clip edges (or set start/end at the playhead), and split at the playhead.
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

1. **Import media**: click it or drop files into the window. Clips are added to the timeline in order.
2. Click a clip on the timeline to edit it in the right panel: trim, speed, color, volume, and the transition from the previous clip.
3. **Add text** puts a title at the playhead. Type it in the right panel and drag it on the preview to move it.
4. **Add music** sets the background track. Click the green bar to change volume, start point and fades.
5. Pick the **Frame** size (top right), then **Export**.

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
  timeline.js           project model, layout, transitions, split
  effects.js            color presets → CSS filters (preview) and FFmpeg filters (export)
  ffmpeg.js             builds the FFmpeg filter graph for a project
src/main/media.js       runs FFprobe/FFmpeg (probe, thumbnails, export with progress)
src/renderer/           the editor UI in React
  components/           App, Timeline, Inspector, Preview, MediaBin, ExportDialog, Toaster
  state.js              store/player singletons and their React hooks
  player.js             canvas preview engine (the same compositing rules as the export)
  motion.js             motion tokens (easing curves, durations)
test/                   unit, export and UI tests
```

## Known limitations

- The preview uses Chromium's video decoders. HEVC/H.265 (some iPhone videos) previews only where the OS supports it (macOS, most Windows PCs). Export always works because it uses FFmpeg.
- One music track, one video track, and a text track.

---

## התחלה מהירה (עברית)

1. התקינו [Node.js](https://nodejs.org) (גרסה 18 ומעלה).
2. בטרמינל: `cd video-editor`, אחר כך `npm install`, ואז `npm start`. לפיתוח עם רענון אוטומטי: `npm run dev`.
3. לחצו **Import media** (או גררו קבצים לחלון), ערכו על ציר הזמן, הוסיפו טקסט (**Add text**) ומוזיקה (**Add music**).
4. בחרו גודל מסגרת (**Frame**) ולחצו **Export** כדי לשמור את הסרטון כ-MP4.

ליצירת קובץ התקנה למחשב שלכם: `npm run dist`.
