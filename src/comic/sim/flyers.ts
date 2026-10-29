// The flying 3D pieces — pure. Each one starts far away near the burst's
// centre and flies outward and toward you, tumbling, then starts again.
// Movement makes them fly and spin faster. World units; the camera sits at
// z = 5 looking down −z with a 45° field of view.

export type Flyer = {
  x: number;
  y: number;
  z: number;
  /** Sideways drift per unit of z travelled. */
  dx: number;
  dy: number;
  /** Own pace (multiplies the shared speed) and tumble. */
  pace: number;
  ax: number;
  ay: number;
  az: number;
  angle: number;
  spin: number;
  size: number;
  /** Colour slot (0..4, fractional is fine: it offsets the colour cycle). */
  slot: number;
  /** A little side-to-side flutter (confetti). */
  flutter: number;
  phase: number;
};

const FAR = -9;
const NEAR = 3.6;
const TAN = Math.tan((22.5 * Math.PI) / 180);

/** Half the visible height at depth z. */
export const halfHeight = (z: number) => (5 - z) * TAN;

export type FlyerKind = { size: [number, number]; flutter: number };

const spawn = (
  f: Flyer,
  kind: FlyerKind,
  centre: { x: number; y: number },
  aspect: number,
  rnd: () => number,
  anywhere: boolean,
) => {
  const theta = rnd() * Math.PI * 2;
  const spread = 0.22 + 0.4 * rnd();
  const h = halfHeight(FAR);
  f.z = anywhere ? FAR + (NEAR - FAR) * rnd() : FAR;
  const r0 = 0.6 + 2.6 * rnd();
  // The burst's centre, at the far depth.
  const cx = (centre.x - 0.5) * 2 * h * aspect;
  const cy = (centre.y - 0.5) * 2 * h;
  f.dx = Math.cos(theta) * spread;
  f.dy = Math.sin(theta) * spread;
  f.x = cx + Math.cos(theta) * r0 + f.dx * (f.z - FAR);
  f.y = cy + Math.sin(theta) * r0 + f.dy * (f.z - FAR);
  f.pace = 0.7 + 0.6 * rnd();
  const ax = rnd() - 0.5;
  const ay = rnd() - 0.5;
  const az = rnd() - 0.5;
  const n = Math.hypot(ax, ay, az) || 1;
  f.ax = ax / n;
  f.ay = ay / n;
  f.az = az / n;
  f.angle = rnd() * Math.PI * 2;
  f.spin = (0.25 + 0.5 * rnd()) * (rnd() < 0.5 ? -1 : 1);
  f.size = kind.size[0] + (kind.size[1] - kind.size[0]) * rnd();
  f.slot = Math.floor(rnd() * 4) + rnd() * 0.3;
  f.flutter = kind.flutter * (0.5 + rnd());
  f.phase = rnd() * Math.PI * 2;
};

export const createFlyers = (
  n: number,
  kind: FlyerKind,
  aspect: number,
  rnd: () => number = Math.random,
) =>
  Array.from({ length: n }, () => {
    const f = {} as Flyer;
    spawn(f, kind, { x: 0.5, y: 0.55 }, aspect, rnd, true);
    return f;
  });

/**
 * One step for every piece. `speed` is the shared pace (world units per
 * second along z), `spinRate` multiplies the tumble.
 */
export const stepFlyers = (
  list: Flyer[],
  kind: FlyerKind,
  dt: number,
  speed: number,
  spinRate: number,
  centre: { x: number; y: number },
  aspect: number,
  rnd: () => number = Math.random,
) => {
  list.forEach((f) => {
    const dz = speed * f.pace * dt;
    f.z += dz;
    f.x += f.dx * dz;
    f.y += f.dy * dz;
    f.angle += f.spin * spinRate * dt;
    f.phase += dt * 2.2;
    const h = halfHeight(f.z);
    const out =
      f.z > NEAR ||
      Math.abs(f.x) > h * aspect + f.size * 2 ||
      Math.abs(f.y) > h + f.size * 2;
    if (out) spawn(f, kind, centre, aspect, rnd, false);
  });
};
