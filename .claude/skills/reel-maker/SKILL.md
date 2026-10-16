---
name: reel-maker
description: Makes finished Hebrew vertical videos (Instagram Reels, TikTok, YouTube Shorts) end to end from the user's photo or talking-head video — transcription with word timings, a scene-by-scene script, black-and-gold data graphics, Remotion motion graphics (kinetic titles, lists, word-highlight captions, covers), source screenshots, jump cuts, captions, music, loudness and a cover — assembled in the ClipCraft editor into a 1080×1920 MP4 with one command. Use this whenever the user wants a reel, short, TikTok or vertical/explainer video, a "סרטון הסבר", "רילס", "סרטון אנכי", "טיקטוק", "שורטס", wants to edit, caption, cut silences in or reframe a video for social, wants a talking avatar or cartoon of themselves, or sends a selfie/recording and says "תעשה מזה רילס" — even if they only say "תעשה לי רילס על X".
---

# Reel maker

Photo or video in, finished reel out. The user's face (a talking-head recording, or a photo plus a narration) becomes a 1080×1920 Hebrew reel: graphics that cut in on the exact word, captions, music, a cover, and a check report. Everything is driven by **one job file** and **one command** (`scripts/make_reel.mjs`), so nothing is reinvented per reel.

Reply in Hebrew, keep the Latin names of companies, products and people as they are, and show progress with frames and the exported video rather than long explanations.

## The pipeline

1. **Brief.** Settle the topic, angle, length (default 30–60 s), who presents, and the voice. Ask only what cannot be inferred.
   - Presenters, best first: the user's own recording; a photo plus a narration; a cartoon of the user; a talking avatar.
   - Voices: the user's own recording, a stock ElevenLabs voice, or the user's cloned voice.
2. **Research.** Collect verified facts with dates and URLs. Use the deep-research skill for anything non-trivial.
   - Every number or quote on screen needs a source.
   - Flag conflicting figures instead of averaging them.
3. **Script.** Write a scene table plus one continuous narration (`references/scene-types.md`).
   - Each scene names the **phrase** it starts on (`"at": "לפי הדו״ח"`), so timing comes from the words, not from guessed seconds.
4. **Voice.** Either the user's recording, or ElevenLabs TTS through the connector. Price it with `estimate_only` first, then generate (`references/elevenlabs.md`).
5. **Words.** Get word timings for the narration (`references/transcription.md`).
   - Default: ElevenLabs Scribe through the connector. It is **not** free: a 13 s clip was estimated at ~15 credits, so estimate first.
   - Free alternative: `scripts/transcribe.sh` on the Mac, with ivrit.ai.
   - When the script is known, `make_reel` aligns the words to it, so captions show the exact spelling.
6. **Job file.** Write `job.json` (format in `references/pipeline.md`): presenter, words, script, jump cuts, scenes, captions engine, music, cover.
7. **Build.** Run one command: `xvfb-run -a node scripts/make_reel.mjs job.json` (plain `node` on a Mac).
   - It runs words → alignment → jump cuts → presenter → scenes → Remotion clips → ClipCraft assembly and captions → music and −14 LUFS → cover → checks.
   - It warns about scenes too short to read. Fix them and re-run.
