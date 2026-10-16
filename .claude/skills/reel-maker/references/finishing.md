# Finishing: cuts, framing, proof cards, sound, cover, platform specs

## Jump cuts (silences and fillers)

`node scripts/jumpcut.mjs in.mp4 words.json out.mp4 [--gap 0.35] [--pad 0.08] [--extra כאילו,בעצם] [--dry-run]`

What it does:
- Keeps speech, and removes pauses longer than `gap`.
- Removes hesitation sounds: אממ, אמ, אה, אהה, הממ, ממ, um, uh.
- Each kept part gets `pad` seconds of air on both sides, with tiny audio fades so there are no clicks.
- Re-encodes frame-accurately and writes `out.words.json` with the timings moved onto the new timeline.

Tuning:
- `--gap 0.25` gives an energetic TikTok feel. `0.5` gives a calmer explainer.
- Whisper-style recognisers often leave fillers out of the transcript, so they turn up as gaps and get cut anyway.
- "כאילו"/"בעצם" are often real words; add them with `--extra` only after reading the transcript.

**Alternative:** `auto-editor in.mp4 --margin 0.1s,0.2s --edit audio:-30dB` cuts by loudness alone, with no transcript (Unlicense).

## Horizontal → vertical (auto-reframe)

`python3 scripts/reframe.py in.mp4 out.mp4` needs `pip install "opencv-python-headless<5" numpy`. OpenCV 5 dropped the bundled face detector.

How it works:
1. Faces are detected 4 times a second.
2. The video is split into shots where the picture changes sharply.
3. Each shot gets one steady crop on the median face position: a locked-off frame, with no jitter.
4. Audio is copied.

`make_reel` runs it when the job has `presenter.reframe: true` and the video is wider than it is tall. Google AutoFlip has been unsupported since 2023; this is the standard detect → smooth → crop approach.

## Background removal

`python3 scripts/cutout.py in.jpg out.png [--model …] [--trim] [--bg "#0a0908"]` needs `pip install "rembg[cpu]"`. Models download from GitHub on first use.

**Models:**
- `u2net_human_seg`: people, fast (about 8 s per photo on a CPU);
- `isnet-general-use`: cartoons;
- `birefnet-portrait`: the best edges, about a 1 GB download.

**Never use `bria-rmbg`:** it is non-commercial.

**Video:** `cutout.py in.mp4 out.webm` gives a transparent VP9 WebM, frame by frame. It has no temporal smoothing, so edges shimmer a little. For clean video mattes on the Mac, use CapCut/Final Cut, or an Apple Vision person-segmentation tool. RobustVideoMatting is GPL-3.0.

## Proof cards (screenshots of sources)

`node scripts/screenshot.mjs <url|file.html> card.png [--selector "article h1"] [--label "ynet · 12.10.2026"] [--raw]`

What it does:
- Captures the page at 2× scale as a phone would see it (he-IL locale), from the top of `--selector`.
- Blocks the common consent-banner vendors and hides what is left of cookie, consent and paywall pop-ups.
- Frames the capture as a 1080×1920 card: a rounded screenshot on a dark gold-glow backdrop, with the source under it.

Use the card as a `screenshot` scene (full frame; a slide from the right is the classic look).

Many news sites block automated browsers or paywall. When the capture fails or shows a wall, ask the user for a phone screenshot and frame it the same way: open the image in a small HTML page and run the script on that file, or use it directly.

Cloud sessions cannot reach most news sites at all.

## Sound

`node scripts/finish_audio.mjs in.mp4 out.mp4 [--music bed.mp3] [--music-db -16] [--lufs -14] [--tp -1.5]`

- **Music:** loops under the whole reel at `--music-db`, and ducks about 10 dB while the voice speaks (sidechain compression).
- **Loudness:** two-pass `loudnorm` to −14 LUFS integrated and −1.5 dBTP. That is a safe common target for Reels, TikTok and Shorts; YouTube turns loud audio down and never up.
- **Video:** copied untouched. The script prints the loudness before and after.

**Music sources:**
- the user's own;
- royalty-free libraries (YouTube Audio Library, Pixabay Music);
- ElevenLabs Music: on paid plans only for commercial use, about 900 credits per minute of music, so far beyond the free plan's remaining credits.
- Platform "trending sounds" can only be added in the app, after export.

## Cover

`make_reel` renders `reel-cover.png` with the Remotion `Cover` still:
- a presenter frame;
- the title in the band from y 1000 to 1620, so it survives the 3:4 grid crop (1080×1440) and stays clear of the side buttons;
- 3–6 words, the key word in gold.

Upload it as the cover in the app.

## Platform specs and safe zones (Oct 2026)

**Export:**
- 1080×1920, 30 fps, H.264 High, yuv420p, about 8–12 Mbps;
- AAC 48 kHz, 192 kbps;
- `+faststart`. ClipCraft's export at quality 18, followed by `finish_audio`, meets this.

**Length:**
- Shorts: up to 3 minutes;
- Reels: up to 3 minutes to be recommended to non-followers;
- TikTok: longer is allowed.
- The sweet spot for explainers is 30–60 s.

**Safe zone** for text and faces: x 60–890, y 290–1250 is safe on all three platforms even by the conservative ads guidance, which reserves the bottom 670 px and the right 190 px (the like/comment/share buttons). In organic posts the caption/description UI covers roughly the bottom 400 px, so captions down to y≈1480 still read.

Where the captions sit:
- red seam captions: y≈960;
- Remotion `bottom` captions: y≈0.70 of the height (≈1340);
- captions moved off full-screen cards: y≈0.76 (≈1460). Full-screen cards keep their content above ≈1300, so those captions sit under the content, not on it.
