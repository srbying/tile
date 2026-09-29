import type { GameAction, GameState, PuzzleDefinition, PuzzleEngineOptions } from './puzzle.types';
import { findProductiveHint } from './puzzle-hint';

/** Rules depend only on immutable data and a visual-equivalence contract. */
export function createPuzzleEngine(puzzle: PuzzleDefinition, { sameAppearance, attemptLimit }: PuzzleEngineOptions) {
  const cellCount = puzzle.size * puzzle.size;
  if (puzzle.start.length !== cellCount || puzzle.target.length !== cellCount) {
    throw new Error('A puzzle must contain exactly 36 starting and target tiles.');
  }
  if (!Number.isInteger(attemptLimit) || attemptLimit < 1) {
    throw new Error('A puzzle must have a positive integer attempt limit.');
  }

  const isSolved = (board: GameState['board']) =>
    board.every((tile, position) => sameAppearance(tile, puzzle.target[position]!));

  function initialize(): GameState {
    const board = [...puzzle.start];
    return {
      board,
      selectedPosition: null,
      status: isSolved(board) ? 'won' : 'playing',
      attemptsUsed: 0,
      attemptLimit,
      hintUsed: false,
      hintedPositions: null,
    };
  }

  function reduce(state: GameState, action: GameAction): GameState {
    if (state.status !== 'playing') return state;
    if (action.type === 'cancel') {
      return state.selectedPosition === null ? state : { ...state, selectedPosition: null };
    }
    if (action.type === 'useHint') {
      if (state.hintUsed) return state;
      const hintedPositions = findProductiveHint(state.board, puzzle.target, sameAppearance);
      return hintedPositions === null ? state : { ...state, hintUsed: true, hintedPositions };
    }

    const position = action.position;
    if (!Number.isInteger(position) || position < 0 || position >= cellCount) return state;
    if (position === state.selectedPosition) return { ...state, selectedPosition: null };
    if (state.selectedPosition === null) return { ...state, selectedPosition: position };

    const board = [...state.board];
    const selected = state.selectedPosition;
    [board[selected], board[position]] = [board[position]!, board[selected]!];
    const attemptsUsed = state.attemptsUsed + 1;
    const status = isSolved(board)
      ? 'won'
      : attemptsUsed >= state.attemptLimit
        ? 'lost'
        : 'playing';
    return {
      board,
      selectedPosition: null,
      status,
      attemptsUsed,
      attemptLimit: state.attemptLimit,
      hintUsed: state.hintUsed,
      hintedPositions: null,
    };
  }

  return { initialize, reduce };
}
