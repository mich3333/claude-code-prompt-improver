# Building the reel in ClipCraft

ClipCraft is the user's Electron + React editor, in `video-editor/` of `mich3333/claude-code-prompt-improver`. Clone it if it is not in the session.

Set it up with `npm ci` in `video-editor/`, then build the UI with `npx vite build`. **Rebuild after every pull or change to `src/`**: the app runs the built bundle, and `build_reel.mjs` refuses to run on a stale one.

On a Mac or PC without a checkout, the installers from the repository's Releases contain the same editor, for opening and tweaking `.clipcraft` projects by hand.

## What the editor gives you

- **Main track:** the presenter video (with the narration as its audio).
- **Overlay track ("שכבה עליונה"):** layers on top.
  - Region: top/bottom (split screen with a feathered seam) or full frame (מסך מלא).
  - Layers can overlap; later layers are drawn on top.
  - **Transparent VP8/VP9 WebM** layers, for example Remotion captions, keep their alpha in the export.
- **Templates tab → black-and-gold:**
  - `gold-number`, `gold-bars`, `gold-year`: top-half graphics. `gold-quote`: a full-screen source card with the original quote or headline, a Hebrew translation, and who/where/URL.
  - Each graphic is rendered to a video of its own duration (`#graphic-duration`, 2–60 s) and edited in the layer panel ("עדכון הגרפיקה").
  - `gold-captions` restyles the captions red on the seam.
- **Captions (כתוביות):**
  - transcribes with ElevenLabs Scribe and adds 1–4-word captions;
  - looks: white or red; positions: top, middle or bottom.
- **Export:** MP4 H.264 + AAC; 1080p at quality 18 for posting.
- **Features arriving from other branches:**
  - slide-in/out entrances for layers (`animation`: `slideright`, `slideleft` or `slidebottom`);
  - "photo as presenter" framing (focus point, zoom, smooth Ken Burns);
  - an avatar/explainer style (free-position layers, white content cards, a wave background).
  - `build_reel` detects the layer animations by the presence of `src/shared/overlay-motion.js` and uses them; until they land, slides fall back to fades.

## Driving it automatically: `scripts/build_reel.mjs`

`make_reel.mjs` writes this spec for you. Use it directly only for an assembly-only job.

`build_reel.mjs` launches the real app with Playwright (`playwright-core` and Electron from the editor's `node_modules`) and does the whole assembly from a JSON spec:

```json
{
  "editorDir": "/path/to/video-editor",
  "presenter": "/abs/presenter-voice.mp4",
  "words": "/abs/words.json",
  "wordsOffset": 0,
  "animation": "none",
  "scenes": [
    { "type": "year", "start": 0, "end": 2.75, "label": "התחלתי לבנות ב-", "from": 2021, "to": 2026, "active": 2026 },
    { "type": "number", "start": 2.75, "end": 4.6, "label": "זמן עריכה לרילס", "value": "5 דק׳", "years": false },
    { "type": "bars", "start": 4.6, "end": 7.0, "label": "שעות עריכה בשבוע", "values": "לפני: 10\nאחרי: 2", "suffix": " ש׳" },
    { "type": "quote", "start": 7.0, "end": 10.0, "label": "לפי הדו\"ח", "who": "TechNews", "where": "אוקטובר 2026",
      "quote": "41% of new code is written with AI", "he": "41% מהקוד נכתב בעזרת AI", "url": "technews.example", "headline": true },
    { "type": "screenshot", "start": 10.0, "end": 13.0, "image": "/abs/card.png", "animation": "slideright" },
    { "type": "media", "start": 13.0, "end": 16.0, "file": "/abs/list.mp4", "region": "full" }
  ],
  "captions": { "engine": "clipcraft", "look": "red", "position": "middle", "words": 3, "language": "heb" },
  "project": "/abs/my-reel.clipcraft",
  "output": "/abs/my-reel.mp4"
}
```

Run it under a display: `xvfb-run -a node scripts/build_reel.mjs spec.json`. On a Mac or a desktop, plain `node` works.

It prints the captions it created and any page errors, saves `<output>-editor.png` and the `.clipcraft` project, and exports the MP4.

**Scenes.** Each non-`face` scene becomes one layer, trimmed to its scene. Template graphics are rendered at the scene's length, so they are never cut short. Bars clear the template's `$`/`B` defaults unless `prefix`/`suffix` are given.

**`words`.** Optional. When set, the script serves those Scribe-format words to the editor through a local stand-in (the `CLIPCRAFT_SCRIBE_URL` environment variable). The editor's own captions pipeline then runs even where the container cannot reach ElevenLabs. Without `words`, the captions dialog needs a real ElevenLabs API key typed by the user, so skip captions or ask.

**Caption placement.** Captions over a full-screen layer move to y 0.76, under the content, so they don't cover the list or screenshot. Change that with `captions.fullFrameY`.

## Checking the result

`make_reel` runs these checks itself (report and grid). By hand:

```bash
ffmpeg -i reel.mp4 2>&1 | grep -E "Duration|Stream"                 # 1080x1920, has audio
ffmpeg -i reel.mp4 -af volumedetect -vn -f null - 2>&1 | grep volume  # the voice is there
for t in 1 3.5 5 7; do ffmpeg -v error -y -ss $t -i reel.mp4 -frames:v 1 -vf scale=360:-1 f$t.png; done
ffmpeg -v error -y -i f1.png -i f3.5.png -i f5.png -i f7.png -filter_complex hstack=4 grid.png
```
