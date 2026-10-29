// The wipe between the room and the comic world — pure, unit-tested
// (wipe.test.ts). The new world follows behind the hand: its edge runs just
// ahead of the hand while the hand leads, and finishes the sweep on its own
// (strict ease-out) once the hand stops or leaves.
import { WIPE } from "../config";

export type Phase = "normal" | "in" | "comic" | "out";

export type Wipe = {
  phase: Phase;
  /** The edge's x (screen uv) and the way it travels (+1 right, −1 left). */
  edge: number;
  dir: 1 | -1;
  /** Seconds since the wipe started. */
  age: number;
  /** A new seed for the jagged edge each wipe. */
  seed: number;
  /** Wipes into the comic world so far. */
  count: number;
};

export const createWipe = (): Wipe => ({
  phase: "normal",
  edge: WIPE.from,
  dir: 1,
  age: 0,
  seed: 0,
  count: 0,
});

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Whether the comic world is (or is becoming) what you see. */
export const isComic = (w: Wipe) => w.phase === "comic" || w.phase === "in";

/** Start a wipe the other way round from now. Returns false while one is running. */
export const startWipe = (w: Wipe, dir: 1 | -1): boolean => {
  if (w.phase === "in" || w.phase === "out") return false;
  w.phase = w.phase === "normal" ? "in" : "out";
  w.dir = dir;
  w.edge = dir > 0 ? WIPE.from : WIPE.to;
  w.age = 0;
  w.seed = (w.seed + 0.618034) % 1;
  if (w.phase === "in") w.count += 1;
  return true;
};

/**
 * One step. `leader` is the hand or finger leading the wipe (screen uv x),
 * or null. Returns true on the frame the wipe finishes.
 */
export const stepWipe = (
  w: Wipe,
  dt: number,
  leader: number | null,
): boolean => {
  if (w.phase !== "in" && w.phase !== "out") return false;
  w.age += dt;
  const start = w.dir > 0 ? WIPE.from : WIPE.to;
  const end = w.dir > 0 ? WIPE.to : WIPE.from;
  // A touch past the end, so the ease-out reaches it.
  const auto =
    start + (end + 0.08 * w.dir - start) * easeOut(w.age / WIPE.auto);
  let target = auto;
  if (leader !== null) {
    const led = leader + WIPE.lead * w.dir;
    target = w.dir > 0 ? Math.max(auto, led) : Math.min(auto, led);
  }
  const next = w.edge + (target - w.edge) * (1 - Math.exp(-WIPE.follow * dt));
  // The edge never goes back.
  w.edge = w.dir > 0 ? Math.max(w.edge, next) : Math.min(w.edge, next);
  const done = w.dir > 0 ? w.edge >= end : w.edge <= end;
  if (done) {
    w.edge = end;
    w.phase = w.phase === "in" ? "comic" : "normal";
  }
  return done;
};

/**
 * The wipe for the shaders: edge x, direction, 1 if the world behind the
 * edge is the comic one, and the jagged edge's seed. Outside a wipe the edge
 * is parked far off-screen, so one formula covers every phase.
 */
export const wipeUniform = (w: Wipe): [number, number, number, number] => {
  if (w.phase === "normal") return [10, 1, 0, w.seed];
  if (w.phase === "comic") return [10, 1, 1, w.seed];
  return [w.edge, w.dir, w.phase === "in" ? 1 : 0, w.seed];
};
