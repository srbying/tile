import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { describeTile } from './tile-appearance';
import { TileArtwork } from './tile-artwork';
import type { GameState, TileAppearance } from './puzzle.types';

export const describePosition = (position: number) => `Row ${Math.floor(position / 6) + 1}, column ${position % 6 + 1}`;

export function TargetBoard({ tiles }: { readonly tiles: readonly TileAppearance[] }) {
  return (
    <ol className="tile-grid target-grid" aria-label="Target pattern">
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
  const [focusedPosition, setFocusedPosition] = useState(0);
  const terminal = state.status !== 'playing';

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, position: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    let nextPosition = position;
    switch (event.key) {
      case 'ArrowUp':
        if (position >= 6) nextPosition = position - 6;
        break;
      case 'ArrowRight':
        if (position % 6 < 5) nextPosition = position + 1;
        break;
      case 'ArrowDown':
        if (position < 30) nextPosition = position + 6;
        break;
      case 'ArrowLeft':
        if (position % 6 > 0) nextPosition = position - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    if (nextPosition === position) return;
    setFocusedPosition(nextPosition);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`button[data-position="${nextPosition}"]`)
      ?.focus();
  };

  return (
    <fieldset
      className={`tile-grid playable-grid${terminal ? ` is-${state.status}` : ''}`}
      aria-label="Your tiles"
      aria-describedby="game-instruction keyboard-instruction"
    >
      {state.board.map((tile, position) => {
        const hintNumber = state.hintedPositions?.indexOf(position) ?? -1;
        const hinted = hintNumber >= 0;
        return (
          <button
            className={`tile-button${state.selectedPosition === position ? ' is-selected' : ''}${hinted ? ' is-hinted' : ''}`}
            type="button"
            tabIndex={focusedPosition === position ? 0 : -1}
            key={position}
            data-position={position}
            data-hint={hinted ? hintNumber + 1 : undefined}
            aria-label={`${describePosition(position)}: ${describeTile(tile)}`}
            aria-describedby={hinted ? 'hint-instruction' : undefined}
            aria-pressed={state.selectedPosition === position}
            aria-disabled={terminal}
            onFocus={() => setFocusedPosition(position)}
            onClick={() => {
              setFocusedPosition(position);
              if (!terminal) onActivate(position);
            }}
            onKeyDown={(event) => handleKeyDown(event, position)}
          >
            <TileArtwork tile={tile} />
            {hinted && <span className="hint-mark" aria-hidden="true">{hintNumber + 1}</span>}
            {terminal && <span className="outcome-mark" aria-hidden="true">{state.status === 'won' ? '✓' : '×'}</span>}
            {state.selectedPosition === position && <span className="selection-mark" aria-hidden="true">✓</span>}
          </button>
        );
      })}
    </fieldset>
  );
}
