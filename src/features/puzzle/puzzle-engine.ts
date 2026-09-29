import type { GameAction, GameState, PuzzleDefinition, SameAppearance } from './puzzle.types';

/** Rules depend only on immutable data and a visual-equivalence contract. */
export function createPuzzleEngine(puzzle: PuzzleDefinition, sameAppearance: SameAppearance) {
  const cellCount = puzzle.size * puzzle.size;
  if (puzzle.start.length !== cellCount || puzzle.target.length !== cellCount) {
    throw new Error('A puzzle must contain exactly 36 starting and target tiles.');
  }

  const isSolved = (board: GameState['board']) =>
    board.every((tile, position) => sameAppearance(tile, puzzle.target[position]!));

  function initialize(): GameState {
    const board = [...puzzle.start];
    return { board, selectedPosition: null, status: isSolved(board) ? 'solved' : 'playing' };
  }

  function reduce(state: GameState, action: GameAction): GameState {
    if (state.status === 'solved') return state;
    if (action.type === 'cancel') {
      return state.selectedPosition === null ? state : { ...state, selectedPosition: null };
    }

    const position = action.position;
    if (!Number.isInteger(position) || position < 0 || position >= cellCount) return state;
    if (position === state.selectedPosition) return { ...state, selectedPosition: null };
    if (state.selectedPosition === null) return { ...state, selectedPosition: position };

    const board = [...state.board];
    const selected = state.selectedPosition;
    [board[selected], board[position]] = [board[position]!, board[selected]!];
    return { board, selectedPosition: null, status: isSolved(board) ? 'solved' : 'playing' };
  }

  return { initialize, reduce };
}
