# Plan

Comic Burst: swipe a hand sideways across the screen and the room wipes into a pop-art comic
world behind your hand. Swipe again to wipe back.

## How it works

- **Swipe.** The SDK hand tracker (20 fps) gives each palm's centre in screen space (the webcam
  picture is already mirrored, so the wipe follows the hand you see). A swipe is the palm's latest
  one-way run: at least a third of the screen's width, at least 0.75 widths a second, mostly
  level, and starting from rest (no turn-back just before it). Waving turns back every swing, so
  it never counts. After a swipe the hand must slow down and 0.9 s must pass before the next.
- **Touch.** On a touch screen a quick sideways finger swipe does the same.
- **Wipe.** The new world comes in behind the hand: the edge runs just ahead of the palm while
  it leads, then finishes the sweep on its own with a strict ease-out. The edge is jagged (big
  zigzag teeth with fine ones, new for each wipe, slightly slanted), with an ink line, a bright
  stripe and a thinner rim-coloured one behind it, and small shards thrown ahead of it.
- **You.** The portrait mask, trusted only around the tracked face (head and the body below it)
  and each tracked hand and forearm, held over a few frames with hysteresis so the outline never
  flickers or leaves islands; with no face for two seconds the mask is trusted everywhere. Your
  own light is cut into four flat bands of the palette's dark tones, relative to your mean and
  spread, so eyes, brows, mouth and hair fall in the darkest band. Ink lines on strong edges,
  halftone dots in the middle band, a thin ink outline, and a thick rim (inner colour, outer
  colour broken in two along it, an ink line outside), nudged to one side like a misprint.
- **World.** A flat base with wedge burst rays turning round a centre behind your head, drifting
  halftone dot fields, eight big angular shapes with offset print shadows (some filled with
  dots), and 3D cubes, long shards and confetti triangles flying out of the burst toward you with
  flat toon shading. Some confetti flies in front of you.
- **Movement.** The frame difference on you (brightness and outline) from a 64 × 36 read-back
  taken without stalling, and the fastest palm. It rises quickly and settles slowly. Still: a
  slow drift. Moving: the rays turn faster and widen, more light up, shapes pulse, the pieces
  rush out and spin faster, and the colours hand over one by one in slow fades (never more than
  about one change a second, so nothing flashes). The world's arrival adds a short burst of
  energy.
- **Lettering.** Manga sound effects (ドドドド, ゴゴゴゴ, バーン, ドン, ズドーン, キラーン, シュッ, ワクワク,
  ザワザワ, POW!, BOOM!, WOW!) in slanted chunky letters with an ink outline, an outer stroke, a
  stepped extrusion and, for some, speed lines, in the palette's colours; plus four small vertical
  lines of panel text down the sides. Each pops in with a quick strict ease-out punch, holds while
  drifting, and fades. Calm: a quiet word now and then. Moving: more, louder and bigger words; a
  big move shouts a big one. The wipe-in always shouts a big one from the wipe's edge. At most six
  are up at once, behind you only where they stay visible, and up to two (three when moving a lot)
  in front, reaching in from a screen edge. None ever lands on your face.
- **Palettes.** Neon pop, sunset, mint and red, and manga (black and white with red). Each new
  wipe-in takes the next.
- **Hint.** A small see-through ghost hand low in the centre sweeps sideways, one way then the
  other. It steps aside while the comic world is on and goes for good after the first real wipe.
- **Full screen.** The picture fills the whole window (`src/App.tsx` swaps the 9:16 frame for a
  full-window container).

## Development

- Without a webcam, the preview starts on the SDK's sample media.
- Keys: `W` wipes in or out, `P` next palette, `M` pretends big movement (press again for the
  measured movement).
- `window.__comic` (development only): `phase`, `palette`, `motion`, `swipe`, `log`, `state`, and
  `wipe(dir)`, `setPalette(i)`, `setMotion(v | null)`.
