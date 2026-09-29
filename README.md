# Daily Tile-Swap Puzzle

A mobile-first React + TypeScript game: restore a fixed 6×6 mosaic by swapping any two complete tiles. The target is always available above the board on phones and beside it on wider screens.

Implements [issue #2](https://github.com/srbying/tile/issues/2) and [issue #4](https://github.com/srbying/tile/issues/4) of the [product plan](https://github.com/srbying/tile/issues/1).

## Run locally

Use Node.js 24 LTS and npm. Node.js 22 (22.12 or newer) is also supported.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No environment variables, account, backend, or external assets are required.

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
- Use Tab / Shift+Tab to move between tiles in row-major order. Enter and Space select or swap; moving focus alone never changes the board.
- Every committed swap uses one attempt. Selection and cancellation are free. A correct final swap wins; an incorrect final attempt ends in failure. Both terminal boards remain inspectable and reject further swaps.
- Active solve timing starts on the first committed swap, pauses while the page is hidden, and stops at win or failure. Results show active time, swaps used and allowed, hint use, and a concise motif explanation.
- Before the first committed move, reloading returns to mode selection. There is no undo, restart control, daily release, or installable PWA in this slice.

## Design boundaries

Puzzle code and its unit tests live together in `src/features/puzzle/`; browser tests live in `e2e/`.

- **Content and modes:** readonly tile appearances and puzzle definitions. `sample-puzzle.ts` supplies the target and fixed permutation; difficulty configuration supplies art policies and attempt limits.
- **Rules:** `createPuzzleEngine(puzzle, options)` returns a pure initializer and reducer. The engine handles selection, atomic whole-tile swaps, attempt accounting, productive hint selection, and win/loss states. Active timing uses a separate deterministic timer model. Neither imports React, artwork, or storage implementation.
- **Progress:** a versioned local repository validates persisted round snapshots. The UI resolves saves by immutable puzzle ID, restores the saved mode and engine state, and checkpoints active time at hide/page exit. Storage failures leave in-memory play available.
- **Appearance:** a registry of polyline motifs, integer quarter-turn/reflection transforms, and canonical stroke geometry. Rendering and equivalence share the same normalized geometry, foreground/background colors, and stroke weight. Symmetric rotations and reflections are accepted; invisible identifiers are ignored.
- **UI:** React connects reducer actions to semantic controls. Artwork, static target, interactive board, and page composition have separate responsibilities.

These boundaries apply SOLID through composition: focused modules, extensible motif data, a substitutable comparison-function contract, narrow interfaces, and rules that depend on an injected comparison abstraction. No inheritance hierarchy or external state container is needed.

## Verification scope

Unit tests cover immutable transitions, free selection/cancellation, swap accounting, productive one-use hints, visual equivalence, progress validation and restore, puzzle-ID rollover lookup, hidden-page timer pauses, result time formatting, last-attempt win/loss, every visual attribute, symmetry, terminal locking, difficulty art projection, and the fixed fixture's solution. Browser tests exercise hint feedback and assisted results, mode selection and budgets, automatic resume after reload, and the game using keyboard and pointer/touch; they compare the completed SVG board with the reference, verify announcements and focus, and check reload behavior.

The browser matrix includes desktop Chromium/WebKit and emulated phones at 375px/320px. Layout tests also check 1280px, at least 44px square playable cells, no horizontal overflow, and reduced-motion settings. Feedback uses outlines, symbols, and text as well as color; SVG art is paired with accessible position/attribute descriptions.

Emulation does not replace physical-device or screen-reader testing. VoiceOver, TalkBack, switch-device evaluation, and first-player usability sessions remain part of [issue #10](https://github.com/srbying/tile/issues/10) and later playtesting. This is a sample puzzle, not a daily content service.

## Sample solution (spoiler)

“The courtyard” has a Greek-key border around four inset diamonds. Its scramble consists of ten disjoint swaps. Repeating these pairs restores the target; no runtime solver or minimum-move validator is included.

Coordinates below are **row, column**, counted from 1 at the top left:

| Swap | First tile | Second tile |
| --- | --- | --- |
| 1 | 1, 1 | 3, 3 |
| 2 | 1, 2 | 4, 4 |
| 3 | 1, 4 | 5, 2 |
| 4 | 1, 6 | 4, 1 |
| 5 | 2, 1 | 5, 6 |
| 6 | 2, 2 | 3, 5 |
| 7 | 2, 3 | 6, 4 |
| 8 | 2, 5 | 4, 6 |
| 9 | 2, 6 | 5, 4 |
| 10 | 3, 2 | 6, 5 |
