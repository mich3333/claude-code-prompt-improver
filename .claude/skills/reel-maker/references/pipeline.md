# One-shot pipeline: `make_reel.mjs` and the job file

```bash
node scripts/doctor.mjs                         # once per machine: what is missing and how to fix it
xvfb-run -a node scripts/make_reel.mjs job.json # Linux without a display; on a Mac: node scripts/make_reel.mjs job.json
```

Relative paths in the job are resolved from the job file's folder. Intermediates go to `workDir` (default `<output>-work/`).

## Job file

```json
{
  "editorDir": "../video-editor",
  "output": "reel.mp4",
  "title": "הכותרת לכריכה",

  "presenter": { "photo": "me.jpg", "voice": "narration.mp3", "voiceDelay": 0.3, "cropY": 300 },
  "words": "scribe.json",
  "script": "narration.txt",
  "jumpcut": { "gap": 0.35, "pad": 0.08, "fillers": true, "extra": [] },

  "scenes": [
    { "type": "face", "start": 0 },
    { "type": "year", "at": "בשנת", "label": "הכול התחיל ב-", "from": 2021, "to": 2026, "active": 2026 },
    { "type": "number", "at": "שווה היום", "label": "שווי החברה", "value": "$852B", "years": false },
    { "type": "bars", "at": "ההכנסות", "label": "הכנסות בשנה", "values": "2024: 4\n2025: 9", "prefix": "$", "suffix": "B" },
    { "type": "screenshot", "at": "לפי הכתבה", "image": "card.png", "animation": "slideright", "url": "https://…" },
    { "type": "quote", "at": "כמו שאמר", "who": "Sam Altman", "where": "יוני 2025", "quote": "…", "he": "…", "url": "…" },
    { "type": "motion", "at": "שלוש סיבות", "composition": "ListReveal", "region": "full",
      "props": { "title": "3 סיבות", "items": ["…", "…", "…"], "theme": "light" } },
    { "type": "motion", "at": "וזה משנה", "composition": "KineticTitle",
      "props": { "kicker": "השורה התחתונה", "lines": ["זה משנה", "את הכול"], "highlight": ["הכול"] } },
    { "type": "face", "at": "אז מה עושים" }
  ],

  "captions": { "engine": "clipcraft", "look": "red", "position": "middle", "words": 3 },
  "music": "bed.mp3", "musicDb": -16,
  "cover": { "title": "ככה עושים רילס בחמש דקות", "highlight": ["בחמש"], "subtitle": "" },
  "animation": "none"
}
```

### presenter

Give exactly one of `photo` or `video`.

- **`video`**: the user's recording. Its own audio is the narration and the words describe it.
  - `"reframe": true` turns a horizontal video vertical, following the face (`reframe.py`; needs Python with OpenCV, see `finishing.md`).
- **`photo` + `voice`**: the photo is framed with the face in the lower half and a slow push-in (`prepare_presenter.sh`), and the narration is muxed in after `voiceDelay` seconds.
  - `cropY` moves the crop (the source-photo row where it starts). `zoom` sets the push-in (default 1.07).

### words

The narration's word timings, in any format: ElevenLabs Scribe (connector or API), Whisper, mlx-whisper, faster-whisper, or whisper.cpp. `script` (a file or the text itself) replaces what was heard with the exact text that was read, keeping the timings (see `transcription.md`).

### jumpcut

- `true` or an object: removes pauses longer than `gap` seconds and hesitation sounds (אממ, אה, הממ…).
  - `extra` adds words to cut, such as "כאילו". Use it carefully: those are often real words.
- On a photo presenter it cuts the narration audio before the presenter is made. On a video it cuts the video.
- The word timings follow the cut.

### scenes

Scenes run back to back on the overlay track with hard cuts, and `face` scenes leave the presenter alone.

**Start** — exactly one of:
- `at` — a phrase from the narration; the scene starts on its first word. Each scene searches after the previous one.
- `start` — seconds.
- `lead` (default 0.05 s) — shifts an `at` start that much earlier.

