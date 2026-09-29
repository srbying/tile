import type { GameAction, GameState, PuzzleDefinition, PuzzleEngineOptions, RestorableGameState } from './puzzle.types';
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

  function isValidBoard(board: GameState['board']): boolean {
    try {
      const unmatchedTiles = [...puzzle.start];
      for (const tile of board) {
        const matchingIndex = unmatchedTiles.findIndex((candidate) => sameAppearance(candidate, tile));
        if (matchingIndex < 0) return false;
        unmatchedTiles.splice(matchingIndex, 1);
      }
      return unmatchedTiles.length === 0;
    } catch {
      return false;
    }
  }

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

  function restore(saved: RestorableGameState): GameState | null {
    if (!Array.isArray(saved.board) || saved.board.length !== cellCount) return null;
    if (!isValidBoard(saved.board)) return null;
    if (!Number.isInteger(saved.attemptsUsed) || saved.attemptsUsed < 0 || saved.attemptsUsed >= attemptLimit) return null;
    if (typeof saved.hintUsed !== 'boolean') return null;
    const positions = saved.hintedPositions;
    if (positions !== null && (!Array.isArray(positions)
      || positions.length !== 2
      || !positions.every((position) => Number.isInteger(position) && position >= 0 && position < cellCount)
      || positions[0] === positions[1])) return null;
    if (!saved.hintUsed && positions !== null) return null;

    const board = [...saved.board];
    if (isSolved(board)) return null;
    return {
      board,
      selectedPosition: null,
      status: 'playing',
      attemptsUsed: saved.attemptsUsed,
      attemptLimit,
      hintUsed: saved.hintUsed,
      hintedPositions: positions,
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

  return { initialize, reduce, restore };
}