8. **Check and deliver.** Look at `<out>-grid.png` (one frame per scene) and read `<out>-report.json` (`problems`, `warnings`).
   - Send the MP4, the cover, the grid, a short Hebrew summary, and the verify-before-posting checklist (every on-screen number with its source URL).
   - Mention the `.clipcraft` project (open it in ClipCraft to tweak) and the `.srt` (for the platform's own captions).

Run `node scripts/doctor.mjs` first on a new machine: it lists what is missing and how to fix it.

## Building blocks (and where they are documented)

| Need | Tool | Reference |
|---|---|---|
| Word timings, exact-script captions, SRT | Scribe (connector) / ivrit.ai offline; `scripts/words.mjs` | `references/transcription.md` |
| Data graphics (number, bars, years, source quote card) | ClipCraft black-and-gold templates | `references/scene-types.md`, `references/clipcraft.md` |
| Kinetic titles, lists, word-highlight captions, covers | Remotion (`motion/`, `scripts/render_motion.mjs`) | `references/motion-graphics.md` |
| Photo → presenter; cartoon presenter; talking avatar | `prepare_presenter.sh`, `cutout.py`, OmniHuman/HeyGen/Hedra | `references/presenter-and-avatar.md` |
| Source screenshots as proof cards | `scripts/screenshot.mjs` | `references/finishing.md` |
| Jump cuts, reframe 16:9→9:16, music ducking, loudness, cover, safe zones | `jumpcut.mjs`, `reframe.py`, `finish_audio.mjs` | `references/finishing.md` |
| Assembly and export | ClipCraft driven by `scripts/build_reel.mjs` | `references/clipcraft.md` |

The research behind these choices (comparisons, prices, licences, sources; in Hebrew) is `references/research.md` in the packaged skill, and `docs/video-suite-research.md` in the repository.

**Where ClipCraft is.** Inside the repository, the scripts find `video-editor/` by themselves. When the skill is installed on its own (from `reel-maker.skill`), set `"editorDir"` in the job, or `CLIPCRAFT_DIR`, to a checkout of `mich3333/claude-code-prompt-improver/video-editor` (`npm ci && npx vite build` in it once).

## Things that went wrong before (and how to avoid them)

- **Credits.** The ElevenLabs account is on the free plan, with little credit left.
  - Estimate every generation (`estimate_only`) and tell the user the cost before running it. Never spend credits on tests.
  - The free plan has **no commercial licence**. Say so if the reel is for a business.
- **No moving hands from a selfie on a free plan.** OmniHuman 1.5 (photo → talking, gesturing video) is refused on the free ElevenLabs plan, and Magnific has 0 credits.
  - Say so in one sentence and offer the ladder in `references/presenter-and-avatar.md`: the user records themselves (best, free); Dreamina's daily free credits; a cartoon presenter with poses; or a paid plan.
- **Stale ClipCraft build.** The editor runs its built UI bundle. After pulling or changing `video-editor/src`, run `npx vite build`.
  - `build_reel.mjs` refuses to run on a stale build. One stale build exported a transparent captions layer as a black screen.
- **Template defaults leak.** The bar chart's default prefix is `$` and suffix `B`. The scripts now clear them unless the scene sets them; set them explicitly when you want them.
- **Captions over full-screen layers.** Seam captions sit on top of lists and screenshots. `build_reel` moves the captions over full-screen layers to the bottom automatically.
- **Delivery tags leak into captions.** eleven_v3 tags like `[excited]` can come back from Scribe as words. The word tools drop bracketed words; keep tags at the start of a line anyway.
- **Network limits in cloud sessions.**
  - The container may not reach `api.elevenlabs.io`, Hugging Face, or many news sites.
  - It can reach `storage.googleapis.com`, GitHub releases, PyPI and npm.
  - The connector does the ElevenLabs work, and `build_reel` feeds Scribe words to the editor through a local stand-in.
  - When a site blocks the screenshot script, ask the user for a phone screenshot.
- **Numbers still counting.** Frames grabbed mid count-up show intermediate values. The check grid samples late in each scene, and the planner warns when a number scene is under 1.7 s.
- **Made-up figures.** Placeholder numbers are fine for a demo, but say so explicitly and ask for the real ones before the user posts.

## Output

Deliver, in this order:
1. The reel MP4 (1080×1920, H.264 + AAC, −14 LUFS) via the file-sending tool.
2. The cover PNG and the frame grid.
3. A short Hebrew summary covering:
   - what each scene shows;
   - what is placeholder;
   - what still needs the user (credits, a recording, real numbers).
4. The verify-before-posting checklist with source URLs.
