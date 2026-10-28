# Contributing

## Ways to contribute

- **Report a bug or propose a feature** with the issue forms.
- **Report a vulnerability** privately, as described in
  [SECURITY.md](SECURITY.md).
- **Send a pull request** for an open issue. Comment on the issue first for
  anything larger than a fix, so the approach is agreed before the work.

## Setup

Install and run the game as in [Getting started](README.md#getting-started).
`bun install` also installs the Git hooks through
[Lefthook](https://lefthook.dev): pre-commit fixes the staged files with Biome,
and pre-push runs `bun run typecheck` and `bun run test`.

## Scripts and checks

| Command | What it does |
| --- | --- |
| `bun run dev` | Serves the game at `http://localhost:5173`, or the next free port |
| `bun run check` | Lints and checks formatting with Biome; `bun run fix` fixes what it can |
| `bun run typecheck` | Runs `tsc --build` over the engine, app and tooling projects |
| `bun run test` | Runs unit tests in Node and browser tests in Chromium; `bun run test:watch` reruns them on change |
| `bun run build` | Builds for production; `bun run preview` serves the build |
| `bun run test:e2e` | Runs Playwright smoke tests of the wide and phone layouts against the production build |
| `bun run deploy` | Builds and deploys to Cloudflare Workers as static assets |

CI runs `check`, `typecheck`, `test` and `build` on every pull request and
every push to `main`, and deploys `main`; run them before you push. Fix the
code rather than the rule. `test:e2e` runs only locally: run it when you change
the launch or the HUD layout.

`src/**/*.test.ts` runs in Node; `src/**/*.browser.test.ts` and
`src/**/*.test.tsx` run in Chromium. Browser tests and Playwright need
Chromium; without Playwright's own browser, point them at a system one:
`CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

## Code

Biome formats and lints at a line width of 120, and TypeScript runs under
`@tsconfig/bases/strictest`. On top of that:

- Write names in full words: `distanceFromCenter`, not `dist`; `column`, not
  `x`. Name a file after what it holds, in kebab case: `water-material.ts`.
- Declare functions with `function`, never as arrow functions assigned to a
  name. Inline callbacks may be arrows.
- Check preconditions at the top and return early, so the happy path stays at
  the left margin.
- Put every `if` and loop body in braces, even a single `return`.
- Don't use `??`, don't use `&&` to pick values or render conditionally, and
  don't use `as` casts or `!` assertions.
- Separate the steps of a function with one blank line: the destructuring, the
  values it prepares, the work, and the result. Statements of one kind stay
  together.
- Separate sibling JSX elements with one blank line. In `index.html`, closely
  related head tags stay together.
- No comments in code, except for workarounds of specific bugs.

The architectural rules that are easy to break, such as determinism, the water
rule and level of detail, are in
[AGENTS.md](AGENTS.md#rules-that-are-easy-to-miss).

## Commits

Commits follow
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
`type(scope): description`.

- Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `test`, `build`,
  `ci`, and `chore`.
- The scope names the area a change is about, from the list below. Leave it
  out when the change spans several areas.
- The description is in the imperative, starts in lowercase, stays under 72
  characters, and has no trailing period.
- One commit is one logical change that builds and passes on its own. Add a
  body only for what the diff can't show.
- No trailers such as `Co-authored-by:` or `Signed-off-by:`.

| Scope | Area |
| --- | --- |
| `generation` | Relief, erosion, hydrology, climate, and the first vegetation |
| `simulation` | The simulation worker: nature, agents, society, powers |
| `models` | Procedural people, animals, plants, and buildings |
| `rendering` | The WebGPU renderer: terrain, water, sky, effects |
| `game` | The main thread: worker connection, camera, input, tools |
| `ui` | The HUD, its features, and the design system |
| `app` | The app shell and engine launch |
| `e2e` | Playwright smoke tests |
| `release` | The version bump that prepares a release |
| `deps` | Dependency updates, which Dependabot opens |

## Pull requests

- One pull request is one standalone change, and CI has to pass.
- GitHub merges a pull request with a merge commit whose subject is its title
  and whose body is its body. Write the title in commit form and the body as a
  commit body, then end it with `Verified:` and the checks you ran, and
  `Fixes #N` when it closes an issue.
- Attach screenshots for visible changes in a comment, so they stay out of the
  merge commit.

## License

Dawnfolk is under the [MIT license](LICENSE). By submitting a contribution, you
agree that it is licensed under the same terms.
