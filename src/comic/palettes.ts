// The four palettes. Each new wipe into the comic world takes the next one.
// Colours are sRGB hex; `toLinear` turns a palette into the 14 linear
// colours the shaders read (uPal).

import { Color } from "three";

export type Palette = {
  name: string;
  /** The world's base fill and the colour of every other burst ray. */
  base: string;
  ray: string;
  /** The big shapes, the cubes and the confetti (cycled with movement). */
  shapes: [string, string, string, string];
  /** Dots, drop shadows and outlines. */
  ink: string;
  /** The person, darkest to lightest band. */
  person: [string, string, string, string];
  /** The rim around the person: inside, outside. */
  rim: [string, string];
  /** The bright stripe on the wipe's edge. */
  stripe: string;
  /** The sound-effect lettering: fill colours, outline and outer stroke. */
  letters: { fills: [string, string, string]; outline: string; outer: string };
};

export const PALETTES: Palette[] = [
  {
    name: "neon pop",
    base: "#FFE600",
    ray: "#FF8A1F",
    shapes: ["#FF2E88", "#1E6BFF", "#20D3FF", "#7B2CFF"],
    ink: "#1A0848",
    person: ["#100536", "#251070", "#3B2BD0", "#7466F0"],
    rim: ["#FF7A1A", "#FFE600"],
    stripe: "#FFFFFF",
    letters: {
      fills: ["#FFE600", "#FF2E88", "#20D3FF"],
      outline: "#1A0848",
      outer: "#FFFFFF",
    },
  },
  {
    name: "sunset",
    base: "#FFB07A",
    ray: "#FF7B29",
    shapes: ["#E0218A", "#6A1B9A", "#FFD3B5", "#FF4F5E"],
    ink: "#2B0A3D",
    person: ["#1C0528", "#3E0F5C", "#6C1F86", "#A6479A"],
    rim: ["#FF7B29", "#FFD3B5"],
    stripe: "#FFF3E6",
    letters: {
      fills: ["#FFE0C2", "#E0218A", "#FFB703"],
      outline: "#2B0A3D",
      outer: "#FFF3E6",
    },
  },
  {
    name: "mint and red",
    base: "#FFF4DC",
    ray: "#A8F0DA",
    shapes: ["#FF4D4D", "#3EDBB0", "#14213D", "#1FA38A"],
    ink: "#14213D",
    person: ["#0A1024", "#14213D", "#24406E", "#4E78A8"],
    rim: ["#FF4D4D", "#FFF4DC"],
    stripe: "#FFFFFF",
    letters: {
      fills: ["#FF4D4D", "#3EDBB0", "#FFF4DC"],
      outline: "#14213D",
      outer: "#FFFFFF",
    },
  },
  {
    name: "manga",
    base: "#FFFFFF",
    ray: "#D9D9D9",
    shapes: ["#111111", "#E5202E", "#9A9A9A", "#2A2A2A"],
    ink: "#111111",
    person: ["#0A0A0A", "#3A3A3A", "#8A8A8A", "#E6E6E6"],
    rim: ["#E5202E", "#111111"],
    stripe: "#E5202E",
    letters: {
      fills: ["#FFFFFF", "#111111", "#E5202E"],
      outline: "#111111",
      outer: "#FFFFFF",
    },
  },
];

/** Colours per palette, in the order the shaders read them. */
export const PAL_SIZE = 14;

/** The palette as linear RGB, in uPal order: base, ray, 4 shapes, ink, 4 person bands, 2 rims, stripe. */
export const toLinear = (p: Palette): Color[] =>
  [p.base, p.ray, ...p.shapes, p.ink, ...p.person, ...p.rim, p.stripe].map(
    (hex) => new Color(hex),
  );
