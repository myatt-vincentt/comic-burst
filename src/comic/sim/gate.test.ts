import { describe, expect, it } from "vitest";

import { buildCapsules, createCapsules, MAX_CAPSULES } from "./gate";

const hand = (cx: number, cy: number) =>
  Array.from({ length: 21 }, (_, i) => ({
    x: cx + (i % 5) * 0.01,
    y: cy + Math.floor(i / 5) * 0.02,
  }));

describe("buildCapsules", () => {
  it("makes the bones, palm and forearm of each hand", () => {
    const c = buildCapsules(createCapsules(), [hand(0.3, 0.4)], [], 9 / 16);
    expect(c.count).toBe(17 + 7 + 1);
    const radii = Array.from(c.radius.slice(0, c.count));
    expect(radii.every((r) => r > 0)).toBe(true);
  });

  it("never holds more than it can draw", () => {
    const c = buildCapsules(
      createCapsules(),
      [hand(0.3, 0.4), hand(0.6, 0.4)],
      [{ x: 0.5, y: 0.5 }],
      1,
    );
    expect(c.count).toBeLessThanOrEqual(MAX_CAPSULES);
  });

  it("no hands, no capsules", () => {
    expect(buildCapsules(createCapsules(), [], [], 1).count).toBe(0);
  });
});
