import type { PuzzleDefinition, TileAppearance, TileColor } from './puzzle.types';

export type DifficultyTierId = 'easy' | 'medium' | 'hard';

type AttributePolicy<Value> =
  | { readonly mode: 'preserve' }
  | { readonly mode: 'fixed'; readonly value: Value };

export interface DifficultyTierConfig {
  readonly id: DifficultyTierId;
  readonly label: string;
  readonly description: string;
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
    appearance: { color: { mode: 'preserve' }, strokeWeight: { mode: 'preserve' } },
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Keep both colors; compare motifs, turns, and inversion without line-weight cues.',
    appearance: { color: { mode: 'preserve' }, strokeWeight: { mode: 'fixed', value: 7 } },
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Use one high-contrast palette and uniform lines; compare motif, turns, inversion, and mirroring.',
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

/** Projects one canonical puzzle into visual tiers without changing tile positions or rules. */
export function buildDifficultyPreviews(
  puzzle: PuzzleDefinition,
  configs: readonly DifficultyTierConfig[] = difficultyTierConfigs,
): readonly DifficultyPreview[] {
  return configs.map(({ appearance, ...config }) => ({
    ...config,
    target: puzzle.target.map((tile) => applyAppearance(tile, appearance)),
    start: puzzle.start.map((tile) => applyAppearance(tile, appearance)),
  }));
}
