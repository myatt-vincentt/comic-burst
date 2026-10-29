// The hand swipe — pure, unit-tested (swipe.test.ts). Every palm in view is
// followed for a short while. A swipe is one long, fast, sideways sweep that
// starts from (near) rest: the palm's latest run in one direction must cover
// a big share of the screen's width, quickly and mostly level, and in the
// moment before it the hand must not have been moving the other way. Waving
// turns back every half-swing, so after the first swing it never counts, and
// a small wave never travels far enough to count at all. After a swipe the
// hand must slow down (and a moment must pass) before the next one counts.
import { SWIPE } from "../config";

type Sample = { t: number; x: number; y: number };

export type Track = {
  id: number;
  samples: Sample[];
  /** When it was first and last seen. */
  born: number;
  seen: number;
};

export type SwipeEvent = { dir: 1 | -1; x: number; track: number };

export type Measure = {
  /** Sideways travel of the latest one-way run (its last `window` seconds), screen widths. */
  travel: number;
  /** Its average speed (screen widths per second). */
  speed: number;
  /** How far the hand went the other way just before the run. */
  before: number;
  /** Vertical travel over the same stretch. */
  rise: number;
};

export type SwipeDetector = {
  tracks: Track[];
  nextId: number;
  /** False after a swipe until the hands slow down. */
  armed: boolean;
  /** When the last swipe fired. */
  last: number;
  /** The fastest palm's numbers this frame (for the debug readout). */
  probe: Measure;
};

const NONE: Measure = { travel: 0, speed: 0, before: 0, rise: 0 };

export const createSwipe = (): SwipeDetector => ({
  tracks: [],
  nextId: 1,
  armed: true,
  last: -1e9,
  probe: { ...NONE },
});

/** How long a hand's path is kept (the run plus the moment before it). */
const KEEP = SWIPE.window + SWIPE.before + 0.1;

/** The numbers a swipe is judged on, for one hand's samples (oldest first). */
export const measure = (samples: ReadonlyArray<Sample>): Measure | null => {
  const n = samples.length;
  if (n < 3) return null;
  const last = samples[n - 1];
  // The latest one-way run: walk back while the hand kept going the same
  // way (tiny steps back are tracking noise).
  let dir = 0;
  let start = n - 1;
  for (let i = n - 1; i > 0; i -= 1) {
    const step = samples[i].x - samples[i - 1].x;
    if (dir === 0 && Math.abs(step) > SWIPE.noise) dir = Math.sign(step);
    if (dir !== 0 && step * dir < -SWIPE.noise) break;
    start = i - 1;
  }
  if (dir === 0) return null;
  // Only its last `window` seconds count toward travel and speed.
  let from = start;
  while (from < n - 1 && last.t - samples[from].t > SWIPE.window) from += 1;
  const a = samples[from];
  const span = last.t - a.t;
  if (span < 0.08) return null;
  const travel = last.x - a.x;
  // The other way, just before the run started.
  const s0 = samples[start];
  let before = 0;
  for (let i = start - 1; i >= 0 && s0.t - samples[i].t <= SWIPE.before; i -= 1)
    before = Math.max(before, (samples[i].x - s0.x) * dir);
  return { travel, speed: travel / span, before, rise: Math.abs(last.y - a.y) };
};

/** How fast a hand moves right now (screen widths per second, last ~0.15 s). */
const recentSpeed = (samples: ReadonlyArray<Sample>, now: number) => {
  const recent = samples.filter((s) => now - s.t <= 0.16);
  if (recent.length < 2) return 0;
  const a = recent[0];
  const b = recent[recent.length - 1];
  return b.t > a.t ? Math.hypot(b.x - a.x, b.y - a.y) / (b.t - a.t) : 0;
};

/**
 * One step: this frame's palms (screen uv) at time `now`. Returns the swipe,
 * if one just happened. Mutates `d`.
 */
export const stepSwipe = (
  d: SwipeDetector,
  palms: ReadonlyArray<{ x: number; y: number }>,
  now: number,
): SwipeEvent | null => {
  // Match each palm to the nearest hand seen a moment ago.
  const taken = new Set<number>();
  palms.forEach((p) => {
    let best: Track | null = null;
    let bestD = SWIPE.jump;
    d.tracks.forEach((tr) => {
      if (taken.has(tr.id) || now - tr.seen > SWIPE.lost) return;
      const q = tr.samples[tr.samples.length - 1];
      const dist = q ? Math.hypot(p.x - q.x, p.y - q.y) : Infinity;
      if (dist < bestD) {
        bestD = dist;
        best = tr;
      }
    });
    let tr = best as Track | null;
    if (!tr) {
      tr = { id: d.nextId, samples: [], born: now, seen: now };
      d.nextId += 1;
      d.tracks.push(tr);
    }
    taken.add(tr.id);
    const last = tr.samples[tr.samples.length - 1];
    // A repeated reading (the tracker runs slower than the screen) adds nothing.
    if (!last || last.x !== p.x || last.y !== p.y)
      tr.samples.push({ t: now, x: p.x, y: p.y });
    tr.seen = now;
  });
  d.tracks = d.tracks.filter((tr) => now - tr.seen <= SWIPE.lost);
  d.tracks.forEach((tr) => {
    while (tr.samples.length && now - tr.samples[0].t > KEEP)
      tr.samples.shift();
  });

  // Re-arm once every hand has slowed down (or gone), after the cooldown.
  if (!d.armed && now - d.last >= SWIPE.cooldown) {
    const calm = d.tracks.every(
      (tr) => recentSpeed(tr.samples, now) < SWIPE.rearmSpeed,
    );
    if (calm) d.armed = true;
  }

  let fired: SwipeEvent | null = null;
  const probe = { ...NONE };
  d.tracks.forEach((tr) => {
    const m = measure(tr.samples.filter((s) => s.t - tr.born >= SWIPE.settle));
    if (!m) return;
    if (Math.abs(m.speed) > Math.abs(probe.speed)) Object.assign(probe, m);
    if (fired || !d.armed) return;
    const travel = Math.abs(m.travel);
    if (
      travel >= SWIPE.travel &&
      Math.abs(m.speed) >= SWIPE.speed &&
      m.before <= SWIPE.backAllowed &&
      m.rise <= SWIPE.level * travel
    ) {
      const last = tr.samples[tr.samples.length - 1];
      fired = { dir: m.travel > 0 ? 1 : -1, x: last.x, track: tr.id };
    }
  });
  d.probe = probe;
  if (fired) {
    d.armed = false;
    d.last = now;
    // This swipe is used up: its hand starts a fresh measurement.
    const tr = d.tracks.find((t) => t.id === (fired as SwipeEvent).track);
    if (tr) tr.samples = tr.samples.slice(-1);
  }
  return fired;
};

/** Where a followed hand is now (screen uv x), or null if it's gone. */
export const trackX = (d: SwipeDetector, id: number, now: number) => {
  const tr = d.tracks.find((t) => t.id === id);
  if (!tr || now - tr.seen > 0.2 || !tr.samples.length) return null;
  return tr.samples[tr.samples.length - 1].x;
};

/** The fastest palm in view right now (screen widths per second). */
export const fastestPalm = (d: SwipeDetector, now: number) =>
  d.tracks.reduce(
    (best, tr) =>
      now - tr.seen > 0.2 ? best : Math.max(best, recentSpeed(tr.samples, now)),
    0,
  );
