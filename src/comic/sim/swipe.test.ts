import { describe, expect, it } from "vitest";

import { createSwipe, stepSwipe, type SwipeEvent } from "./swipe";

/** Feed a palm path at 20 fps; returns every swipe that fired. */
const run = (
  path: (t: number) => { x: number; y: number } | null,
  seconds: number,
) => {
  const d = createSwipe();
  const out: Array<SwipeEvent & { t: number }> = [];
  for (let t = 0; t <= seconds; t += 0.05) {
    const p = path(t);
    const e = stepSwipe(d, p ? [p] : [], t);
    if (e) out.push({ ...e, t });
  }
  return out;
};

describe("stepSwipe", () => {
  it("a fast sideways sweep across the screen is one swipe, the right way", () => {
    const right = run((t) => {
      const k = Math.min(1, Math.max(0, (t - 0.5) / 0.5));
      return { x: 0.15 + 0.7 * k, y: 0.5 };
    }, 2);
    expect(right).toHaveLength(1);
    expect(right[0].dir).toBe(1);
    const left = run((t) => {
      const k = Math.min(1, Math.max(0, (t - 0.5) / 0.5));
      return { x: 0.85 - 0.7 * k, y: 0.45 };
    }, 2);
    expect(left).toHaveLength(1);
    expect(left[0].dir).toBe(-1);
  });

  it("waving in place never counts", () => {
    const waves = run((t) => ({ x: 0.5 + 0.09 * Math.sin(t * 9), y: 0.5 }), 10);
    expect(waves).toHaveLength(0);
  });

  it("a slow drift across the screen never counts", () => {
    expect(run((t) => ({ x: 0.1 + 0.08 * t, y: 0.5 }), 10)).toHaveLength(0);
  });

  it("a hand moving up or down never counts", () => {
    const up = run((t) => {
      const k = Math.min(1, Math.max(0, (t - 0.5) / 0.4));
      return { x: 0.5 + 0.25 * k, y: 0.1 + 0.8 * k };
    }, 2);
    expect(up).toHaveLength(0);
  });

  it("one sweep is one swipe, and a second sweep back after a pause is another", () => {
    const events = run((t) => {
      if (t < 2) {
        const k = Math.min(1, Math.max(0, (t - 0.5) / 0.5));
        return { x: 0.15 + 0.7 * k, y: 0.5 };
      }
      const k = Math.min(1, Math.max(0, (t - 2.5) / 0.5));
      return { x: 0.85 - 0.7 * k, y: 0.5 };
    }, 4);
    expect(events.map((e) => e.dir)).toEqual([1, -1]);
  });

  it("a wave that turns back never counts after its first swing", () => {
    // A big wave: swings of 0.36 screen widths, back and forth.
    const events = run(
      (t) => ({ x: 0.5 + 0.18 * Math.sin(t * 5), y: 0.5 }),
      10,
    );
    expect(events.length).toBeLessThanOrEqual(1);
    if (events.length) expect(events[0].t).toBeLessThan(1);
  });

  it("a hand that appears already moving waits a moment before it counts", () => {
    const events = run(
      (t) => (t < 0.05 ? null : { x: 0.2 + 1.5 * t, y: 0.5 }),
      0.5,
    );
    expect(events.length).toBeLessThanOrEqual(1);
    if (events.length) expect(events[0].t).toBeGreaterThan(0.2);
  });
});
