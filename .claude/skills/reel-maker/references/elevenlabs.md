# ElevenLabs: voice, transcription, avatar

Use the ElevenLabs connector tools (`mcp__ElevenLabs__creative_*`; load them with ToolSearch). They run on ElevenLabs' side, so they work even when the container cannot reach `api.elevenlabs.io`.

## One flow per reel

Create a flow first (`creative_create_flow`) and pass its `flow_id` to every call, so the voice, the transcription and any avatar video can be wired together. Give the user the flow link — they can listen, switch voices and download there.

## Voice

- **Model:** `eleven_v3` (supports Hebrew and delivery tags like `[excited]`).
- **Voice:** find one with `creative_list_voices` (`languages: ["he"]`, gender, `use_cases: ["social_media"]`). The voice used so far: **Itai – Upbeat Social Creator**, `voice_id` `JIxTgeeS5w0UQyBxEnrl` (bright, energetic, standard Israeli accent). Voice IDs only ever come from that tool or the user.
- **Price first:** call `creative_generate_speech` with `estimate_only: true`. Reference point: an 8.5 s line cost 123 credits; the free monthly quota is 10,000. Tell the user the cost and what is left before generating; if it is not enough, stop and say exactly how many credits are missing.
- **Variations:** the default is 4 takes. When credits are tight use `generations_count: 1` — four at once can also hit the rate limit (429).
- **Poll** `creative_get_flow_run_status` until `all_completed` or `has_failures`; failed takes report why (quota, rate limit).
- **Download** the mp3 from the result's `content_url` (signed `storage.googleapis.com` URL, valid ~2 h) with curl.
- **The user's own voice:** a voice clone needs a clean recording of the user (a minute or more of speech). Never clone anyone else's voice.

## Transcription (word timings)

`creative_transcribe_audio` with `model_id: eleven_scribe_v1` and `connect_from` the speech node (or an uploaded audio node). It is **not** free: earlier runs showed 0, but an `estimate_only` call in October 2026 priced a 13 s clip at ~15 credits. Always estimate first; when credits are short, transcribe locally instead (`scripts/transcribe.sh`, see `transcription.md`). The result has `transcripts[0].words` with `text`, `type`, `start`, `end` in seconds — save them as `words.json` for captions. Hebrew comes back accurate. Delivery tags may appear as words (`[excited]`); `words.mjs` drops them. Pass the file to `make_reel` as `words` as is (any shape it returns is accepted).

## Uploading the user's files

`creative_create_asset_upload` (exact byte size and MIME type) → `curl -X PUT -H 'Content-Type: <mime>' --data-binary @file '<upload_url>'` → `creative_finalize_asset_upload` with the `flow_id` → use the returned `node_id` as `connect_from`.

## Talking avatar from a photo (moving hands)

`creative_generate_video` with `model_id: bytedance-omnihuman-v1.5`, `connect_from: [photo node, speech node]`, and a prompt describing gestures ("counts on his fingers, points with index finger, opens palms, natural nods"). **Needs a paid ElevenLabs plan** — on a free plan the node cannot be created; do not retry, tell the user in one sentence and offer the alternatives in SKILL.md. Price it with `estimate_only` before running.

Alternatives with the same model: Magnific `video_speak` (mode `omnihuman`, audio up to 30 s; needs credits — check `account_balance`), or Dreamina (CapCut) → AI Avatar → Avatar Pro (OmniHuman 1.5), which the user runs themselves with free daily credits by uploading the photo and the narration mp3.

## Music and sound effects

`audio_music_generate` and `audio_sfx_generate` live on the Magnific connector (balance 0 credits); ElevenLabs Music lives on the ElevenLabs side. Music costs about 900 credits per minute, far more than the free plan has left. ElevenLabs music is cleared for commercial use only on paid plans.

For a music bed, prefer the user's own track or a royalty-free library, and mix it with `finish_audio.mjs --music`. Estimate before generating anything.

## Licence

The free plan includes **no commercial licence** for generated audio, and requires attribution. If the reel promotes a business, say so and suggest the Starter plan, or the user's own voice.
