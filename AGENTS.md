# Dawnfolk

A god game about the first tribes on a floating island, in TypeScript with
three.js WebGPU and React. [README](README.md#architecture) has the code map,
and [CONTRIBUTING.md](CONTRIBUTING.md) the commands, checks, code style,
commits and pull requests; follow both. This file adds what is easy to miss.

## Seeing a change

- Rendering changes are verified by looking, not by tests alone. Open a
  reproducible scene with URL parameters, such as
  `?seed=7&shape=round&quality=high&paused=1&hours=11&camera=x,z,distance,pitch,yaw`,
  and compare screenshots before and after at 1440×900, 768×1024 and 390×844.
- Look at a distant view too. Water, terrain and vegetation switch level of
  detail by distance, and most visual bugs show up only far away or only
  close.
- Headless Chromium with `--use-angle=swiftshader` renders in software:
  colors, speed and some WebGPU paths differ from a GPU. Prefer
  `--use-angle=metal --enable-gpu` with a system Chrome on a Mac, and say which
  one you used.
- In development the engine is on `window.dawnfolk`: `session.frame` has the
  tribes, weather and calendar, `camera` the view, and `powers` the active
  tool.
- Keep screenshots in a temporary folder, not in the repository; README
  images live in `.github/screenshots`.

## Rules that are easy to miss

- The engine never imports React, and the simulation never imports
  rendering; `noRestrictedImports` overrides in `biome.jsonc` enforce both.
  The UI reads the session through small Zustand stores and sends commands,
  which zod validates at the worker boundary.
- Generation and the simulation are deterministic for a seed. Draw their
  randomness from a `RandomSource` or `hashToUnit`, never `Math.random`, and
  keep the order of random draws stable: tests pin worlds by seed. Only
  rendering effects and the default seed may use `Math.random`.
- Water is one rule everywhere: `hasWater` and `touchesWaterCell` in
  `src/world`. Planting, regrowth, grass and the water shader must agree on it,
  or plants stand in rivers.
- Terrain and water share their level of detail per patch. A shader that reads
  a neighbour cell must account for the patch step, or far views break.
- The island edge is one outline per shape, in
  `rendering/terrain/island-outline.ts`. Terrain, water, grass and rain are cut
  by it, and the cliff top breaks at every terrain edge it crosses, so the
  ground and the cliff meet at any level of detail. Plants keep clear of the
  coast through `hasRoomFromCoast`.
- Shaders are TSL node graphs in TypeScript. Keep large numbers out of float
  hashes: float32 loses precision past 16 million and patterns line up.
- The engine projects compile with `noUncheckedIndexedAccess` off for typed
  arrays; the app keeps it on.
- Game things (powers, resources, buildings, weather, events) use
  `design/game-icon.tsx` with the painted 128×128 WebP icons in `design/icons`;
  keep their colors and commit only the final WebP, not masters. Interface
  controls use `lucide-react` and take the text color; don't tint them.
- The interface is islands from `design/island.tsx`. Panels people read, such
  as the status card, the side panel, dialogs and notices, are solid paper so
  text reads over any terrain; only the power dock and the minimap use
  `surface="glass"` from `@svidskiy/glass-surface-react`. Every island in a row
  has the same height.
- Commits carry no trailers such as `Co-authored-by:`, and a pull request body
  ends with `Verified:` and the checks you ran, then `Fixes #N` when it closes
  an issue. The rest is in [Commits](CONTRIBUTING.md#commits) and
  [Pull requests](CONTRIBUTING.md#pull-requests).
