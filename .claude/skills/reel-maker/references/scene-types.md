# Scene types and pacing

A reel is an A-roll (the presenter talking) with B-roll inserts on top of it. Each insert should do a job: prove a claim, make a reference recognizable, or show a number. An insert without a job slows the reel down.

## Scene types

| Type | What the viewer sees | Engine | Fields |
|---|---|---|---|
| `face` (פנים) | only the presenter, full frame | nothing on the overlay track | — |
| `number` (מספר גדול) | a gold number counting up, small title above | ClipCraft `gold-number` | `label`, `value` (`$852B`, `×7`, `5 דק׳`), `note`, `years` + `from`/`to`/`active` |
| `bars` (גרף עמודות) | gold bars growing one after another | ClipCraft `gold-bars` | `label`, `values` (`label: value` per line, max 8), `prefix`, `suffix` |
| `year` (ציר שנים) | a big year, and a timeline dot sliding to it | ClipCraft `gold-year` | `label`, `from`, `to`, `active` |
| `quote` (כרטיס מקור) | full screen: the original quote or headline, a Hebrew translation, who, where, URL | ClipCraft `gold-quote` | `label`, `who`, `where`, `quote`, `he`, `url`, `headline` (true = no quote marks) |
| `screenshot` (צילום מקור) | the article/post itself, as a framed card, full frame | an image layer | `image` (from `screenshot.mjs`), `url` |
| `motion` (טיפוגרפיה בתנועה) | Hebrew kinetic title, numbered list… | Remotion | `composition` (`KineticTitle`, `ListReveal`), `props`, `region` |
| `media` | any image or video: a cartoon pose, b-roll, a Remotion clip | a layer | `file`, `region`, `split`, `fit` |

`number`, `bars`, `year` and top-region `motion` sit in the top half, with the presenter below and the captions on the seam between them. `quote`, `screenshot` and full-region `motion` fill the frame.

## Timing: cut on the word

Give every scene an `at` phrase, the words from the narration that introduce it ("לפי הכתבה ב…", "שווה היום…"). `make_reel` finds the phrase in the word timings and starts the scene on its first word. Each scene ends where the next one starts (or at `until` / `duration` / `end`).

Phrases are matched after the previous scene, so a repeated word is fine as long as the scenes are in order.

## Pacing rules

- **2–5 seconds per insert.**
  - A number needs at least ~1.7 s so the count-up lands (it runs ~1.5 s).
  - A screenshot or quote that must be read needs 2.5 s or more.
  - The planner warns about anything shorter.
- **One transition style for the whole reel** (job-level `animation`). Hard cuts are the default; "slide in from the right" suits screenshots. Mixing slides, zooms and fades reads as amateur.
- **Open on the face** with a strong hook in the first 2–3 s, and **close on the face** with the takeaway.
- **Captions:** 2–3 words each, from the narration automatically. Use red on the seam for split-screen reels, and Remotion word-highlight for face-heavy reels.

## Script table format

| # | Starts on (exact words) | Spoken line (exactly as read aloud) | Type | Visual details |
|---|---|---|---|---|
| 1 | — | … | face | — |
| 2 | "לפי הכתבה" | … | screenshot | headline to capture + URL |
| 3 | "שווה היום" | … | number | label: …, value: … |

Then the whole narration as one block for TTS (and as `script` for exact captions):
- Write numbers the way they are said ("שמונה מאות חמישים ושניים מיליארד דולר").
- Keep sentences short.
- Put any delivery tag (`[excited]`) only at the start of a line.

On screen, numbers stay as digits (`$852B`). The alignment matches spoken words to the script, so when a number is spelled out in the narration the captions show it spelled out too.

## Example rhythm (≈20 s)

| Time | Shows |
|---|---|
| 0–3 | face: the hook |
| 3–6 | screenshot: the headline slides in |
| 6–9 | face |
| 9–12 | bars: the growth |
| 12–15 | number: the big figure |
| 15–18 | motion: `ListReveal` "3 סיבות" |
| 18–20 | face: the takeaway |
