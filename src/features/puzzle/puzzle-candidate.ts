import { buildDifficultyPuzzle, difficultyTierConfigs } from './difficulty-preview.js';
import { findProductiveHint } from './puzzle-hint.js';
import { minimumVisibleSwaps } from './puzzle-solver.js';
import { hasRecentVisualDuplicate } from './puzzle-symmetry.js';
import { isMotif, isTileColor, sameAppearance, visibleAppearance } from './tile-appearance.js';
import type { DifficultyTierId, PuzzleCandidate, PuzzleHintPositions, TileAppearance } from './puzzle.types.js';

export type PuzzleValidationCode =
  | 'invalid-candidate'
  | 'invalid-board'
  | 'invalid-tile'
  | 'hidden-id-dependency'
  | 'unsolvable-inventory'
  | 'already-solved'
  | 'incorrect-shortest-solution'
  | 'invalid-attempt-limit'
  | 'invalid-hint'
  | 'recent-visual-duplicate';

export interface PuzzleValidationIssue {
  readonly code: PuzzleValidationCode;
  readonly message: string;
  readonly tierId?: DifficultyTierId;
}

export interface PuzzleTierValidation {
  readonly tierId: DifficultyTierId;
  readonly minimumSwaps: number | null;
  readonly attemptLimit: number | null;
  readonly hint: PuzzleHintPositions | null;
  readonly target: readonly TileAppearance[];
  readonly start: readonly TileAppearance[];
}

export interface PuzzleValidationResult {
  readonly valid: boolean;
  readonly issues: readonly PuzzleValidationIssue[];
  readonly tiers: readonly PuzzleTierValidation[];
}

export interface PuzzleValidationOptions {
  readonly recentPuzzles?: readonly PuzzleCandidate[];
  readonly recentTargets?: readonly (readonly TileAppearance[])[];
}

const turns = new Set([0, 90, 180, 270]);
const tierSet = new Set<DifficultyTierId>(difficultyTierConfigs.map(({ id }) => id));

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasHiddenIdentifier(value: unknown): boolean {
  if (!record(value)) return false;
  const containsIdentityKey = (item: unknown, isRoot = false): boolean => {
    if (Array.isArray(item)) return item.some((entry) => containsIdentityKey(entry));
    if (!record(item)) return false;
    return Object.entries(item).some(([key, child]) => {
      if (!(isRoot && key === 'id') && /^(?:id|tileId|tileIdentity|pieceId|pieceIdentity|tileIds|pieceIds|hiddenIds)$/i.test(key)) {
        return true;
      }
      return containsIdentityKey(child);
    });
  };
  return containsIdentityKey(value, true);
}

function isTile(value: unknown): value is TileAppearance {
  if (!record(value)) return false;
  const allowed = new Set(['motif', 'color', 'strokeWeight', 'orientation', 'inverted', 'mirrored']);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return isMotif(value.motif)
    && isTileColor(value.color)
    && (value.strokeWeight === 4 || value.strokeWeight === 7)
    && typeof value.orientation === 'number' && turns.has(value.orientation)
    && typeof value.inverted === 'boolean'
    && typeof value.mirrored === 'boolean';
}

function isHint(value: unknown): value is PuzzleHintPositions {
  return Array.isArray(value) && value.length === 2
    && Number.isInteger(value[0]) && Number.isInteger(value[1])
    && value[0] >= 0 && value[0] < 36
    && value[1] >= 0 && value[1] < 36
    && value[0] !== value[1];
}

export function parsePuzzleCandidate(value: unknown): PuzzleCandidate | null {
  if (!record(value) || value.schemaVersion !== 1 || value.size !== 6
    || typeof value.id !== 'string' || value.id.length === 0
    || typeof value.title !== 'string' || typeof value.motifDescription !== 'string'
    || !Array.isArray(value.target) || !Array.isArray(value.start)
    || value.target.length !== 36 || value.start.length !== 36
    || !value.target.every(isTile) || !value.start.every(isTile)
    || !record(value.attemptLimits)) return null;

  const attemptLimits = value.attemptLimits;
  if (![...tierSet].every((id) => typeof attemptLimits[id] === 'number')) return null;
  const hints: Partial<Record<DifficultyTierId, PuzzleHintPositions>> = {};
  if (value.hints !== undefined) {
    if (!record(value.hints)) return null;
    for (const id of Object.keys(value.hints)) {
      if (!tierSet.has(id as DifficultyTierId) || !isHint(value.hints[id])) return null;
      hints[id as DifficultyTierId] = value.hints[id] as PuzzleHintPositions;
    }
  }

  return {
    schemaVersion: 1,
    id: value.id,
    title: value.title,
    motifDescription: value.motifDescription,
    size: 6,
    target: value.target,
    start: value.start,
    attemptLimits: attemptLimits as unknown as PuzzleCandidate['attemptLimits'],
    ...(value.hints === undefined ? {} : { hints }),
  };
}

