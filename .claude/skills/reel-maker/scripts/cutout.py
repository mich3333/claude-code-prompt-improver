#!/usr/bin/env python3
"""Background removal for a presenter photo (or a cartoon of the presenter).

    python3 cutout.py <in.jpg> <out.png> [--model u2net_human_seg] [--trim] [--bg "#0a0908"]
    python3 cutout.py <in.mp4> <out.webm> [--model u2net_human_seg] [--fps 30]

A photo becomes a PNG with a transparent background (``--trim`` crops it to the
person, ``--bg`` puts a solid colour behind instead). A short video becomes a
transparent VP9 WebM that ClipCraft keeps transparent as an overlay layer. That
is frame by frame without temporal smoothing, so expect slight edge shimmer;
on a Mac, Final Cut / CapCut / Apple Vision tools give cleaner video mattes.

Needs: pip install "rembg[cpu]" (models download from GitHub on first use).
Models (all free for commercial use):
  u2net_human_seg    people, fast (default)
  isnet-general-use  illustrations and cartoons
  birefnet-portrait  best hair/edges, slow and a ~1 GB download
Never use rembg's bria-rmbg model for published work (non-commercial licence).
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--model", default="u2net_human_seg")
    ap.add_argument("--trim", action="store_true", help="crop the PNG to the cut-out person")
    ap.add_argument("--bg", help="solid background colour instead of transparency, e.g. #0a0908")
    ap.add_argument("--fps", type=float, default=30)
    a = ap.parse_args()
    if "bria" in a.model:
        sys.exit("bria-rmbg is non-commercial; pick another model")
    try:
        from PIL import Image
        from rembg import new_session, remove
    except ImportError:
        sys.exit('rembg is not installed: pip install "rembg[cpu]"')

    session = new_session(a.model)
    ext = os.path.splitext(a.input)[1].lower()
    if ext in (".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp"):
        img = Image.open(a.input).convert("RGB")
        out = remove(img, session=session, post_process_mask=True)
        if a.trim:
            box = out.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
            if box:
                out = out.crop(box)
        if a.bg:
            flat = Image.new("RGBA", out.size, a.bg)
            flat.alpha_composite(out)
            out = flat.convert("RGB")
        out.save(a.output)
        print(f"{a.output} ({out.size[0]}x{out.size[1]})")
        return

    ff = os.environ.get("FFMPEG", "ffmpeg")
    tmp = tempfile.mkdtemp(prefix="cutout-")
    try:
        subprocess.run([ff, "-v", "error", "-i", a.input, "-vf", f"fps={a.fps}", os.path.join(tmp, "f%05d.png")], check=True)
        frames = sorted(f for f in os.listdir(tmp) if f.startswith("f"))
        for i, f in enumerate(frames):
            p = os.path.join(tmp, f)
            remove(Image.open(p).convert("RGB"), session=session, post_process_mask=True).save(os.path.join(tmp, "a" + f[1:]))
            if i % 30 == 0:
                print(f"  {i + 1}/{len(frames)}", flush=True)
        subprocess.run([ff, "-v", "error", "-y", "-framerate", str(a.fps), "-i", os.path.join(tmp, "a%05d.png"),
                        "-i", a.input, "-map", "0:v", "-map", "1:a?", "-shortest",
                        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "4M", "-auto-alt-ref", "0",
                        "-c:a", "libopus", a.output], check=True)
        print(f"{a.output} ({len(frames)} frames)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
