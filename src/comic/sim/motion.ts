// How much the person moves, and how bright they are — pure, unit-tested
// (motion.test.ts). Reads a tiny copy of the picture (red: brightness, green:
// the person mask) and compares it with the one before: brightness changing
// on the person, and the person's outline moving, both count as movement.
import { MOTION } from "../config";

export type PersonLight = {
  /** Mean and spread of the person's brightness (0..1). */
  mean: number;
  spread: number;
  /** Share of the picture that is the person. */
  area: number;
};

export type MotionState = {
  prev: Uint8Array | null;
  /** The raw frame difference (per second) and the smoothed level 0..1. */
  raw: number;
  level: number;
  light: PersonLight;
};

export const createMotion = (): MotionState => ({
  prev: null,
  raw: 0,
  level: 0,
  light: { mean: 0.45, spread: 0.18, area: 0 },
});

/**
 * Take one read-back (RGBA bytes) taken `dt` seconds after the last one.
 * Updates `raw` and `light`; mutates `m`.
 */
export const readFrame = (m: MotionState, px: Uint8Array, dt: number) => {
  const n = px.length / 4;
  const prev = m.prev && m.prev.length === px.length ? m.prev : null;
  let wSum = 0;
  let lSum = 0;
  let l2Sum = 0;
  let diff = 0;
  let diffW = 0;
  for (let i = 0; i < n; i += 1) {
    const l = px[i * 4] / 255;
    const k = px[i * 4 + 1] / 255;
    wSum += k;
    lSum += l * k;
    l2Sum += l * l * k;
    if (prev) {
      const pl = prev[i * 4] / 255;
      const pk = prev[i * 4 + 1] / 255;
      const w = Math.max(k, pk);
      diff += Math.abs(l - pl) * w + Math.abs(k - pk);
      diffW += w;
    }
  }
  if (wSum > n * 0.01) {
    const mean = lSum / wSum;
    const spread = Math.sqrt(Math.max(0, l2Sum / wSum - mean * mean));
    // The bands follow the light slowly, so they never pump.
    const k = Math.min(1, dt * 1.5);
    m.light.mean += (mean - m.light.mean) * k;
    m.light.spread += (Math.max(0.06, spread) - m.light.spread) * k;
  }
  m.light.area = wSum / n;
  // Movement per sample; the read-backs come at a steady rate, so no per-second scaling.
  m.raw = prev && diffW > n * 0.01 ? diff / diffW : 0;
  if (!m.prev || m.prev.length !== px.length)
    m.prev = new Uint8Array(px.length);
  m.prev.set(px);
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Advance the smoothed level toward this frame's movement: the frame
 * difference and the fastest palm (screen widths per second). Rises quickly,
 * settles slowly, so it never strobes.
 */
export const stepMotion = (m: MotionState, palmSpeed: number, dt: number) => {
  const fromFrames = smooth(MOTION.floor, MOTION.full, m.raw);
  const fromHands = smooth(MOTION.handFrom, MOTION.handFull, palmSpeed);
  const target = Math.max(fromFrames, 0.85 * fromHands);
  const rate = target > m.level ? MOTION.rise : MOTION.fall;
  m.level += (target - m.level) * (1 - Math.exp(-rate * dt));
  return m.level;
};
