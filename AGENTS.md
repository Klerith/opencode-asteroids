# AGENTS.md

Vanilla JS Asteroids clone. No dependencies, no bundler, no build step, no tests, no lint.

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
npx serve .
```

There is no `npm install` / `npm test` / typecheck — don't look for one.

## Architecture

- All game logic lives in a single `game.js`, loaded via a plain `<script>` tag (no ES modules, no imports). Top-level `canvas`/`ctx`/`W`/`H` and classes are globals by design.
- Entry/flow: `initGame()` → `requestAnimationFrame(loop)` → `update(dt)` + `draw()` each frame.
- Game state machine: `'playing' | 'dead' | 'gameover'` (see `update()`).
- Loop is dt-based with a `0.05s` cap on `dt`; space is toroidal via `wrap(v, max)`, so every moving entity wraps on both axes.

## Conventions

- Canvas is **800×600**, hardcoded in two places: `index.html` (`<canvas width height>`) and `game.js` (`W`/`H` constants). Change both together.
- User-facing strings, code comments, and the README are in **Spanish** — match that for any new HUD text, overlays, or comments.
- Entity pattern: a `class` with `update(dt)`, `draw()`, and a `dead` boolean flag. Register new entity arrays in `update()` (movement + collision) and `draw()`, and filter out `dead` entries each frame (see `bullets`/`asteroids`/`particles`).
- Tuning constants (speeds, radii, points, thrust, drag) are inline near their class — keep new tuning values local and documented.
