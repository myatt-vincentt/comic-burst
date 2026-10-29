// The manga sound-effect lettering: the words, and how they are painted.
// Every word is painted once per palette into one canvas atlas — slanted,
// chunky letters with a thick ink outline, an outer stroke, a stepped
// extrusion and, for some, speed lines behind — and the screen draws pieces
// of that atlas (Lettering.tsx). Generic sound effects only.
import { Color } from "three";

import type { Palette } from "./palettes";

/** When a word is used: calm (any time), fast (big movement), bang (a big move or the wipe). */
export type Mood = "calm" | "fast" | "bang";

export type Word = {
  text: string;
  vertical: boolean;
  mood: Mood;
  /** Speed lines behind it. */
  lines: boolean;
  /** Which of the palette's lettering fills (0..2). */
  fill: number;
  /** Small, flat panel text in the background (not a sound effect). */
  panel?: boolean;
};

export const WORDS: Word[] = [
  { text: "ドドドド", vertical: true, mood: "fast", lines: true, fill: 1 },
  { text: "ゴゴゴゴ", vertical: true, mood: "calm", lines: false, fill: 2 },
  { text: "バーン", vertical: false, mood: "bang", lines: true, fill: 0 },
  { text: "ドン", vertical: false, mood: "bang", lines: false, fill: 2 },
  { text: "ズドーン", vertical: false, mood: "bang", lines: true, fill: 1 },
  { text: "キラーン", vertical: false, mood: "calm", lines: false, fill: 0 },
  { text: "シュッ", vertical: false, mood: "fast", lines: true, fill: 2 },
  { text: "ワクワク", vertical: true, mood: "calm", lines: false, fill: 1 },
  { text: "ザワザワ", vertical: true, mood: "calm", lines: false, fill: 0 },
  { text: "POW!", vertical: false, mood: "fast", lines: true, fill: 0 },
  { text: "BOOM!", vertical: false, mood: "bang", lines: true, fill: 2 },
  { text: "WOW!", vertical: false, mood: "fast", lines: false, fill: 1 },
  // Small vertical lines of panel text in the background.
  {
    text: "ザワ…ザワ…",
    vertical: true,
    mood: "calm",
    lines: false,
    fill: 0,
    panel: true,
  },
  {
    text: "ゴゴゴゴゴ",
    vertical: true,
    mood: "calm",
    lines: false,
    fill: 0,
    panel: true,
  },
  {
    text: "ドドドドド",
    vertical: true,
    mood: "calm",
    lines: false,
    fill: 0,
    panel: true,
  },
  {
    text: "ワクワク…",
    vertical: true,
    mood: "calm",
    lines: false,
    fill: 0,
    panel: true,
  },
];

/** Which words the wipe-in may shout. */
export const WIPE_WORDS = [2, 3, 4];

/** The font's family name once loaded (public/fonts, SIL OFL). */
export const FONT_FAMILY = "ComicBurstSfx";
export const FONT_URL = "/fonts/DelaGothicOne-sfx.woff2";

/** Size of one em in the atlas (pixels), for the sound effects and the panel text. */
const EM = 112;
const PANEL_EM = 56;
const ATLAS_W = 2048;
/** Italic slant (x per y). */
const SLANT = 0.24;

/** Where a word sits in the atlas: uv rectangle (y up) and its size in ems. */
export type Cell = {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  w: number;
  h: number;
};

/** Characters turned a quarter turn when written top to bottom. */
const TURN = new Set(["ー", "…"]);
/** Small kana sit up and to the right in a vertical line. */
const SMALL = new Set(["ッ", "ュ"]);

const luminance = (hex: string) => {
  const c = new Color(hex);
  c.convertLinearToSRGB();
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
};

const lighten = (hex: string, k: number) =>
  `#${new Color(hex).lerp(new Color("#ffffff"), k).getHexString()}`;

/** A word's box in pixels (before packing), including strokes and extrusion. */
const measure = (ctx: CanvasRenderingContext2D, w: Word) => {
  const em = w.panel ? PANEL_EM : EM;
  ctx.font = `${em}px ${FONT_FAMILY}`;
  const pad = Math.round(em * (w.panel ? 0.2 : 0.42));
  if (w.vertical) {
    const n = [...w.text].length;
    return {
      em,
      pad,
      w: Math.round(em * 1.15 + pad * 2),
      h: Math.round(n * em * 1.02 + pad * 2),
    };
  }
  const tw = ctx.measureText(w.text).width;
  return {
    em,
    pad,
    w: Math.round(tw + em * SLANT + pad * 2),
    h: Math.round(em * 1.2 + pad * 2),
  };
};

/** Draw the word's letters (text path only) at the cell's origin. */
const letters = (
  ctx: CanvasRenderingContext2D,
  w: Word,
  em: number,
  draw: (s: string, x: number, y: number) => void,
) => {
  if (!w.vertical) {
    draw(w.text, 0, em * 0.95);
    return;
  }
  [...w.text].forEach((ch, i) => {
    const cy = i * em * 1.02 + em * 0.5;
    ctx.save();
    if (TURN.has(ch)) {
      ctx.translate(em * 0.55, cy);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-em * 0.5, em * 0.36);
      draw(ch, 0, 0);
    } else {
      const small = SMALL.has(ch) ? em * 0.12 : 0;
      ctx.translate(small, -small);
      draw(ch, 0, cy + em * 0.36);
    }
    ctx.restore();
  });
};

