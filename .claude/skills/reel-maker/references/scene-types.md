# Scene types and pacing

A reel is an A-roll (the presenter talking) with B-roll inserts on top of it. Each insert should do a job — prove a claim, make a reference recognizable, or show a number — otherwise it slows the reel down.

## The five scene types

| Type | What the viewer sees | ClipCraft | Fields |
|---|---|---|---|
| `face` (פנים) | Only the presenter, full frame | nothing on the overlay track | — |
| `screenshot` (מסך מלא) | A headline, post or article, full frame, readable | import the image, add it as an overlay layer, region **מסך מלא** | image path; source URL for the checklist |
| `number` (מספר גדול) | A gold number counting up, small title above | template `gold-number` | `label`, `value` (e.g. `$852B`, `×7`, `5 דק׳`), `note`, `years` + `from`/`to`/`active` |
| `bars` (גרף עמודות) | Gold bars growing one after another | template `gold-bars` | `label`, `values` (`label: value` per line, max 8), `prefix`, `suffix` |
| `year` (ציר שנים) | A big year and a timeline dot sliding to it | template `gold-year` | `label`, `from`, `to`, `active` |

`number`, `bars` and `year` sit in the top half (split screen) with the presenter below; the captions go on the seam between them.

## Pacing rules

- **Cut on the word.** A scene starts on the word that introduces it ("לפי הכתבה ב…", "שווה היום…"). Use the Scribe word timings to place it.
- **2–5 seconds per insert.** A screenshot that must be read can stay longer; a big number needs at least ~1.7 s so the count-up lands (it runs ~1.5 s).
- **One transition style for the whole reel.** Mixing slides, zooms and fades reads as amateur.
- **Open on the face** with a strong hook (first 2–3 s), **close on the face** with the takeaway.
- **Captions:** 2–3 words each, red, on the seam (`middle`); they come from the narration automatically.

## Script table format

| # | Time | Spoken line (exactly as read aloud) | Type | Visual details |
|---|---|---|---|---|
| 1 | 0–3 | … | face | — |
| 2 | 3–6 | … | screenshot | headline to capture + URL |
| 3 | 6–9 | … | number | label: …, value: … |

Then the whole narration as one block for the TTS tool. Write numbers the way they are said ("שמונה מאות חמישים ושניים מיליארד דולר"), keep sentences short, and put any delivery tag (`[excited]`) only at the start.

## Example rhythm (≈17 s)

| Time | Shows |
|---|---|
| 0–3 | face — hook |
| 3–6 | screenshot — the headline slides in |
| 6–9 | face |
| 9–12 | bars — the growth |
| 12–15 | number — the big figure |
| 15–17 | face — takeaway |
