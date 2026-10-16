# Transcription and word timings

Word timings drive everything: the captions, the moment each scene cuts in, and the jump cuts. They are stored as `[{ text, start, end, type: "word" }]` in seconds, the same format as ElevenLabs Scribe. Any other transcriber's output is converted with `node scripts/words.mjs normalize raw.json words.json`.

## Which transcriber

| Option | Hebrew | Word times | Cost | Where |
|---|---|---|---|---|
| **ElevenLabs Scribe** (connector `creative_transcribe_audio`, `eleven_scribe_v1`) | very good | yes | credits per minute. **A 13 s clip was estimated at ~15 credits**, so estimate first | cloud; works from this container |
| **ivrit.ai Whisper turbo** (`transcribe.sh … ivrit`, faster-whisper + `ivrit-ai/whisper-large-v3-turbo-ct2`) | the best open Hebrew model | yes | free | the Mac, offline after the first download |
| mlx-whisper (`transcribe.sh … mlx`) | vanilla Whisper turbo: decent, weaker than ivrit | yes | free | Apple GPU, the fastest |
| whisper.cpp (`transcribe.sh … cpp`, `MODEL=` a ggml file such as ivrit's) | depends on the model | yes (`-ml 1 -sow`) | free | Mac (Metal) |
| OpenAI `gpt-4o-transcribe` | good | **no word times** | paid | not useful for captions |

Defaults:
- **Cloud session:** Scribe, after an `estimate_only` call and the user's OK when credits are low.
- **On the Mac, or when credits are short:** `scripts/transcribe.sh narration.mp3 words.json` (ivrit).
- **This container cannot download Hugging Face models and has no GPU,** so local Whisper runs only on the user's machine.

### Scribe through the connector

1. Create a flow with `creative_create_flow`.
2. Upload the file:
   1. `creative_create_asset_upload`, with the exact byte size and MIME type.
   2. `curl -X PUT -H 'Content-Type: <mime>' --data-binary @file '<upload_url>'`.
   3. `creative_finalize_asset_upload`, with the `flow_id`. It returns a `node_id`.
3. Call `creative_transcribe_audio` with `estimate_only: true` first. Tell the user the cost.
4. Run it, then poll `creative_get_flow_run_status`.
5. Save `transcripts[0]` (or the file at `words_download_url`) as `scribe.json`.

If the narration came from ElevenLabs TTS on the same flow, connect the speech node instead of uploading.

## Exact script spelling (forced alignment, light)

When the narration text is known (TTS, or the user read a script), let the script decide the spelling and the recogniser decide the timing:

```bash
node scripts/words.mjs align heard.json narration.txt words.json
```

How it works:
1. Words are matched in order, by an LCS over normalized forms. Normalizing removes niqqud and punctuation and folds final letters; a one-letter ASR slip still counts as a match.
2. Script words with no match get times between their neighbours.
3. Fillers that are not in the script disappear.

`make_reel` does this automatically when the job has `script`. It needs no models.

For phoneme-accurate alignment (rarely needed for reels), there are two options on the Mac:
- stable-ts `model.align(audio, text, language='he')` with the ivrit model;
- WhisperX with the Hebrew wav2vec2 aligner.

Avoid MMS/ctc-forced-aligner for published work: its weights are CC-BY-NC, and it needs niqqud for Hebrew.

## Other word tools

```bash
node scripts/words.mjs show words.json                 # start  end  word, one per line
node scripts/words.mjs find words.json "לפי הכתבה"    # when is it said? (for scene times by hand)
node scripts/words.mjs srt words.json captions.srt 4   # subtitles file, 4 words per cue
```

## Testing without spending credits

`espeak-ng -v he` speaks Hebrew (robotic, but enough for a pipeline test). Synthesize each word separately and concatenate the clips with known pauses; the clip lengths then give exact word times. Never call TTS or Scribe for tests.
