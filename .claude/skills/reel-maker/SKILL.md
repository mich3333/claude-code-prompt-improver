---
name: reel-maker
description: Makes Hebrew vertical explainer reels (Instagram Reels, TikTok, YouTube Shorts) end to end — sourced research, a scene-by-scene script, a Hebrew voice-over with ElevenLabs, word-synced captions, black-and-gold data graphics on a split screen, and the finished 1080×1920 MP4 built in the ClipCraft editor. Use this whenever the user wants a reel, short, TikTok or vertical video about a topic, a "סרטון הסבר", "רילס", "סרטון אנכי", "טיקטוק", "שורטס", or asks to turn research, a story, numbers or their own photo/talking-head video into a short social video — even if they only say "תעשה לי רילס על X" or send a selfie and say "שאני אגיש את זה".
---

# Reel maker

Turn a topic (and the user's face: a talking-head video or a photo) into a finished Hebrew explainer reel in the style of the black-and-gold "graphic on top, presenter below" format: a year timeline, big gold numbers, gold bar charts, full-screen source screenshots that cut in on the exact word, and short red captions on the seam between the halves.

The user writes in Hebrew and usually gives short instructions. Reply in Hebrew, keep the Latin names of companies, products and people as they are, and show progress with frames and the exported video rather than long explanations.

## The pipeline

Work through these phases in order. Each phase produces something the next one needs, so check it before moving on.

1. **Brief** — topic, angle, length (default 45–60 s), who presents (the user's own talking-head video is best; a photo works as a still presenter), and the voice (stock ElevenLabs voice, the user's cloned voice, or the user's own recording). Ask only what you cannot infer; if the user already said "like the reference", the format is settled.
2. **Research** — verified facts with dates and URLs. For anything non-trivial, use the deep-research skill (parallel researchers + a report writer). Every number or quote that goes on screen needs a source, and conflicting figures must be flagged rather than averaged. Prefer official announcements and major outlets; tag each fact as official / reported / estimate.
3. **Script** — a scene table plus one continuous narration block. See `references/scene-types.md` for the five scene types, their ClipCraft fields and the pacing rules (cut on the word, 2–5 s per insert, one transition style for the whole reel). Write the narration for the ear: short sentences, numbers spelled the way they are spoken.
4. **Voice** — ElevenLabs via the connector. Always price it first with `estimate_only`, compare with the credits left, and only then generate. Details, voice IDs and known limits in `references/elevenlabs.md`.
5. **Transcription** — ElevenLabs Scribe on the narration gives per-word timings. Those timings drive both the captions and the moment each scene starts.
6. **Presenter** — the user's talking-head video goes straight to the main track. A photo needs framing (face in the lower half) and a slow push-in so it feels alive: `scripts/prepare_presenter.sh`. Then mux the narration in (the same script can do it).
7. **Assembly in ClipCraft** — import the presenter, set 9:16, add the gold graphics as split-screen layers at the scene times, edit their content, generate captions (red look, middle position), export at 1080p. `scripts/build_reel.mjs` does all of this from a scenes JSON; see `references/clipcraft.md`.
8. **Check and deliver** — extract a few frames (one per scene) into a grid and look at them before sending; listen-check that audio exists (`volumedetect`). Send the MP4, the frame grid and a short verify-before-posting checklist (every on-screen number with its source URL).

## Things that went wrong before (and how to avoid them)

- **No moving hands from a selfie.** Animating a photo into a talking, gesturing presenter (OmniHuman 1.5) needs a paid plan on ElevenLabs or credits on Magnific; on free plans it is refused. Say so in one sentence and offer: the user records themselves (best and free), Dreamina (CapCut) Avatar Pro with free daily credits, or upgrading. The photo must show the hands, chest up — otherwise the model invents them.
- **Delivery tags leak into captions.** eleven_v3 tags like `[excited]` can come back from Scribe typed as words. ClipCraft drops bracketed words, but keep tags at the very start of a line so a stray one is easy to spot.
- **Free quota runs out mid-generation.** One 8.5 s take with eleven_v3 cost ~123 credits; four variations at once can hit the quota and the rate limit. Use `generations_count: 1` when credits are tight.
- **Network limits in cloud sessions.** The container may not reach `api.elevenlabs.io` or vendor CDNs, but it can usually download generated files from `storage.googleapis.com` and upload through the connector's signed URL. If the editor cannot call Scribe itself, feed it the Scribe words through the local stand-in described in `references/clipcraft.md`, and say plainly that you did.
- **Numbers that are still counting.** Frames grabbed mid count-up show intermediate values; that is the animation, not a bug. Grab check frames late in each scene.
- **Made-up figures.** Placeholder numbers are fine for a demo, but say so explicitly and ask for the real ones before the user posts.

## Output

Deliver, in this order:
1. The reel MP4 (1080×1920, H.264 + AAC) via the file-sending tool.
2. A frame grid (one frame per scene).
3. A short Hebrew summary: what each scene shows, what is placeholder, what still needs the user (credits, a recording, real numbers).
4. The verify-before-posting checklist with source URLs.
