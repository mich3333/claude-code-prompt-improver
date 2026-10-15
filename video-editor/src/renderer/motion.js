// Motion tokens, after Emil Kowalski's design-engineering guidelines:
// - UI motion stays under 300ms; exits are faster than entrances.
// - Ease-out for anything entering or responding to the user, never ease-in.
// - Animate transform and opacity only; enter from scale 0.95+, never from 0.
// - Things people do hundreds of times (selecting, scrubbing, dragging,
//   keyboard shortcuts) are instant: direct manipulation follows the pointer 1:1.

export const EASE_OUT = [0.23, 1, 0.32, 1]; // strong ease-out (quint-like)
export const EASE_IN_OUT = [0.77, 0, 0.175, 1]; // for on-screen movement
export const EASE_DRAWER = [0.32, 0.72, 0, 1]; // iOS-like sheet curve

export const DURATION = { fast: 0.15, base: 0.2, slow: 0.25 };

export const enter = { duration: DURATION.base, ease: EASE_OUT };
export const exit = { duration: DURATION.fast, ease: EASE_OUT };
export const move = { duration: DURATION.slow, ease: EASE_IN_OUT };
// Springs without bounce for elements that can be interrupted mid-flight.
export const snappy = { type: 'spring', duration: 0.3, bounce: 0 };
