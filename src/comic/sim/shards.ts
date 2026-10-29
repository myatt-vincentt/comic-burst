// Shards flying off the wipe's edge — pure. While the edge crosses the
// screen it throws small sharp triangles ahead of itself, which spin, slow
// down and shrink away (strict ease-out). Screen uv, sizes in screen heights.

export type Shard = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  turn: number;
  spin: number;
  size: number;
  stretch: number;
  /** Palette index (uPal) and age / life in seconds; life 0 = free. */
  col: number;
  age: number;
  life: number;
};

/** The palette entries the shards use: stripe, rims, two shapes. */
const COLOURS = [13, 13, 11, 12, 2, 3];

export const createShards = (n: number): Shard[] =>
  Array.from({ length: n }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    turn: 0,
    spin: 0,
    size: 0,
    stretch: 1,
    col: 13,
    age: 0,
    life: 0,
  }));

/**
 * One step. While `edge` (uv x, or null) is on screen, `rate` shards a second
 * are thrown in `dir`. `budget` carries the fractional spawn count over.
 */
export const stepShards = (
  list: Shard[],
  dt: number,
  edge: number | null,
  dir: number,
  rate: number,
  budget: { carry: number },
  rnd: () => number = Math.random,
) => {
  const b = budget;
  if (edge !== null && edge > -0.05 && edge < 1.05) {
    b.carry += rate * dt;
  } else {
    b.carry = 0;
  }
  list.forEach((s) => {
    if (s.life > 0) {
      s.age += dt;
      if (s.age >= s.life) {
        s.life = 0;
        return;
      }
      const drag = Math.exp(-2.4 * dt);
      s.vx *= drag;
      s.vy *= drag;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.turn += s.spin * dt;
    } else if (b.carry >= 1 && edge !== null) {
      b.carry -= 1;
      const y = rnd();
      s.x = edge + (y - 0.5) * 0.12 * dir + (rnd() - 0.5) * 0.03;
      s.y = y;
      const speed = 0.35 + 0.9 * rnd();
      s.vx = dir * speed;
      s.vy = (rnd() - 0.5) * 0.7;
      s.turn = rnd() * Math.PI * 2;
      s.spin = (rnd() - 0.5) * 14;
      s.size = 0.012 + 0.026 * rnd();
      s.stretch = 1.3 + 1.8 * rnd();
      s.col = COLOURS[Math.floor(rnd() * COLOURS.length)];
      s.age = 0;
      s.life = 0.45 + 0.4 * rnd();
    }
  });
};

/** How big a shard is now (shrinks away with a strict ease-out). */
export const shardScale = (s: Shard) => {
  if (s.life <= 0) return 0;
  const t = Math.min(1, s.age / s.life);
  return 1 - t * t;
};
