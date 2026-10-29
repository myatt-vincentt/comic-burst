# Comic Burst

Swipe a hand sideways across the screen and the room wipes into a pop-art comic world behind
your hand, along a jagged, energetic edge with a bright stripe and flying shards. You become a
flat, posterised cut-out in deep tones with a thick two-colour rim, in front of radial burst
rays, halftone dots, big angular shapes and tumbling 3D cubes and shards. Manga sound-effect
lettering pops up around you (never over your face). Move and it all answers: the bursts flare,
shapes pulse, cubes spin faster, the colours slowly shift and the lettering gets louder. Swipe
again, either way, to wipe back to the room. On a touch screen a finger swipe does the same. Each
new wipe-in takes the next of four palettes: neon pop, sunset, mint and red, manga. The picture
fills the whole screen.

- Thumbnail: `public/images/comic-burst-thumbnail.jpg` (the share image).
- The swipe: palm x from the SDK hand tracker; a swipe is one long, fast, level run that starts
  from rest, so waving never counts (`src/comic/sim/swipe.ts`). The wipe follows the hand and
  finishes on its own (`sim/wipe.ts`).
- The world and you are full-screen shaders (`src/comic/World.tsx`, `shaders.ts`): the camera
  picture or the pop-art world, your cut-out from the portrait mask, trusted only around the
  tracked face and hands and steadied over frames (`sim/gate.ts`, `steadyFrag`), and the wipe's
  edge. The 3D pieces are `Flyers.tsx`; the edge shards `EdgeShards.tsx`.
- Movement is the frame difference on you plus palm speed, read back from a tiny copy of the
  picture without stalling (`sim/motion.ts`); it is smoothed so nothing strobes.
- The lettering is painted per palette into one canvas atlas (`words.ts`) and placed by
  `sim/sfx.ts` (`Lettering.tsx`). The font is a small subset of Dela Gothic One shipped in
  `public/fonts` (SIL OFL, see `CREDITS.md`).
- The hint is the SDK's ghost hand sweeping sideways (`Hint.tsx`, `public/models/hand-v1.glb`,
  CC BY, see `CREDITS.md`).
- `src/App.tsx` uses a full-window container instead of the 9:16 frame; re-apply after a template
  upgrade.
- Dev preview without a camera: the media switcher starts on the SDK's sample video. Keys: `W`
  wipes in or out, `P` next palette, `M` pretends big movement. `window.__comic` shows the state,
  palette, movement and swipe numbers. How it works: `PLAN.md`.

---

# v2-template

The Vincentt starter app: a real React + R3F + Vincentt XR SDK (`@vincentt-xr/sdk`)
WebXR app, bundled by esbuild.

## Shape

```
src/
  main.tsx            mount — never edited
  App.tsx             protected shell: XRProvider + AspectRatioContainer +
                      XRScene + media-source binding, camera, lighting,
                      VideoBackground, PreviewAnchors — never edited
  Scene.tsx           the agent's surface: add SDK components and R3F
                      primitives here
  PreviewAnchors.tsx  editor-preview integration — never edited
```

See `AGENTS.md` and `GROUNDING.md` for the API reference and how to author scenes.

## Develop

```
pnpm install
pnpm dev          # esbuild dev server on localhost:5173 (output in .dev/)
pnpm preview      # on-device preview over a secure tunnel (needs `vincentt login`)
pnpm typecheck
pnpm build        # production bundle to dist/
```

## Release

`vincentt init` scaffolds from the **`latest` tag**, not from `main`. Merging to `main` does
not ship a template to creators — cutting a release does.

```
git tag 1.1.0 <sha>      # bare semver, no `v` prefix
git push origin 1.1.0    # the Release workflow verifies the tag, then moves `latest`
```

The Release workflow (`.github/workflows/release.yml`) installs from the frozen lockfile,
builds, and typechecks **the tagged tree** before force-updating `latest` to it. A tag that
fails leaves `latest` where it was, so a broken release cannot reach a new creator.

The job runs in the `release` environment, which accepts bare-semver tags only. To re-run it by
hand, dispatch it from the tag itself ("Use workflow from: 1.1.0"); a dispatch from `main` is
refused.

**Never move `latest` by hand.** It is force-updated by that workflow and nowhere else; moving
it manually decouples the pointer from the version it claims to be.

Creators can pin a specific version — `vincentt init --template 1.0.0` — which is the escape
hatch when a release turns out to be bad. That is why the version tags are immutable and only
`latest` moves.

### `MIGRATION.md` and the platform release row

Root `MIGRATION.md` carries one entry per released tag, newest first, authored in the same
PR as the change: `required: true|false`, a one-line summary, and optional notes bullets.
`required: false` means no consumer action is needed, never that the entry was skipped. The
Release workflow refuses to move `latest` for a tag with no valid entry, then — once `latest`
has moved — posts that entry as this release's row to the platform (`POST
/platform/releases`, component `template`), via `scripts/release-row.mjs`. Both steps read
`MIGRATION.md` from `main`, not from the tagged tree: the note is reviewed via PR into `main`
and is append-only per version, so `main`'s copy is the reviewed source for any tag, including
one cut before this file existed. That row is what `vincentt outdated` reads back to tell a
creator's agent what changed and what to do about it.
