#!/usr/bin/env bash
# Offline Hebrew transcription with word timings, on the user's Mac (no credits).
# The default in a cloud session is ElevenLabs Scribe through the connector
# (see references/transcription.md); use this when working locally or offline.
#
#   transcribe.sh <audio-or-video> <words.json> [ivrit|mlx|cpp]
#
#   ivrit (default)  faster-whisper + ivrit-ai/whisper-large-v3-turbo-ct2: the best
#                    open Hebrew model. CPU int8 on a Mac, roughly real time or faster.
#                    pip install faster-whisper
#   mlx              mlx-whisper on the Apple GPU, the fastest; vanilla Whisper turbo
#                    (weaker Hebrew than ivrit). pip install mlx-whisper
#                    MODEL=... to use another MLX conversion.
#   cpp              whisper.cpp (brew install whisper-cpp) with a ggml model file:
#                    MODEL=/path/to/ggml-model.bin (e.g. from ivrit-ai/whisper-large-v3-turbo-ggml)
#
# Models download from Hugging Face on first use. The result is normalized to the
# Scribe word format by words.mjs, so every later step treats them the same.
set -euo pipefail

in=$1
out=$2
backend=${3:-ivrit}
here=$(cd "$(dirname "$0")" && pwd)
ff=${FFMPEG:-ffmpeg}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 16 kHz mono WAV: what every Whisper variant expects.
"$ff" -v error -y -i "$in" -vn -ac 1 -ar 16000 "$tmp/audio.wav"

case "$backend" in
  ivrit)
    PY=${PYTHON:-python3}
    "$PY" - "$tmp/audio.wav" "$tmp/raw.json" "${MODEL:-ivrit-ai/whisper-large-v3-turbo-ct2}" <<'EOF'
import json, sys
from faster_whisper import WhisperModel
audio, out, model_id = sys.argv[1:4]
model = WhisperModel(model_id, device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, language="he", word_timestamps=True, vad_filter=True, beam_size=5)
words = [{"text": w.word.strip(), "start": w.start, "end": w.end, "type": "word"} for s in segments for w in (s.words or [])]
json.dump({"language_code": "heb", "words": words}, open(out, "w"), ensure_ascii=False)
print(f"{len(words)} words, {info.duration:.1f}s of audio", file=sys.stderr)
EOF
    ;;
  mlx)
    mlx_whisper "$tmp/audio.wav" --model "${MODEL:-mlx-community/whisper-large-v3-turbo}" --language he \
      --word-timestamps True --output-format json --output-dir "$tmp" --output-name raw >/dev/null
    ;;
  cpp)
    : "${MODEL:?set MODEL=/path/to/ggml-model.bin}"
    bin=$(command -v whisper-cli || command -v whisper-cpp || true)
    [ -n "$bin" ] || { echo "whisper.cpp not found: brew install whisper-cpp" >&2; exit 1; }
    # -ml 1 -sow: one word per entry, split on word boundaries.
    "$bin" -m "$MODEL" -l he -f "$tmp/audio.wav" -ml 1 -sow -oj -of "$tmp/raw" >/dev/null 2>&1
    ;;
  *)
    echo "unknown backend: $backend (ivrit | mlx | cpp)" >&2
    exit 1
    ;;
esac

node "$here/words.mjs" normalize "$tmp/raw.json" "$out"
