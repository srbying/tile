# Daily Tile-Swap Puzzle

A mobile-first React + TypeScript game: restore a daily 6×6 mosaic by swapping any two complete tiles. The target is always available above the board on phones and beside it on wider screens.

Implements [issue #2](https://github.com/srbying/tile/issues/2), [issue #4](https://github.com/srbying/tile/issues/4), and [issue #6](https://github.com/srbying/tile/issues/6) of the [product plan](https://github.com/srbying/tile/issues/1).

## Run locally

Use Node.js 24 LTS and npm. Node.js 22 (22.12 or newer) is also supported.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Local Vite middleware serves the same daily-puzzle API routes as deployment; no account, environment variables, or external assets are required.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

The browser suite builds the app and starts a local production preview automatically. On Linux, install browser OS dependencies with `npx playwright install --with-deps chromium webkit`. GitHub Actions runs lint, build/typechecking, unit tests, and all browser projects on Node.js 24.

## Play

- Choose Easy, Medium, or Hard before starting. Medium is preselected. Modes share the same target and tile placement, with different approved art tiers and 15 / 13 / 10 swaps.
- Tap a tile, then another tile anywhere on the board. Both tiles exchange all their visual attributes.
- Tap the selected tile again, press Escape from a tile, or use **Clear selection** to cancel. To change your first tile, cancel before selecting another.
- Use the one available hint to highlight a productive swap. It does not move tiles or spend an attempt; hinted results are marked assisted.
- An unfinished round saves locally after swaps and hint use. Reload resumes the same mode, board, attempts, hint state, puzzle ID, and active time. Time while the page is hidden does not count.
- The app shell and latest validated daily release are cached for offline play. Offline copies show their release date; a successful online load replaces the cached release. Future puzzles are not cached.
- Use Tab / Shift+Tab to move between tiles in row-major order. Enter and Space select or swap; moving focus alone never changes the board.
- Every committed swap uses one attempt. Selection and cancellation are free. A correct final swap wins; an incorrect final attempt ends in failure. Both terminal boards remain inspectable and reject further swaps.
- Active solve timing starts on the first committed swap, pauses while the page is hidden, and stops at win or failure. Results show active time, swaps used and allowed, hint use, and a concise motif explanation.
- Each day’s puzzle is generated deterministically from the New York calendar date. Every tier has a 10-swap shortest solution, budgets stay at 15 / 13 / 10, and visible targets do not repeat within 30 days.
- Reload before the first move returns to mode selection. Reload an unfinished round to restore mode, board, attempts, hint, puzzle ID, and active time. Saved rounds fetch their original versioned puzzle by ID.
- Open **Offline authoring** or visit `/author` to generate, edit, import, validate, preview, and export candidates. Authoring is optional and separate from automatic daily generation.

## Design boundaries

Puzzle code and its unit tests live together in `src/features/puzzle/`; browser tests live in `e2e/`.

- **Content and modes:** `motif-artwork.ts` stores normalized source paths, `motif-set-catalog.ts` groups them for rotation, and `sample-puzzle.ts` remains the v1 candidate seed. Difficulty configuration supplies art policies and attempt limits.
- **Rules:** `createPuzzleEngine(puzzle, options)` returns a pure initializer and reducer. The engine handles selection, atomic whole-tile swaps, attempt accounting, productive hint selection, and win/loss states. Active timing uses a separate deterministic timer model. Neither imports React, artwork, or storage implementation.
- **Progress:** a versioned local repository validates persisted round snapshots. The UI resolves saves by immutable puzzle ID, restores the saved mode and engine state, and checkpoints active time at hide/page exit. Storage failures leave in-memory play available.
- **Daily release:** version 2 cycles nine motif sets across five board compositions, with no set returning for at least six intervening puzzles and no board composition repeating on adjacent days. Pure modules generate deterministic targets and scrambles, validate every difficulty tier, and preserve 30-day board uniqueness. `GET /api/puzzles/today` returns today’s New York puzzle; `GET /api/puzzles/:id` replays v1 and v2 releases so saved progress remains addressable.
- **Appearance:** 30 authored SVG-path motifs compile to shared polyline geometry, with indigo and ochre added to the tile palette. Rendering and equivalence share normalized geometry, foreground/background colors, and stroke weight; motif line caps preserve the rounded waveform and squiggle art.
- **UI:** React connects reducer actions to semantic controls. Artwork, static target, interactive board, and page composition have separate responsibilities.

These boundaries apply SOLID through composition: focused modules, extensible motif data, a substitutable comparison-function contract, narrow interfaces, and rules that depend on an injected comparison abstraction. No inheritance hierarchy or external state container is needed.

## Deploy

Connect the repository to Vercel with the root as the project root. Vercel builds the Vite app from `dist`, serves the TypeScript functions in `api/`, and rewrites client routes to `index.html`. Git integration provides PR previews and production deploys from `main`. Daily content is generated per request, with no scheduled job or daily build.

Issue #7’s proposed human-approval gate was intentionally dropped. The daily API does not check an approval status.

## Verification scope

Unit tests cover immutable transitions, swap accounting, visual equivalence, progress validation and restore, exact visible swap counts, candidate validation, target symmetry, deterministic generation, New York date boundaries, saved-ID lookup, hint feedback, and mode budgets. Browser tests cover offline authoring import/edit/export, three-tier previews, generated-puzzle gameplay, resume by saved puzzle ID, keyboard and touch play, announcements, focus, and reload behavior.

The browser matrix includes desktop Chromium/WebKit and emulated phones at 375px/320px. Layout tests also check 1280px, at least 44px square playable cells, no horizontal overflow, and reduced-motion settings. Feedback uses outlines, symbols, and text as well as color; SVG art is paired with accessible position/attribute descriptions.

Browser emulation does not replace physical-device or assistive-technology testing. Physical iOS and Android VoiceOver, TalkBack, and switch-input checks for [issue #10](https://github.com/srbying/tile/issues/10) are pending; see the [validation report](docs/accessibility-validation.md). First-player usability sessions remain later playtesting.
