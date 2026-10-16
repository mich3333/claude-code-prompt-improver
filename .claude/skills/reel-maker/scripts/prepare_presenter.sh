#!/usr/bin/env bash
# Photo -> 1080x1920 presenter video with the face in the lower half and a slow
# push-in, optionally with the narration muxed in.
#
#   prepare_presenter.sh <photo> <out.mp4> [seconds=16] [voice.mp3] [voice_delay_ms=300]
#
# Env: FFMPEG (default: ffmpeg on PATH), CROP_Y (source-photo row where the crop
# starts; default 16% of the photo height), ZOOM (end zoom, default 1.07).
set -euo pipefail

photo=$1
out=$2
seconds=${3:-16}
voice=${4:-}
delay=${5:-300}
ff=${FFMPEG:-ffmpeg}
zoom=${ZOOM:-1.07}
fps=30
frames=$(awk "BEGIN { printf \"%d\", $seconds * $fps }")

# Source size, from ffmpeg's stream line (e.g. "1932x2576").
# (ffmpeg exits non-zero without an output file, so don't let pipefail stop us.)
size=$({ "$ff" -i "$photo" 2>&1 || true; } | grep -oE '[0-9]{2,5}x[0-9]{2,5}' | head -1)
w=${size%x*}
h=${size#*x}

# The visible presenter area is 1080x1160 (y 760..1920); the top is covered by graphics.
crop_h=$(awk "BEGIN { v = int($w * 1160 / 1080 / 2) * 2; if (v > $h) v = int($h / 2) * 2; print v }")
crop_y=${CROP_Y:-$(awk "BEGIN { v = int($h * 0.16); m = $h - $crop_h; if (v > m) v = m; print v }")}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

"$ff" -v error -y -i "$photo" -vf \
  "crop=${w}:${crop_h}:0:${crop_y},scale=$((w * 2)):-2,zoompan=z='1+($zoom-1)*on/$frames':x='iw/2-(iw/zoom/2)':y='ih*0.42-(ih/zoom*0.42)':d=$frames:s=1080x1160:fps=$fps,pad=1080:1920:0:760:black,format=yuv420p" \
  -frames:v "$frames" -c:v libx264 -crf 18 -preset veryfast "$tmp/video.mp4"

if [ -n "$voice" ]; then
  "$ff" -v error -y -i "$tmp/video.mp4" -i "$voice" \
    -filter_complex "[1:a]adelay=${delay}:all=1,apad[a]" -map 0:v -map "[a]" \
    -t "$seconds" -c:v copy -c:a aac -b:a 192k "$out"
else
  cp "$tmp/video.mp4" "$out"
fi
echo "$out"
