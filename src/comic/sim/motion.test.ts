import { describe, expect, it } from "vitest";

import { createMotion, readFrame, stepMotion } from "./motion";

const frame = (lum: (i: number) => number, mask: (i: number) => number) => {
  const px = new Uint8Array(64 * 36 * 4);
  for (let i = 0; i < 64 * 36; i += 1) {
    px[i * 4] = Math.round(lum(i) * 255);
    px[i * 4 + 1] = Math.round(mask(i) * 255);
    px[i * 4 + 3] = 255;
  }
  return px;
};
const half = (i: number) => (i % 64 < 32 ? 1 : 0);

describe("motion", () => {
  it("a still person is calm", () => {
    const m = createMotion();
    for (let k = 0; k < 30; k += 1) {
      readFrame(
        m,
        frame(() => 0.5, half),
        0.05,
      );
      stepMotion(m, 0, 0.05);
    }
    expect(m.raw).toBe(0);
    expect(m.level).toBeLessThan(0.01);
  });

  it("a moving person raises the level, which settles slowly afterwards", () => {
    const m = createMotion();
    for (let k = 0; k < 30; k += 1) {
      const shift = k % 2 ? 8 : 0;
      readFrame(
        m,
        frame(
          (i) => ((i + shift) % 7) / 7,
          (i) => ((i % 64) + shift < 32 ? 1 : 0),
        ),
        0.05,
      );
      stepMotion(m, 0, 0.05);
    }
    expect(m.level).toBeGreaterThan(0.6);
    const before = m.level;
    readFrame(
      m,
      frame(() => 0.5, half),
      0.05,
    );
    readFrame(
      m,
      frame(() => 0.5, half),
      0.05,
    );
    stepMotion(m, 0, 0.05);
    expect(m.level).toBeGreaterThan(before * 0.9);
  });

  it("measures the person's light", () => {
    const m = createMotion();
    for (let k = 0; k < 60; k += 1)
      readFrame(
        m,
        frame((i) => (i % 2 ? 0.3 : 0.7), half),
        0.05,
      );
    expect(m.light.mean).toBeCloseTo(0.5, 1);
    expect(m.light.spread).toBeCloseTo(0.2, 1);
    expect(m.light.area).toBeCloseTo(0.5, 2);
  });

  it("a fast hand counts as movement", () => {
    const m = createMotion();
    for (let k = 0; k < 20; k += 1) stepMotion(m, 3, 0.05);
    expect(m.level).toBeGreaterThan(0.6);
  });
});
