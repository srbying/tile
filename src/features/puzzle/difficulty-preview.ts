import type { DifficultyTierId, PuzzleDefinition, TileAppearance, TileColor } from './puzzle.types.js';
export type { DifficultyTierId } from './puzzle.types.js';

type AttributePolicy<Value> =
  | { readonly mode: 'preserve' }
  | { readonly mode: 'fixed'; readonly value: Value };

export interface DifficultyTierConfig {
  readonly id: DifficultyTierId;
  readonly label: string;
  readonly description: string;
  readonly attemptLimit: number;
  readonly appearance: {
    readonly color: AttributePolicy<TileColor>;
    readonly strokeWeight: AttributePolicy<TileAppearance['strokeWeight']>;
  };
}

export interface DifficultyPreview extends Omit<DifficultyTierConfig, 'appearance'> {
  readonly target: readonly TileAppearance[];
  readonly start: readonly TileAppearance[];
}

// Profiles alter art only. Geometry, orientation, inversion, and mirroring remain per-tile data.
export const difficultyTierConfigs: readonly DifficultyTierConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Distinct motifs, two strong colors, and varied line weight.',
    attemptLimit: 15,
    appearance: { color: { mode: 'preserve' }, strokeWeight: { mode: 'preserve' } },
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Keep both colors; compare motifs, turns, and inversion without line-weight cues.',
    attemptLimit: 13,
    appearance: { color: { mode: 'preserve' }, strokeWeight: { mode: 'fixed', value: 7 } },
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Use one high-contrast palette and uniform lines; compare motif, turns, inversion, and mirroring.',
    attemptLimit: 10,
    appearance: { color: { mode: 'fixed', value: 'teal' }, strokeWeight: { mode: 'fixed', value: 7 } },
  },
];

function resolvePolicy<Value>(value: Value, policy: AttributePolicy<Value>): Value {
  return policy.mode === 'preserve' ? value : policy.value;
}

function applyAppearance(
  tile: TileAppearance,
  appearance: DifficultyTierConfig['appearance'],
): TileAppearance {
  return {
    ...tile,
    color: resolvePolicy(tile.color, appearance.color),
    strokeWeight: resolvePolicy(tile.strokeWeight, appearance.strokeWeight),
  };
}

function projectPuzzle(puzzle: PuzzleDefinition, appearance: DifficultyTierConfig['appearance']): PuzzleDefinition {
  return {
    ...puzzle,
    target: puzzle.target.map((tile) => applyAppearance(tile, appearance)),
    start: puzzle.start.map((tile) => applyAppearance(tile, appearance)),
  };
}

export function getDifficultyTierConfig(id: DifficultyTierId): DifficultyTierConfig {
  const config = difficultyTierConfigs.find((tier) => tier.id === id);
  if (!config) throw new Error(`Unknown difficulty tier: ${id}`);
  return config;
}

/** Applies the same configurable art policy used by the visual preview to gameplay. */
export function buildDifficultyPuzzle(puzzle: PuzzleDefinition, id: DifficultyTierId): PuzzleDefinition {
  return projectPuzzle(puzzle, getDifficultyTierConfig(id).appearance);
}

/** Projects one canonical puzzle into visual tiers without changing tile positions or rules. */
export function buildDifficultyPreviews(
  puzzle: PuzzleDefinition,
  configs: readonly DifficultyTierConfig[] = difficultyTierConfigs,
): readonly DifficultyPreview[] {
  return configs.map(({ appearance, ...config }) => {
    const projected = projectPuzzle(puzzle, appearance);
    return { ...config, target: projected.target, start: projected.start };
  });
}
