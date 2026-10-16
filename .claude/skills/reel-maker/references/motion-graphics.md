# Motion graphics: ClipCraft templates + Remotion

There are two engines, and each does what it is best at:

| Engine | Use it for | How |
|---|---|---|
| **ClipCraft black-and-gold templates** (canvas) | big number, bar chart, year timeline, source quote card: the data scenes | scene types `number`, `bars`, `year`, `quote` |
| **Remotion** (React → video, in `motion/`) | Hebrew kinetic typography, numbered lists, word-highlight captions, covers: anything typographic or that needs real HTML/CSS text layout | scene type `motion`, captions `engine: "remotion"`, the cover |

Remotion was chosen over the alternatives:
- **Motion Canvas** has not been released since 2024, and has no headless render.
- **Revideo** draws on a canvas, where Hebrew bidi is fragile.
- **Lottie** has weak Hebrew text and needs After Effects to author.

Remotion renders in Chromium, so Hebrew shaping, RTL and mixed numbers (`41%`, `₪1.5M`, `ב-2026`) come out right. Its clips are ordinary video files that ClipCraft imports as layers.

## Compositions (`motion/src`)

| id | what | props |
|---|---|---|
| `KineticTitle` | a small kicker, then title words spring in one by one; `highlight` words in the accent colour, with an underline that wipes in | `kicker`, `lines: []`, `highlight: []`, `theme`, `region`, `duration` |
| `ListReveal` | a title, then numbered cards sliding in one after another. `at` (seconds, one per item) lands each card on its word | `title`, `items: []`, `at: []`, `theme`, `region`, `duration` |
| `WordCaptions` | TikTok-style captions with the spoken word highlighted, transparent | `words`, `perPage`, `y`, `size`, `color`, `active`, `offset` |
| `Cover` (still) | a frame of the presenter, a dark gradient, and a big title in the grid-safe band | `image`, `title`, `highlight`, `subtitle`, `theme` |

**Themes:**
- `gold`: black and gold, the same palette as ClipCraft's templates;
- `light`: cream background, white cards and a soft wave, for the "explainer/avatar" style;
- `none`: a transparent background.

**`region`:**
- `top`: 1080×960, for the top half of a split screen;
- `full`: 1080×1920.

**Fonts:** Heebo 900 for headlines and Rubik 500/800 for body text, bundled from npm (`@fontsource`, SIL OFL). Nothing is fetched at render time.

## Rendering

`make_reel` renders `motion` scenes automatically, at each scene's exact length. To render by hand:

```bash
node scripts/render_motion.mjs jobs.json
# jobs.json
{ "assets": ["/abs/frame.jpg"],
  "renders": [
    { "composition": "KineticTitle", "output": "/abs/title.mp4",
      "props": { "lines": ["זה משנה", "את הכול"], "highlight": ["הכול"], "region": "top", "duration": 3 } },
    { "composition": "WordCaptions", "output": "/abs/captions.webm", "transparent": true,
      "props": { "words": [ … ], "duration": 42 } },
    { "composition": "Cover", "output": "/abs/cover.png",
      "props": { "image": "frame.jpg", "title": "…" } } ] }
```

- **Opaque clips:** H.264 MP4 (yuv420p). Use them as `media` layers (top or full).
- **`"transparent": true`:** VP9 WebM with alpha (`yuva420p`). ClipCraft's probe sees the alpha and decodes the layer with libvpx, so the alpha survives the export. Its soft-edge mask is skipped for such layers.
- **Stills:** PNG or JPEG, by the output's extension. Files in `assets` are copied into the bundle's public folder; refer to them by their base name.
- **First run:** `npm install` in `motion/` (about 250 packages).
- **Browser:** a local Playwright Chromium headless shell is used when present (cloud container). On a Mac, Remotion downloads its own Chrome Headless Shell once. Set `REMOTION_BROWSER` to force one.
- **Speed in the container:** about 2–7 s per clip after a ~20 s bundle. The bundle is built once per `render_motion` call.

## Adding a composition

1. Add `motion/src/MyThing.jsx`. Use `theme(name)` and `splitBidi()` from `theme.js`, wrap mixed Hebrew and number runs in `<bdi>`, and give the text containers `direction: 'rtl'`.
2. Register it in `src/index.jsx` with `calculateMetadata={meta}`, so `duration` and `region` come from the props.
3. Render one test frame and look at it before using it in a reel.

Remotion's official Agent Skills (`npx skills add remotion-dev/skills`) are a good reference for animation APIs (`spring`, `interpolate`, sequences).

## Licence

Remotion is free for individuals and for companies of up to 3 people, commercial use included. A bigger company needs a paid company licence. That limit applies to the user's business, not to this skill.

`@fontsource` fonts use the OFL, which is free for commercial video.
