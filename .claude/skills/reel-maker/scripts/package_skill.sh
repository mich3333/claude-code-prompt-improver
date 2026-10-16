#!/usr/bin/env bash
# Packs the skill into an installable reel-maker.skill (a zip with the
# reel-maker/ folder at its root), without node_modules or render output.
# The research report from docs/ is included as references/research.md.
#   package_skill.sh [out.skill]   (default: dist/reel-maker.skill in the repo)
set -euo pipefail
skill=$(cd "$(dirname "$0")/.." && pwd)
repo=$(cd "$skill/../../.." && pwd)
out=$(realpath -m "${1:-$repo/dist/reel-maker.skill}")
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/reel-maker" "$(dirname "$out")"
(cd "$skill" && tar --exclude=node_modules --exclude=out --exclude=__pycache__ -cf - .) | tar -xf - -C "$tmp/reel-maker"
[ -f "$repo/docs/video-suite-research.md" ] && cp "$repo/docs/video-suite-research.md" "$tmp/reel-maker/references/research.md"
rm -f "$out"
(cd "$tmp" && python3 -c "import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', '.', 'reel-maker')" "$out.tmp" && mv "$out.tmp.zip" "$out")
echo "$out ($(du -h "$out" | cut -f1))"
