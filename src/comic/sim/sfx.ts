// When and where the sound-effect lettering pops up — pure, unit-tested
// (sfx.test.ts). Calm: now and then a quiet word. Moving: more often,
// bigger and louder words. A big move and the wipe-in each shout a big one.
// Words never land on your face, keep out of each other's way, and only a
// few are up at once. Each pops in with a quick strict ease-out punch (no
// bounce), holds while drifting, then fades.
import type { Mood } from "../words";

export type WordInfo = { mood: Mood; panel?: boolean; w: number; h: number };

export type Sfx = {
  word: number;
  /** Centre (screen uv), em size (screen heights), turn (radians). */
  x: number;
  y: number;
  em: number;
  turn: number;
  vx: number;
  vy: number;
  age: number;
  hold: number;
  front: boolean;
};

export const SFX = {
  /** Most sound effects up at once, and in front of you (one more when moving a lot). */
  max: 6,
  maxFront: 2,
  /** Seconds between new words: calm, and at full movement. */
  calmEvery: 2.8,
  busyEvery: 0.5,
  /** Movement above this uses the loud words. */
  fast: 0.5,
  /** A big move: movement this high, at most this often (seconds). */
  big: 0.72,
  bigEvery: 1.4,
  /** Pop-in and fade times. */
  pop: 0.16,
  fade: 0.35,
  /** The panel text lines in the background. */
  panels: 4,
};

/** Seconds a word holds, by mood (plus up to 0.6 s more). */
const HOLD: Record<Mood, number> = { calm: 1.7, fast: 0.9, bang: 1.3 };

export type SfxState = {
  items: Sfx[];
  /** Panel lines: word, x, y, em. */
  panels: Sfx[];
  timer: number;
  sinceBig: number;
};

export const createSfx = (): SfxState => ({
  items: [],
  panels: [],
  timer: 1,
  sinceBig: 99,
});

export type Box = { x: number; y: number; w: number; h: number };

/** A word's box on screen (uv), with a margin. */
export const boxOf = (
  s: { x: number; y: number; em: number },
  info: WordInfo,
  aspect: number,
  grow = 1,
): Box => ({
  x: s.x,
  y: s.y,
  w: ((info.w * s.em) / aspect) * grow,
  h: info.h * s.em * grow,
});

const overlaps = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

export type Scene = {
  words: WordInfo[];
  aspect: number;
  /** The face's box (uv, y up), or null. */
  face: Box | null;
  /** How much of a box (uv) is you, 0..1: words behind you must stay visible. */
  cover: (b: Box) => number;
  rnd: () => number;
};

const pick = (list: number[], rnd: () => number) =>
  list[Math.floor(rnd() * list.length)];

/** Is this spot free: off the face, off the other words, on screen, and for the front, near an edge? */
const free = (st: SfxState, s: Sfx, sc: Scene) => {
  const info = sc.words[s.word];
  const b = boxOf(s, info, sc.aspect);
  if (b.x - b.w / 2 < 0.01 || b.x + b.w / 2 > 0.99) return false;
  if (b.y - b.h / 2 < 0.01 || b.y + b.h / 2 > 0.99) return false;
  if (
    sc.face &&
    overlaps(b, { ...sc.face, w: sc.face.w * 1.35, h: sc.face.h * 1.5 })
  )
    return false;
  if (s.front) {
    // It must reach in from an edge of the screen.
    const edge =
      b.x - b.w / 2 < 0.12 ||
      b.x + b.w / 2 > 0.88 ||
      b.y - b.h / 2 < 0.12 ||
      b.y + b.h / 2 > 0.88;
    if (!edge) return false;
  } else if (!info.panel && sc.cover(b) > 0.55) {
    return false;
  }
  // Words in front may cover the background panel text.
  return [...st.items, ...(s.front ? [] : st.panels)].every(
    (o) => !overlaps(b, boxOf(o, sc.words[o.word], sc.aspect, 1.05)),
  );
};

/**
 * Place a word: tries random spots (or near `near`) and returns the item,
 * or null if nowhere fits.
 */
export const place = (
  st: SfxState,
  word: number,
  em: number,
  front: boolean,
  sc: Scene,
  near: { x: number; y: number } | null = null,
): Sfx | null => {
  const { rnd } = sc;
  const info = sc.words[word];
  // Never wider than most of the screen, nor taller than half of it.
  const fit = Math.min(em, (0.6 * sc.aspect) / info.w, 0.5 / info.h);
  for (let k = 0; k < 24; k += 1) {
    const size = fit * (k < 12 ? 1 : 0.8);
    const hw = (info.w * size) / sc.aspect / 2 + 0.012;
    const hh = (info.h * size) / 2 + 0.012;
    const s: Sfx = {
      word,
      x: near ? near.x + (rnd() - 0.5) * 0.1 : 0.08 + 0.84 * rnd(),
      y: near ? near.y + (rnd() - 0.5) * 0.1 : 0.08 + 0.84 * rnd(),
      em: size,
      turn: (rnd() - 0.5) * 0.6,
      vx: (rnd() - 0.5) * 0.02,
      vy: 0.008 + rnd() * 0.012,
      age: 0,
      hold: HOLD[info.mood] + 0.6 * rnd(),
      front,
    };
    if (near) {
      s.x = Math.min(1 - hw, Math.max(hw, s.x));
      s.y = Math.min(1 - hh, Math.max(hh, s.y));
    }
    if (info.panel) s.turn = 0;
    if (free(st, s, sc)) return s;
  }
  return null;
};

