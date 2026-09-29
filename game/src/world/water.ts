/** Sea level: every air cell below this height counts as water. */
export const WATER_LEVEL = 21.85;

/** How deep (in blocks) a point at height y sits below the water surface; 0 when above it. */
export function waterDepth(y: number): number {
  return Math.max(0, WATER_LEVEL - y);
}