**End** — the first of these that is set:
- `end` — seconds;
- `until` — a phrase;
- `duration` — seconds;
- otherwise the next scene's start, or the end of the reel.

| type | what | fields |
|---|---|---|
| `face` | the presenter only | — |
| `number`, `bars`, `year`, `quote` | ClipCraft black-and-gold templates | see `scene-types.md` |
| `screenshot` | an image, full frame by default (make one with `screenshot.mjs`) | `image`, `url` (for the checklist) |
| `media` | any image or video as a layer (a cut-out PNG, a Remotion clip, a b-roll) | `file` |
| `motion` | a Remotion composition rendered to the scene's exact length | `composition`, `props`; `region` defaults to `top` |

Every layer also takes:
- `region`: `top` / `bottom` / `full`;
- `split`: 0.3–0.7;
- `fit`: `cover` / `contain`;
- `animation`: `fade` / `none` / `slideright` / `slideleft` / `slidebottom`.

The job-level `animation` is the default for every layer. Pick one style for the whole reel. Slides need a ClipCraft with layer animations; without them they fall back to `fade`, with a note.

The planner prints each scene's time span and **warns** when a scene is too short to read:
- under 1.5 s for most scenes;
- under 1.7 s for a number (its count-up takes 1.5 s);
- under 2.5 s for a screenshot or quote.

### captions

- `"engine": "clipcraft"` (default): the editor's own captions — red on the seam, or white at the top/middle/bottom; `words` per caption is 1–4. Captions that fall over full-screen layers move to the bottom.
- `"engine": "remotion"`: TikTok-style word-highlight captions as one transparent layer over everything.
  - `position`: top / middle / bottom, or `y` as a share of the height.
  - Also `size`, `color`, `active` (the colour of the spoken word).
- `"engine": "none"`: no captions; the `.srt` is still written.

### music, cover

- **`music`**: loops under the whole reel at `musicDb`, and ducks about 10 dB while the voice speaks. The mix is then normalized to −14 LUFS / −1.5 dBTP (`finish_audio.mjs`).
- **`cover`**: renders a 1080×1920 cover from a presenter frame, with the title inside the 3:4 grid-safe band.
  - Words in `highlight` are drawn in gold.
  - `"cover": false` skips it.

## Outputs

| File | What |
|---|---|
| `reel.mp4` | the finished reel |
| `reel-cover.png` | the cover |
| `reel-grid.png` | one frame per scene, late in the scene, plus the opening face |
| `reel-report.json` | size, length, loudness, the scene table, `problems` (failed checks) and `warnings` (pacing) |
| `reel.srt` | captions for uploading to TikTok or YouTube, or to CapCut |
| `reel.clipcraft` | the ClipCraft project: open it in the editor to tweak anything by hand |
| `reel-editor.png` | a screenshot of the editor after assembly |

`make_reel` exits non-zero when a check fails (not 1080×1920, no audio, length mismatch, near-silence). Read `problems` and fix them before delivering.

## Running pieces on their own

Every step is also a standalone script, for when the user wants only that:

| Step | Command |
|---|---|
| Words | `node scripts/words.mjs normalize/align/srt/find/show …` |
| Jump cuts only | `node scripts/jumpcut.mjs in.mp4 words.json out.mp4` |
| Loudness / music | `node scripts/finish_audio.mjs in.mp4 out.mp4 --music bed.mp3` |
| Vertical from horizontal | `python3 scripts/reframe.py in.mp4 out.mp4` |
| Cut-out | `python3 scripts/cutout.py photo.jpg out.png --trim` |
| Proof card | `node scripts/screenshot.mjs URL card.png --selector "h1"` |
| Motion clips / cover | `node scripts/render_motion.mjs jobs.json` |
| Assembly only | `xvfb-run -a node scripts/build_reel.mjs spec.json` (see `clipcraft.md`) |
