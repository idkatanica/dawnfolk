# Dawnfolk

A god game about the first tribes on a floating island, in TypeScript with three.js and React. The
[README](README.md#architecture) has the code map, and [CONTRIBUTING.md](CONTRIBUTING.md) has the code style,
commits, pull requests and releases. This file lists what agents tend to miss.

## Commands

```sh
bun run check      # Biome lint and format; bun run fix applies fixes
bun run typecheck  # tsc --build over the engine, app and tooling projects
bun run test       # unit tests in Node, browser tests in Chromium
```

- Run all three before you push. Browser tests need Chromium; [Scripts and checks](CONTRIBUTING.md#scripts-and-checks)
  shows how to point them at a system one.
- Run one area with `bunx vitest run --project unit src/generation`.
- Merging to `main` deploys playdawnfolk.com. Leave merges and [releases](CONTRIBUTING.md#releases) to a person
  unless they ask.

## Seeing a change

- Visible changes are checked by looking. Open a reproducible scene, such as
  `?seed=7&shape=round&quality=high&paused=1&hours=11&camera=x,z,distance,pitch,yaw`, and compare screenshots before
  and after at 1440×900, 768×1024 and 390×844. Keep the screenshots outside the repository.
- Look at a far view too. Water, terrain and vegetation switch level of detail with distance.
- Headless Chromium with SwiftShader renders in software, so colors and some WebGPU paths differ. Prefer system Chrome
  with `--use-angle=metal --enable-gpu` on a Mac, and say which one you used.
- In development the engine is on `window.dawnfolk`: `session.frame` holds the tribes, weather and calendar, `camera`
  the view, and `powers` the active tool.

## Rules that are easy to miss

- The code style is in [CONTRIBUTING.md](CONTRIBUTING.md#code) and isn't repeated here. The `code-style` agent in
  `.claude/agents` reviews a change against it.
- The engine never imports React, and the simulation never imports rendering. The `noRestrictedImports` overrides in
  `biome.jsonc` enforce this. The UI reads the session through small Zustand stores and sends commands, which zod
  validates at the worker boundary.
- Generation and the simulation are deterministic for a seed. Take randomness from a `RandomSource` or `hashToUnit`,
  never `Math.random`, and keep the order of draws stable, because tests pin worlds by seed. Only rendering effects
  and the default seed may use `Math.random`.
- Water has one rule: `hasWater` and `touchesWaterCell` in `src/world`. Planting, regrowth, grass and the water shader
  must agree on it, or plants stand in rivers.
- Terrain and water share their level of detail per patch. A shader that reads a neighbor cell must account for the
  patch step, or far views break.
- The island edge is one outline per shape, in `rendering/terrain/island-outline.ts`. Terrain, water, grass and rain
  are cut by it. Plants keep clear of the coast through `hasRoomFromCoast`.
- Shaders are TSL node graphs. Keep large numbers out of float hashes: float32 loses precision past 16 million.
- The engine projects compile with `noUncheckedIndexedAccess` off for typed arrays; the app keeps it on.
- Game things (powers, resources, buildings, weather, events) use `design/game-icon.tsx` with the painted WebP icons
  in `design/icons`; commit only the final WebP, not masters. Interface controls use `lucide-react` in the text
  color.
- Panels are islands from `design/island.tsx`: solid paper, no glass or blur. Islands in one row have the same height.
- Saves store technology ids, plant species names and snapshot fields. Renaming one breaks old saves unless loading
  maps it.
- Several agents may share this checkout. Work in your own `git worktree`, stage only your own files, and remove only
  the worktrees and branches you created.
