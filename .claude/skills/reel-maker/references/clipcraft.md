# Building the reel in ClipCraft

ClipCraft is the user's Electron + React editor in `video-editor/` of `mich3333/claude-code-prompt-improver` (clone it if it is not in the session; the black-and-gold templates and captions live on `main` once PR #4 is merged, until then on `feature/auto-captions`). Install with `npm ci` in `video-editor/` and build the UI with `npx vite build`.

## What the editor gives you

- **Main track:** the presenter video (with the narration as its audio).
- **Overlay track ("שכבה עליונה"):** layers on top — region top/bottom (split screen, feathered seam) or full frame (מסך מלא).
- **Templates tab → black-and-gold:** `gold-number`, `gold-bars`, `gold-year` render a 4 s animated graphic as a split-screen layer at the playhead; its content is edited in the layer panel and re-rendered with "עדכון הגרפיקה". `gold-captions` restyles captions red on the seam.
- **Captions (כתוביות):** transcribes every audible clip with ElevenLabs Scribe and adds 1–4-word captions; looks white or red; positions top/middle/bottom.
- **Export:** MP4 H.264 + AAC; pick 1080 and quality 18 for posting.

## Driving it automatically

`scripts/build_reel.mjs` launches the real app with Playwright (`playwright-core`, Electron from `node_modules`), and does the whole assembly from a JSON spec:

```json
{
  "editorDir": "/path/to/video-editor",
  "presenter": "/abs/presenter-voice.mp4",
  "words": "/abs/words.json",
  "wordsOffset": 0.3,
  "scenes": [
    { "type": "year", "start": 0, "end": 2.75, "label": "התחלתי לבנות ב-", "active": 2026 },
    { "type": "number", "start": 2.75, "end": 4.4, "label": "זמן עריכה לרילס", "value": "5 דק׳", "active": 2026 },
    { "type": "bars", "start": 4.4, "end": 6.4, "label": "שעות עריכה בשבוע", "values": "לפני: 10\nאחרי: 2", "prefix": "", "suffix": " ש׳" },
    { "type": "number", "start": 6.4, "end": 9.0, "label": "יותר סרטונים בחודש", "value": "×5", "years": false },
    { "type": "screenshot", "start": 9.0, "end": 12.0, "image": "/abs/headline.png" }
  ],
  "captions": { "look": "red", "position": "middle", "words": 3, "language": "heb" },
  "output": "/abs/my-reel.mp4"
}
```

Run it under a display: `xvfb-run -a node scripts/build_reel.mjs spec.json` (on a Mac or a desktop, plain `node`). It prints the captions it created and any page errors, saves `<output>-editor.png`, and exports the MP4.

- `words` is optional. When set, the script serves those Scribe words to the editor through a local stand-in (the `CLIPCRAFT_SCRIBE_URL` environment variable), so the editor's own captions pipeline runs even where the container cannot reach ElevenLabs. `wordsOffset` shifts them by the delay of the narration inside the presenter clip. Without `words`, the captions dialog needs a real ElevenLabs API key typed by the user, so skip captions or ask.
- Scenes are placed back to back with hard cuts (`fade` off); `end` trims each layer.

## Presenter from a photo

`scripts/prepare_presenter.sh <photo> <out.mp4> [seconds] [voice.mp3] [voice_delay_ms]` crops the photo so the face sits in the lower half of a 1080×1920 frame (top 760 px left black, it is covered by the graphics), adds a slow 1.0→1.07 push-in, and optionally muxes the narration in. Check one frame: the face must be below the middle line. Tune the crop with `CROP_Y` (pixels from the top of the source photo where the crop starts) if it is not.

## Checking the result

```bash
ffmpeg -i reel.mp4 2>&1 | grep -E "Duration|Stream"                 # 1080x1920, has audio
ffmpeg -i reel.mp4 -af volumedetect -vn -f null - 2>&1 | grep volume  # the voice is there
for t in 1 3.5 5 7; do ffmpeg -v error -y -ss $t -i reel.mp4 -frames:v 1 -vf scale=360:-1 f$t.png; done
ffmpeg -v error -y -i f1.png -i f3.5.png -i f5.png -i f7.png -filter_complex hstack=4 grid.png
```
