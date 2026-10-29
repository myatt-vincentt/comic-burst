import { describe, expect, it } from "vitest";

import { boxOf, createSfx, look, place, SFX, stepSfx, type Scene } from "./sfx";

const seeded = (seed = 1) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

const scene = (cover = 0): Scene => ({
  words: [
    { mood: "calm", w: 1.5, h: 4.5 },
    { mood: "fast", w: 4, h: 1.6 },
    { mood: "bang", w: 4.2, h: 1.6 },
    { mood: "calm", w: 0.8, h: 6, panel: true },
  ],
  aspect: 9 / 16,
  face: { x: 0.5, y: 0.7, w: 0.35, h: 0.25 },
  cover: () => cover,
  rnd: seeded(7),
});

const overlaps = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

describe("sound-effect lettering", () => {
  it("calm brings few words, big movement many more (but never more than the cap)", () => {
    const count = (energy: number) => {
      const sc = scene();
      const st = createSfx();
      let most = 0;
      let total = 0;
      for (let t = 0; t < 20; t += 1 / 30) {
        if (stepSfx(st, 1 / 30, energy, sc)) total += 1;
        most = Math.max(most, st.items.length);
      }
      return { most, total };
    };
    const calm = count(0);
    const busy = count(1);
    expect(busy.total).toBeGreaterThan(calm.total * 2);
    expect(busy.most).toBeLessThanOrEqual(SFX.max);
  });

  it("never lands on the face, nor on another word", () => {
    const sc = scene();
    const st = createSfx();
    for (let t = 0; t < 30; t += 1 / 30) stepSfx(st, 1 / 30, 0.9, sc);
    for (let k = 0; k < 200; k += 1) {
      const it = place(st, 1, 0.1, k % 2 === 0, sc);
      if (it) {
        const b = boxOf(it, sc.words[1], sc.aspect);
        expect(overlaps(b, sc.face as ReturnType<typeof boxOf>)).toBe(false);
        st.items.forEach((o) =>
          expect(overlaps(b, boxOf(o, sc.words[o.word], sc.aspect))).toBe(
            false,
          ),
        );
      }
    }
  });

  it("keeps words behind you where they stay visible", () => {
    const st = createSfx();
    expect(place(st, 1, 0.1, false, scene(0.9))).toBeNull();
    expect(place(st, 1, 0.1, true, scene(0.9))).not.toBeNull();
  });

  it("pops in with a strict ease-out (never above full size) and fades away", () => {
    const st = createSfx();
    const it = place(st, 2, 0.1, false, scene());
    expect(it).not.toBeNull();
    if (!it) return;
    let prev = 0;
    for (let t = 0; t <= SFX.pop; t += 0.01) {
      it.age = t;
      const { scale } = look(it);
      expect(scale).toBeGreaterThanOrEqual(prev);
      expect(scale).toBeLessThanOrEqual(1);
      prev = scale;
    }
    it.age = SFX.pop + it.hold + SFX.fade;
    expect(look(it).alpha).toBeCloseTo(0, 3);
  });
});