function hintImproves(hint: PuzzleHintPositions, start: readonly TileAppearance[], target: readonly TileAppearance[]): boolean {
  const [left, right] = hint;
  const before = Number(sameAppearance(start[left]!, target[left]!))
    + Number(sameAppearance(start[right]!, target[right]!));
  const after = Number(sameAppearance(start[right]!, target[left]!))
    + Number(sameAppearance(start[left]!, target[right]!));
  return after > before;
}

function emptyResult(issues: readonly PuzzleValidationIssue[]): PuzzleValidationResult {
  return { valid: false, issues, tiers: [] };
}

export function validatePuzzleCandidate(value: unknown, options: PuzzleValidationOptions = {}): PuzzleValidationResult {
  const issues: PuzzleValidationIssue[] = [];
  if (hasHiddenIdentifier(value)) {
    issues.push({ code: 'hidden-id-dependency', message: 'Remove tile ID fields. Tiles are matched by how they look.' });
    return emptyResult(issues);
  }

  const candidate = parsePuzzleCandidate(value);
  if (!candidate) {
    const input = record(value) ? value : null;
    const target = input?.target;
    const start = input?.start;
    const boardsPresent = Array.isArray(target) && Array.isArray(start);
    const boardShapeValid = boardsPresent && target.length === 36 && start.length === 36;
    const allTilesValid = boardShapeValid && target.every(isTile) && start.every(isTile);
    const code: PuzzleValidationCode = !boardsPresent || !boardShapeValid
      ? 'invalid-board'
      : !allTilesValid ? 'invalid-tile' : 'invalid-candidate';
    issues.push({
      code,
      message: code === 'invalid-candidate'
        ? 'Puzzle metadata or swap limits are invalid.'
        : code === 'invalid-tile' ? 'One or more tiles use an unsupported color, shape, or style.' : 'Add a 6×6 target board and a 6×6 starting board.',
    });
    return emptyResult(issues);
  }

  const tiers: PuzzleTierValidation[] = [];
  for (const config of difficultyTierConfigs) {
    const puzzle = buildDifficultyPuzzle(candidate, config.id);
    const differingPositions = puzzle.start.reduce((count, tile, index) =>
      count + Number(!sameAppearance(tile, puzzle.target[index]!)), 0);
    const exceedsTenSwapBound = differingPositions > 20;
    const minimumSwaps = exceedsTenSwapBound
      ? null
      : minimumVisibleSwaps(puzzle.start, puzzle.target, sameAppearance);
    const attemptLimit = candidate.attemptLimits[config.id];
    let hint = candidate.hints?.[config.id] ?? findProductiveHint(puzzle.start, puzzle.target, sameAppearance);

    if (exceedsTenSwapBound) {
      issues.push({ code: 'incorrect-shortest-solution', message: `The shortest solution in ${config.label.toLowerCase()} mode must be exactly 10 swaps.`, tierId: config.id });
    } else if (minimumSwaps === null) {
      issues.push({ code: 'unsolvable-inventory', message: `The ${config.label.toLowerCase()} starting tiles do not match the target tile set.`, tierId: config.id });
      hint = null;
    } else if (minimumSwaps === 0) {
      issues.push({ code: 'already-solved', message: `The ${config.label.toLowerCase()} starting board already matches the target. Scramble it first.`, tierId: config.id });
      hint = null;
    } else if (minimumSwaps !== 10) {
      issues.push({ code: 'incorrect-shortest-solution', message: `The shortest solution in ${config.label.toLowerCase()} mode must be exactly 10 swaps.`, tierId: config.id });
    }
    if (!Number.isInteger(attemptLimit) || attemptLimit !== config.attemptLimit
      || (minimumSwaps !== null && attemptLimit < minimumSwaps)) {
      issues.push({ code: 'invalid-attempt-limit', message: `Set ${config.label.toLowerCase()} mode to allow exactly ${config.attemptLimit} swaps.`, tierId: config.id });
    }
    if (hint !== null && (!isHint(hint) || !hintImproves(hint, puzzle.start, puzzle.target))) {
      issues.push({ code: 'invalid-hint', message: `The ${config.label.toLowerCase()} hint must use two tiles and improve the board.`, tierId: config.id });
      hint = null;
    }
    if (hint === null && minimumSwaps !== null && minimumSwaps > 0) {
      issues.push({ code: 'invalid-hint', message: `Add a ${config.label.toLowerCase()} hint that improves the board.`, tierId: config.id });
    }

    // Render equivalence is the sole goal contract; this guards accidental hidden fields or renderer gaps.
    for (let index = 0; index < puzzle.target.length; index++) {
      visibleAppearance(puzzle.target[index]!);
      visibleAppearance(puzzle.start[index]!);
    }
    tiers.push({ tierId: config.id, minimumSwaps, attemptLimit, hint, target: puzzle.target, start: puzzle.start });
  }

  const recentTargets = options.recentTargets ?? (options.recentPuzzles ?? []).map(({ target }) => target);
  if (hasRecentVisualDuplicate(candidate.target, 6, recentTargets)) {
    issues.push({ code: 'recent-visual-duplicate', message: 'This target matches a recent puzzle when rotated or reflected. Change its layout or tile directions.' });
  }

  return { valid: issues.length === 0, issues, tiers };
}