/** The words for a mood (not the panel text). */
export const wordsFor = (words: WordInfo[], mood: Mood) =>
  words
    .map((w, i) => (w.mood === mood && !w.panel ? i : -1))
    .filter((i) => i >= 0);

/** Lay out the background panel lines afresh (on each wipe-in). */
export const resetPanels = (st: SfxState, sc: Scene) => {
  const s = st;
  s.items = [];
  s.panels = [];
  const ids = sc.words.map((w, i) => (w.panel ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < SFX.panels && ids.length; i += 1) {
    const word = ids[i % ids.length];
    // Down the sides, like text at the edge of a panel.
    const left = i % 2 === 0;
    for (let k = 0; k < 10; k += 1) {
      const p: Sfx = {
        word,
        x: left ? 0.04 + 0.16 * sc.rnd() : 0.8 + 0.16 * sc.rnd(),
        y: 0.25 + 0.5 * sc.rnd(),
        em: 0.032,
        turn: 0,
        vx: 0,
        vy: 0.004,
        age: 1,
        hold: 1e9,
        front: false,
      };
      if (free(s, p, sc)) {
        s.panels.push(p);
        break;
      }
    }
  }
};

/** Shout a big word from `at` (the wipe's edge): it lands in front if it fits there. */
export const shout = (
  st: SfxState,
  sc: Scene,
  at: { x: number; y: number },
  words: number[],
) => {
  const word = pick(words, sc.rnd);
  const s =
    place(st, word, 0.16, true, sc, at) ??
    place(st, word, 0.15, false, sc, at) ??
    place(st, word, 0.13, false, sc);
  if (!s) return null;
  st.items.push(s);
  return s;
};

/**
 * One step: age everything, drop what has faded, and maybe add a word for
 * this much movement (0..1).
 */
export const stepSfx = (
  st: SfxState,
  dt: number,
  energy: number,
  sc: Scene,
) => {
  const s = st;
  s.items.forEach((it) => {
    it.age += dt;
    it.x += it.vx * dt * (1 + energy);
    it.y += it.vy * dt * (1 + energy);
  });
  s.panels.forEach((it) => {
    it.y += it.vy * dt;
    if (it.y > 0.8) it.y = 0.2;
  });
  s.items = s.items.filter((it) => it.age < SFX.pop + it.hold + SFX.fade);
  s.timer -= dt;
  s.sinceBig += dt;

  let mood: Mood | null = null;
  let em = 0;
  if (energy >= SFX.big && s.sinceBig >= SFX.bigEvery) {
    mood = "bang";
    em = 0.12 + 0.04 * energy;
    s.sinceBig = 0;
  } else if (s.timer <= 0) {
    mood = energy >= SFX.fast ? "fast" : "calm";
    em = mood === "fast" ? 0.085 + 0.04 * energy : 0.06 + 0.015 * sc.rnd();
  }
  if (!mood) return null;
  s.timer = SFX.calmEvery + (SFX.busyEvery - SFX.calmEvery) * energy;
  s.timer *= 0.8 + 0.4 * sc.rnd();
  if (s.items.length >= SFX.max) return null;
  // Mostly behind you; in front (near an edge) now and then, or when there
  // is no room behind.
  const maxFront = SFX.maxFront + (energy >= SFX.fast ? 1 : 0);
  const roomInFront = s.items.filter((it) => it.front).length < maxFront;
  // A word not already up, if there is one.
  const all = wordsFor(sc.words, mood);
  const fresh = all.filter((w) => !s.items.some((it) => it.word === w));
  const word = pick(fresh.length ? fresh : all, sc.rnd);
  const front = roomInFront && sc.rnd() < 0.25;
  const it =
    place(s, word, em, front, sc) ??
    (roomInFront && !front ? place(s, word, em, true, sc) : null);
  if (it) s.items.push(it);
  return it;
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/** How big (share of its size) and how visible a word is now. */
export const look = (it: Sfx) => {
  if (it.hold > 1e8) return { scale: 1, alpha: 0.75 };
  const pop = easeOut(it.age / SFX.pop);
  const out = clamp01((it.age - SFX.pop - it.hold) / SFX.fade);
  return {
    scale: (0.35 + 0.65 * pop) * (1 + 0.1 * easeOut(out)),
    alpha: Math.min(1, it.age / 0.05) * (1 - easeOut(out)),
  };
};
