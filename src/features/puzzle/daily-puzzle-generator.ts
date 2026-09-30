import { buildDifficultyPuzzle, difficultyTierConfigs } from './difficulty-preview.js';
import { validatePuzzleCandidate } from './puzzle-candidate.js';
import { samplePuzzle } from './sample-puzzle.js';
import { canonicalBoardTargetKey, hasRecentVisualDuplicate } from './puzzle-symmetry.js';
import { sameAppearance } from './tile-appearance.js';
import type { DailyPuzzleRelease, DifficultyTierId, PuzzleCandidate, TileAppearance } from './puzzle.types.js';

export const dailyPuzzleGeneratorVersion = 1;
export const dailyPuzzleTargetCycleLength = 67;
const targetCycleLength = dailyPuzzleTargetCycleLength;
const targetVariations = targetCycleLength;
const scramblePlansPerTarget = 4;
const swapsPerPuzzle = 10;
const timezone = 'America/New_York';
type SwapPair = readonly [number, number];

interface TargetPattern {
  readonly target: readonly TileAppearance[];
  readonly scramblePlans: readonly (readonly SwapPair[])[];
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFor(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const partner = Math.floor(random() * (index + 1));
    [result[index], result[partner]] = [result[partner]!, result[index]!];
  }
  return result;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function getNewYorkPuzzleDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function projectAllTiers(target: readonly TileAppearance[], start: readonly TileAppearance[]) {
  return difficultyTierConfigs.map(({ id }) => ({
    id,
    puzzle: buildDifficultyPuzzle({ ...samplePuzzle, target, start }, id),
  }));
}

function makeScramblePlan(target: readonly TileAppearance[], random: () => number): readonly SwapPair[] | null {
  const positions = shuffled(Array.from({ length: 36 }, (_, index) => index), random);
  const plan: SwapPair[] = [];
  for (let index = 0; index < swapsPerPuzzle * 2; index += 2) {
    const left = positions[index]!;
    const right = positions[index + 1]!;
    const usableInEveryTier = projectAllTiers(target, target).every(({ puzzle }) =>
      !sameAppearance(puzzle.target[left]!, puzzle.target[right]!));
    if (!usableInEveryTier) return null;
    plan.push([left, right]);
  }
  return plan;
}

function createTargetCycle(): readonly TargetPattern[] {
  const patterns: TargetPattern[] = [];
  const seen = new Set<string>();
  let candidateIndex = 0;
  while (patterns.length < targetCycleLength && candidateIndex < 100_000) {
    const target = shuffled(samplePuzzle.target, randomFor(`daily-v${dailyPuzzleGeneratorVersion}:target:${candidateIndex}`));
    candidateIndex++;
    const key = canonicalBoardTargetKey(target, 6);
    if (seen.has(key)) continue;

    const scramblePlans: SwapPair[][] = [];
    for (let planIndex = 0; planIndex < 512 && scramblePlans.length < scramblePlansPerTarget; planIndex++) {
      const plan = makeScramblePlan(target, randomFor(`daily-v${dailyPuzzleGeneratorVersion}:plan:${candidateIndex}:${planIndex}`));
      if (plan) scramblePlans.push([...plan]);
    }
    if (scramblePlans.length < scramblePlansPerTarget) continue;
    patterns.push({ target, scramblePlans });
    seen.add(key);
  }
  if (patterns.length !== targetCycleLength) throw new Error('Could not build the daily target cycle.');
  return patterns;
}

const targetCycle = createTargetCycle();

function dateCyclePosition(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).valueOf() / 86400000) % targetCycleLength;
}

function targetForVariation(date: string, variation: number): readonly TileAppearance[] {
  const index = ((dateCyclePosition(date) + variation) % targetCycleLength + targetCycleLength) % targetCycleLength;
  return targetCycle[index]!.target;
}

function createCandidate(date: string, variation: number, scramble: number): PuzzleCandidate | null {
  const cycleIndex = ((dateCyclePosition(date) + variation) % targetCycleLength + targetCycleLength) % targetCycleLength;
  const pattern = targetCycle[cycleIndex]!;
  const target = [...pattern.target];
  const start = [...target];
  const planIndex = scramble % pattern.scramblePlans.length;
  const pairs = pattern.scramblePlans[planIndex]!;

  for (const [left, right] of pairs) {
    [start[left], start[right]] = [start[right]!, start[left]!];
  }

  const id = `daily-v${dailyPuzzleGeneratorVersion}-${date}-${variation}-${planIndex}`;
  const candidate: PuzzleCandidate = {
    schemaVersion: 1,
    id,
    title: 'The daily mosaic',
    motifDescription: 'A changing arrangement of ancient-inspired tile motifs.',
    size: 6,
    target,
    start,
    attemptLimits: { easy: 15, medium: 13, hard: 10 },
  };
  const validation = validatePuzzleCandidate(candidate);
  if (!validation.valid || validation.tiers.some(({ minimumSwaps }) => minimumSwaps !== swapsPerPuzzle)) return null;

  const hints = Object.fromEntries(validation.tiers.map(({ tierId, hint }) => [tierId, hint])) as PuzzleCandidate['hints'];
  if (Object.values(hints ?? {}).some((hint) => hint === null || hint === undefined)) return null;
  return { ...candidate, hints };
}

