import { describeTile } from './tile-appearance';
import { TileArtwork } from './tile-artwork';
import type { GameState, TileAppearance } from './puzzle.types';

export const describePosition = (position: number) => `Row ${Math.floor(position / 6) + 1}, column ${position % 6 + 1}`;

export function TargetBoard({ tiles }: { readonly tiles: readonly TileAppearance[] }) {
  return (
    <ol className="tile-grid target-grid" aria-label="Target arrangement">
      {tiles.map((tile, position) => (
        <li className="target-tile" key={position}>
          <span className="visually-hidden">{describePosition(position)}: {describeTile(tile)}</span>
          <TileArtwork tile={tile} />
        </li>
      ))}
    </ol>
  );
}

interface PuzzleBoardProps {
  readonly state: GameState;
  readonly onActivate: (position: number) => void;
  readonly onCancel: () => void;
}

export function PuzzleBoard({ state, onActivate, onCancel }: PuzzleBoardProps) {
  // Explicit tabIndex keeps buttons in WebKit's Tab order regardless of native defaults.
  const terminal = state.status !== 'playing';
  return (
    <fieldset
      className={`tile-grid playable-grid${terminal ? ` is-${state.status}` : ''}`}
      aria-label="Your mosaic"
      aria-describedby="game-instruction keyboard-instruction"
    >
      {state.board.map((tile, position) => (
        <button
          className={`tile-button${state.selectedPosition === position ? ' is-selected' : ''}`}
          type="button"
          tabIndex={0}
          key={position}
          aria-label={`${describePosition(position)}: ${describeTile(tile)}`}
          aria-pressed={state.selectedPosition === position}
          aria-disabled={terminal}
          onClick={() => { if (!terminal) onActivate(position); }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        >
          <TileArtwork tile={tile} />
          {terminal && <span className="outcome-mark" aria-hidden="true">{state.status === 'won' ? '✓' : '×'}</span>}
          {state.selectedPosition === position && <span className="selection-mark" aria-hidden="true">✓</span>}
        </button>
      ))}
    </fieldset>
  );
}