/** Speed lines behind a word: tapered streaks along its length. */
const speedLines = (
  ctx: CanvasRenderingContext2D,
  w: Word,
  bw: number,
  bh: number,
  colour: string,
) => {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.75;
  const n = 11;
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / n;
    const len = 0.45 + (0.5 * ((i * 7919) % 13)) / 13;
    const thick = 2 + ((i * 31) % 5);
    ctx.beginPath();
    if (w.vertical) {
      const x = bw * t;
      ctx.moveTo(x - thick, 0);
      ctx.lineTo(x + thick, 0);
      ctx.lineTo(x, bh * len);
    } else {
      const y = bh * t;
      ctx.moveTo(bw, y - thick);
      ctx.lineTo(bw, y + thick);
      ctx.lineTo(bw * (1 - len), y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

/**
 * Paint every word for this palette into `canvas` (resized as needed) and
 * return where each one is.
 */
export const paintAtlas = (canvas: HTMLCanvasElement, p: Palette): Cell[] => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const boxes = WORDS.map((w) => measure(ctx, w));
  // Shelf packing.
  let x = 0;
  let y = 0;
  let row = 0;
  const at = boxes.map((b) => {
    if (x + b.w > ATLAS_W) {
      x = 0;
      y += row + 2;
      row = 0;
    }
    const pos = { x, y };
    x += b.w + 2;
    row = Math.max(row, b.h);
    return pos;
  });
  const H = y + row;
  const target = canvas;
  target.width = ATLAS_W;
  target.height = H;
  ctx.clearRect(0, 0, ATLAS_W, H);
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const { letters: L } = p;
  WORDS.forEach((w, i) => {
    const b = boxes[i];
    const o = at[i];
    const fill = L.fills[w.fill];
    // A dark fill takes a light outline (the manga palette's black letters).
    const darkFill = luminance(fill) < 0.25;
    const outline = darkFill ? L.outer : L.outline;
    const outer = darkFill ? L.outline : L.outer;
    ctx.save();
    ctx.beginPath();
    ctx.rect(o.x, o.y, b.w, b.h);
    ctx.clip();
    ctx.font = `${b.em}px ${FONT_FAMILY}`;
    ctx.translate(o.x, o.y);
    if (w.lines) speedLines(ctx, w, b.w, b.h, outline);
    ctx.translate(b.pad, b.pad);
    if (!w.vertical) ctx.transform(1, 0, -SLANT, 1, SLANT * b.em, 0);
    else ctx.transform(1, SLANT * 0.35, 0, 1, 0, 0);
    if (w.panel) {
      ctx.lineWidth = b.em * 0.22;
      ctx.strokeStyle = p.stripe;
      letters(ctx, w, b.em, (s, lx, ly) => ctx.strokeText(s, lx, ly));
      ctx.fillStyle = p.ink;
      letters(ctx, w, b.em, (s, lx, ly) => ctx.fillText(s, lx, ly));
      ctx.restore();
      return;
    }
    // Extrusion: the letters stepped down and to the side in the outline colour.
    const depth = Math.round(b.em * 0.09);
    ctx.lineWidth = b.em * 0.2;
    ctx.strokeStyle = outline;
    ctx.fillStyle = outline;
    for (let d = depth; d >= 1; d -= 1) {
      ctx.save();
      ctx.translate(d * 0.8, d);
      letters(ctx, w, b.em, (s, lx, ly) => {
        ctx.strokeText(s, lx, ly);
        ctx.fillText(s, lx, ly);
      });
      ctx.restore();
    }
    // Outer stroke, ink outline, then the fill (lighter at the top).
    ctx.strokeStyle = outer;
    ctx.lineWidth = b.em * 0.2;
    letters(ctx, w, b.em, (s, lx, ly) => ctx.strokeText(s, lx, ly));
    ctx.strokeStyle = outline;
    ctx.lineWidth = b.em * 0.08;
    letters(ctx, w, b.em, (s, lx, ly) => ctx.strokeText(s, lx, ly));
    const g = ctx.createLinearGradient(0, 0, 0, w.vertical ? b.h : b.em);
    g.addColorStop(0, darkFill ? fill : lighten(fill, 0.35));
    g.addColorStop(0.55, fill);
    ctx.fillStyle = g;
    letters(ctx, w, b.em, (s, lx, ly) => ctx.fillText(s, lx, ly));
    ctx.restore();
  });

  return WORDS.map((_, i) => {
    const b = boxes[i];
    const o = at[i];
    return {
      u0: o.x / ATLAS_W,
      u1: (o.x + b.w) / ATLAS_W,
      // The texture is flipped: y up.
      v0: 1 - (o.y + b.h) / H,
      v1: 1 - o.y / H,
      w: b.w / b.em,
      h: b.h / b.em,
    };
  });
};
