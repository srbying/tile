export type Motif = 'meander' | 'chevron' | 'diamond';
export type TileColor = 'teal' | 'terracotta';
export type QuarterTurn = 0 | 90 | 180 | 270;
export type DifficultyTierId = 'easy' | 'medium' | 'hard';

export interface TileAppearance {
  readonly motif: Motif;
  readonly color: TileColor;
  readonly strokeWeight: 4 | 7;
  readonly orientation: QuarterTurn;
  readonly inverted: boolean;
  readonly mirrored: boolean;
}

export interface PuzzleDefinition {
  readonly id: string;
  readonly title: string;
  readonly motifDescription: string;
  readonly size: 6;
  readonly target: readonly TileAppearance[];
  readonly start: readonly TileAppearance[];
}

export interface GameState {
  readonly board: readonly TileAppearance[];
  readonly selectedPosition: number | null;
  readonly status: 'playing' | 'won' | 'lost';
  readonly attemptsUsed: number;
  readonly attemptLimit: number;
  readonly hintUsed: boolean;
  readonly hintedPositions: readonly [number, number] | null;
}

export interface RestorableGameState {
  readonly board: readonly TileAppearance[];
  readonly attemptsUsed: number;
  readonly hintUsed: boolean;
  readonly hintedPositions: readonly [number, number] | null;
}

export interface SavedPuzzleProgressV1 extends RestorableGameState {
  readonly version: 1;
  readonly puzzleId: string;
  readonly tierId: DifficultyTierId;
  readonly elapsedMilliseconds: number;
}

export type GameAction =
  | { readonly type: 'activate'; readonly position: number }
  | { readonly type: 'cancel' }
  | { readonly type: 'useHint' };

export type SameAppearance = (left: TileAppearance, right: TileAppearance) => boolean;

export interface PuzzleEngineOptions {
  readonly sameAppearance: SameAppearance;
  readonly attemptLimit: number;
}
