#!/usr/bin/env python3
"""Auto-reframe a horizontal (16:9) video to vertical 9:16, following the face.

    python3 reframe.py <in.mp4> <out.mp4> [--width 1080] [--sample-fps 4] [--x 0.5]

How it works: faces are detected a few times per second (OpenCV's bundled
detector, CPU only, no downloads); the video is split into shots where the
picture changes sharply; each shot gets ONE steady crop centred on the median
face position (a talking head looks best with a locked-off frame, and nothing
jitters). Shots with no face keep the previous crop (or --x, a share of the
width, for the first). Audio is copied.

Needs: pip install "opencv-python-headless<5" numpy (OpenCV 5 dropped the bundled
face detector), and ffmpeg.
"""

import argparse
import os
import subprocess
import sys


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--width", type=int, default=1080, help="output width (height = 16/9 of it)")
    ap.add_argument("--sample-fps", type=float, default=4)
    ap.add_argument("--x", type=float, default=0.5, help="fallback crop centre, 0..1 of the width")
    ap.add_argument("--cut", type=float, default=0.45, help="shot-change threshold (histogram distance)")
    a = ap.parse_args()
    try:
        import cv2
        import numpy as np
    except ImportError:
        sys.exit('needs: pip install "opencv-python-headless<5" numpy')
    if not hasattr(cv2, "CascadeClassifier"):
        sys.exit(f'OpenCV {cv2.__version__} has no bundled face detector: pip install "opencv-python-headless<5"')

    cap = cv2.VideoCapture(a.input)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cw = min(W, int(round(H * 9 / 16 / 2)) * 2)
    face = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
    step = max(1, int(round(fps / a.sample_fps)))

    shots = [{"start": 0.0, "xs": []}]
    prev_hist = None
    for i in range(0, n, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ok, frame = cap.read()
        if not ok:
            break
        t = i / fps
        small = cv2.resize(frame, (640, int(640 * H / W)))
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        hist = cv2.normalize(cv2.calcHist([hsv], [0, 1], None, [32, 32], [0, 180, 0, 256]), None).flatten()
        if prev_hist is not None and cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA) > a.cut:
            shots.append({"start": t, "xs": []})
        prev_hist = hist
        gray = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
        found = face.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(40, 40))
        if len(found):
            x, y, w, h = max(found, key=lambda f: f[2] * f[3])  # the biggest face is the speaker
            shots[-1]["xs"].append((x + w / 2) * W / small.shape[1])
    cap.release()

    last = a.x * W
    parts = []
    for s in shots:
        cx = float(np.median(s["xs"])) if s["xs"] else last
        last = cx
        left = int(min(max(0, cx - cw / 2), W - cw))
        parts.append((s["start"], left, len(s["xs"])))
        print(f"shot @ {s['start']:.2f}s: crop x={left} ({len(s['xs'])} face samples)")

    # crop's x is evaluated per frame: a step function of t over the shots.
    expr = str(parts[-1][1])
    for k in range(len(parts) - 2, -1, -1):
        expr = f"if(lt(t,{parts[k + 1][0]:.3f}),{parts[k][1]},{expr})"
    out_h = int(round(a.width * 16 / 9 / 2)) * 2
    vf = f"crop={cw}:{H}:x='{expr}':y=0,scale={a.width}:{out_h}:flags=lanczos,setsar=1"
    ff = os.environ.get("FFMPEG", "ffmpeg")
    subprocess.run([ff, "-v", "error", "-y", "-i", a.input, "-vf", vf, "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
                    "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", a.output], check=True)
    print(f"-> {a.output}")


if __name__ == "__main__":
    main()
