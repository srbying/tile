export type Motif =
  | 'meander' | 'chevron' | 'diamond'
  | 'rosette' | 'sunburst' | 'scallop'
  | 'wave' | 'lattice' | 'pinwheel'
  | 'compass' | 'lantern' | 'interlock'
  | 'leaf' | 'shell' | 'braid'
  | 'hex-blossom' | 'fan' | 'prism'
  | 'crescent' | 'lotus' | 'mosaic-cross'
  | 'squiggle-sway' | 'squiggle-loops' | 'squiggle-coil'
  | 'waveform-sine' | 'waveform-crest' | 'waveform-swell'
  | 'waveform-flick' | 'waveform-double' | 'waveform-shelf';
export type TileColor = 'teal' | 'terracotta' | 'indigo' | 'ochre';
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

export type PuzzleHintPositions = readonly [number, number];

export interface PuzzleCandidate extends PuzzleDefinition {
  readonly schemaVersion: 1;
  readonly attemptLimits: Readonly<Record<DifficultyTierId, number>>;
  readonly hints?: Readonly<Partial<Record<DifficultyTierId, PuzzleHintPositions>>>;
}

export interface DailyPuzzleRelease {
  readonly puzzleId: string;
  readonly releaseDate: string;
  readonly generatorVersion: number;
  readonly puzzle: PuzzleCandidate;
}
