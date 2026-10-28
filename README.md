<p align="center">
  <img src=".github/logo.svg" alt="" width="96" height="96">
</p>

<h1 align="center">Dawnfolk</h1>

<p align="center">A god game about the first tribes on a floating island</p>

<p align="center">
  <a
    href="https://github.com/imsvidskiy/dawnfolk/actions/workflows/ci.yml"
  ><img
    src="https://github.com/imsvidskiy/dawnfolk/actions/workflows/ci.yml/badge.svg"
    alt="CI"
  ></a>
  <a
    href="LICENSE"
  ><img
    src="https://img.shields.io/badge/license-MIT-blue"
    alt="License: MIT"
  ></a>
  <img
    src="https://img.shields.io/badge/WebGPU-three.js-informational"
    alt="WebGPU with three.js"
  >
  <a
    href="https://github.com/sponsors/imsvidskiy"
  ><img
    src="https://img.shields.io/github/sponsors/imsvidskiy?label=Sponsor&logo=GitHub&color=ea4aaa"
    alt="Sponsor"
  ></a>
</p>

<p align="center">
  <a href="https://playdawnfolk.com">Play</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="https://github.com/sponsors/imsvidskiy">Sponsor</a>
</p>

https://github.com/user-attachments/assets/d04e30b3-ad84-4074-a5a0-45f5a0de384b

Shape the land, call rain, fire and lightning, and watch small tribes gather, build, feud and climb from the Stone
Age to the Iron Age on a procedurally generated island rendered with WebGPU.

## Features

- **Island.** Generated from a seed, with rivers, lakes, waterfalls, swamps, biomes, seasons and snow.
- **Tribes.** People gather, hunt, farm and build, and grow from the Stone Age to the Iron Age.
- **Feuds.** Tribes raid each other over land and later make peace.
- **Wildlife.** Herds of deer, mammoths and ibex, hares, and wolf packs that hunt them.
- **Powers.** Fire, lightning, rain, snow, meteors, earthquakes, terraforming and more.
- **Healing land.** Burnt land grows back, and craters fill into lakes.
- **Saves.** Worlds save in the browser on their own.

## Stack

- **App:** Bun, Vite 8, React 19, TypeScript 7
- **Graphics:** three.js r186 on WebGPU with TSL, WebGL 2 fallback
- **Interface:** Base UI, Tailwind CSS 4, Zustand
- **Data:** Zod, Comlink
- **Tooling:** Biome, Vitest 5, Playwright, Lefthook

## Getting started

You need [Bun](https://bun.sh) 1.4 or later and a browser with WebGPU or WebGL 2.

```sh
git clone https://github.com/imsvidskiy/dawnfolk.git
cd dawnfolk
bun install
bun run dev                                           # http://localhost:5173
```

[CONTRIBUTING.md](CONTRIBUTING.md) has the other scripts, the checks and the code style.

## Architecture

```
src/
  shared/      math, seeded random, noise
  content/     game data: plants, animals, buildings, powers
  world/       world grid shared by simulation and renderer
  generation/  island generation from a seed
  simulation/  nature, animals and tribes
  workers/     simulation worker
  game/        session, camera, input
  models/      procedural meshes and animation
  rendering/   WebGPU renderer
  design/      design system
  features/    interface features
  app/         app shell and start screen
```

The simulation runs in a Web Worker. The renderer and the HUD read its frames and send commands back.
[AGENTS.md](AGENTS.md#rules-that-are-easy-to-miss) has the rules that keep these parts apart.

## Sponsor

Dawnfolk is free and open source. If you enjoy it, you can support its development on
[GitHub Sponsors](https://github.com/sponsors/imsvidskiy).

## License

[MIT](LICENSE)
