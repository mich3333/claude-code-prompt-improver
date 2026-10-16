# The presenter: recording, photo, cartoon, avatar

Pick the best option the user can actually get. In order:

| # | Presenter | Quality | Cost | How |
|---|---|---|---|---|
| 1 | **The user records themselves** (phone, vertical, chest up, eye level, window light) | the best, real gestures | free | `presenter.video`; add `"reframe": true` if it is horizontal |
| 2 | **Photo + narration** (slow push-in, face in the lower half) | good for explainers where the graphics carry the reel | free | `presenter.photo` + `voice` |
| 3 | **Cartoon of the user, with poses** (pointing at the content) | playful; the popular Hebrew-creator look | an image model, a few cents | recipe below |
| 4 | **Talking, gesturing avatar from one photo** (OmniHuman 1.5 and similar) | impressive, sometimes uncanny | paid (free daily credits on Dreamina) | ladder below |

## Photo presenter

`prepare_presenter.sh <photo> <out.mp4> [seconds] [voice] [delay_ms]`, called automatically by `make_reel`:
- The face sits in the lower half of a 1080×1920 frame; the top 760 px stay black, because the graphics cover them.
- A slow 1.0→1.07 push-in keeps it alive.
- Tune the crop with `CROP_Y` (`presenter.cropY`). Check one frame: the face must be below the middle line.

The photo must be sharp, chest up, facing the camera, with space above the head.

ClipCraft itself is gaining a "photo as presenter" framing feature (focus point, zoom, smooth Ken Burns) on another branch. Once it is merged, the same framing can be adjusted by hand in the editor's inspector.

## Cartoon presenter (from the user's photo)

1. **Cartoon.** Use an image model that keeps the likeness. Pass the user's photo as the reference: "same person, same face and outfit, flat 2D cartoon style, plain solid background, upper body".
   - Good options: Nano Banana (Gemini 2.5 Flash Image, about $0.04/image), gpt-image, Seedream 4 (about $0.03).
   - On the user's ElevenLabs connector: `creative_generate_image` / `creative_edit_image`. Estimate first.
   - FLUX.1 Kontext [dev] weights are non-commercial; the hosted API is fine.
2. **Poses.** Edit the cartoon, not the photo again, so the character stays consistent: "same character, pointing left / pointing up / thumbs up / thinking". Make 3–5 poses.
3. **Cut-out.** `python3 scripts/cutout.py cartoon.png cartoon-cut.png --model isnet-general-use --trim` gives a transparent PNG (`u2net_human_seg` is for photos of people).
4. **In the reel.** Each pose is a `media` scene: `{ "type": "media", "file": "pose-point.png", "region": "bottom", "split": 0.55, "fit": "contain" }`, on the words where the user points. The content (a light `ListReveal`, a screenshot) goes in a full or top layer under it.
   - Cut between poses on the beats: no lip-sync, but lively and cheap.
   - For a lip-synced cartoon, feed one pose and the narration to OmniHuman or Hedra; both handle stylized characters.

## Talking avatar from a photo: the ladder

No tool states it supports Hebrew lip-sync. These models follow the sound, so Hebrew usually works, but run a 10-second test before buying anything.

| Option | Cost (approx., Oct 2026) | Notes |
|---|---|---|
| **Dreamina (CapCut) → AI Avatar → Avatar Pro** (OmniHuman 1.5) | **120 free credits a day** | The user uploads the photo and the narration MP3 themselves. The best free quality. |
| HeyGen Avatar IV | free: 3 videos/month, 720p, watermark; Creator about $29/month; API about $0.05/s | head and upper body |
| Hedra Character-3 | about $2–3.6 per minute on paid plans | good for stylized characters |
| ElevenLabs OmniHuman 1.5 (`creative_generate_video`, `bytedance-omnihuman-v1.5`) | needs a paid plan (Starter $6/month) | **refused on the free plan.** Also not available in the US. |
| Magnific/Freepik OmniHuman (`video_speak`) | about 180 credits per second | the user's Magnific balance is 0 |
| fal.ai OmniHuman 1.5 API | about $0.16/s (about $9.60/min); 30 s of audio max at 1080p | the best quality per call; split long narrations |
| Kling Avatar 2.0 (fal) | about $0.06–0.12/s | cheaper second choice |

**Open models** (InfiniteTalk, Wan 2.2 S2V/Animate, LongCat-Video-Avatar) need a big NVIDIA GPU. On an Apple Silicon Mac they are far too slow; a few minutes per second of video is optimistic. Use a rented GPU if needed.

**Prompting OmniHuman-type models:**
- Use a chest-up photo that shows the hands; otherwise the model invents them.
- Describe the gestures: "counts on fingers, points with index finger, open palms, natural nods".
- Keep the audio to 30 s or less per call at 1080p.

**Safety:** only animate or clone the user's own face and voice, never anyone else's.
