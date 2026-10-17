import { Easing, interpolate } from 'remotion';

// Motion tokens for the personal reel style, following Emil Kowalski's
// animation guidance (.claude/skills/animate): strong ease-out for anything
// entering or leaving, ease-in-out for things moving on screen, nothing grows
// from zero, entrances are short and staggered, springs barely bounce.
// Durations are in frames at 30fps; this is explanatory video, so entrances
// sit at the slow end of the UI range.

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export const DUR = {
  /** A word or chip popping in. */
  quick: 6,
  /** Cards, titles, panels entering. */
  enter: 10,
  /** Something moving across the screen (a split, a reframe). */
  move: 14,
  /** Delay between siblings entering one after another. */
  stagger: 2,
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0 → 1 over `dur` frames from `start`, with the strong ease-out. */
export const enterProgress = (frame: number, start: number, dur = DUR.enter) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: EASE_OUT });

/** 0 → 1 over `dur` frames from `start`, with ease-in-out, for on-screen movement. */
export const moveProgress = (frame: number, start: number, dur = DUR.move) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: EASE_IN_OUT });

/**
 * Style for an element entering: fades in, rises a little and settles from
 * 96% scale (never from 0). Optionally leaves the same way it came in.
 */
export const enterStyle = (frame: number, start: number, opts: { dur?: number; rise?: number; exitAt?: number } = {}) => {
  const { dur = DUR.enter, rise = 24, exitAt } = opts;
  const p = enterProgress(frame, start, dur);
  const out = exitAt === undefined ? 0 : enterProgress(frame, exitAt, DUR.quick + 2);
  const v = p * (1 - out);
  return {
    opacity: v,
    translate: `0px ${(1 - p) * rise + out * rise}px`,
    scale: String(0.96 + 0.04 * v),
  } as const;
};