function candidateForVariation(date: string, variation: number, preferredScramble?: number): PuzzleCandidate | null {
  const patternIndex = ((dateCyclePosition(date) + variation) % targetCycleLength + targetCycleLength) % targetCycleLength;
  const plans = targetCycle[patternIndex]!.scramblePlans;
  const scramble = preferredScramble ?? Math.floor(randomFor(`${date}:scramble:${variation}`)() * plans.length);
  return scramble >= 0 && scramble < plans.length ? createCandidate(date, variation, scramble) : null;
}

function generateDailyPuzzleForTargets(
  date: string,
  recentTargets: readonly (readonly TileAppearance[])[],
): DailyPuzzleRelease {
  if (!isIsoDate(date)) throw new RangeError(`Invalid puzzle date: ${date}`);
  for (let variation = 0; variation < targetVariations; variation++) {
    const target = targetForVariation(date, variation);
    if (hasRecentVisualDuplicate(target, 6, recentTargets)) continue;
    const candidate = candidateForVariation(date, variation);
    if (candidate) {
      return {
        puzzleId: candidate.id,
        releaseDate: date,
        generatorVersion: dailyPuzzleGeneratorVersion,
        puzzle: candidate,
      };
    }
  }
  throw new Error(`No validated daily puzzle found for ${date}`);
}

export function generateDailyPuzzle(
  date: string,
  recentPuzzles: readonly PuzzleCandidate[] = [],
): DailyPuzzleRelease {
  return generateDailyPuzzleForTargets(date, recentPuzzles.map(({ target }) => target));
}

export function generateDailyCandidate(date: string, variation = 0): PuzzleCandidate {
  if (!isIsoDate(date) || !Number.isInteger(variation) || variation < 0 || variation >= targetVariations) {
    throw new RangeError('Candidate date or variation is invalid.');
  }
  const candidate = candidateForVariation(date, variation);
  if (!candidate) throw new Error(`No validated candidate found for ${date}.`);
  return candidate;
}

export function dailyPuzzleFromId(puzzleId: string): DailyPuzzleRelease | null {
  const match = /^daily-v(\d+)-(\d{4}-\d{2}-\d{2})-(\d+)-(\d+)$/.exec(puzzleId);
  if (!match || Number(match[1]) !== dailyPuzzleGeneratorVersion || !isIsoDate(match[2]!)) return null;
  const [, , releaseDate, variationText, scrambleText] = match;
  const puzzle = createCandidate(releaseDate!, Number(variationText), Number(scrambleText));
  if (!puzzle || puzzle.id !== puzzleId) return null;
  return { puzzleId, releaseDate: releaseDate!, generatorVersion: dailyPuzzleGeneratorVersion, puzzle };
}

export function getRecentPuzzleTargets(date: string, count = 30): readonly (readonly TileAppearance[])[] {
  if (!isIsoDate(date) || !Number.isInteger(count) || count < 0 || count > 30) {
    throw new RangeError('Recent puzzle window must be between 0 and 30 days.');
  }
  const recent: (readonly TileAppearance[])[] = [];
  const utcDay = new Date(`${date}T00:00:00.000Z`);
  for (let daysAgo = count; daysAgo >= 1; daysAgo--) {
    const previousDate = new Date(utcDay.valueOf() - daysAgo * 86400000).toISOString().slice(0, 10);
    recent.push(targetForVariation(previousDate, 0));
  }
  return recent;
}

export function getDailyPuzzleForNow(now = new Date()): DailyPuzzleRelease {
  const releaseDate = getNewYorkPuzzleDate(now);
  const recentTargets = getRecentPuzzleTargets(releaseDate, 30);
  return generateDailyPuzzleForTargets(releaseDate, recentTargets);
}

export function getDailyPuzzleForId(puzzleId: string): DailyPuzzleRelease | null {
  return dailyPuzzleFromId(puzzleId);
}

export type DailyPuzzleTier = DifficultyTierId;
