import { getMotifSet } from './motif-set-catalog.js';
import type { Motif, TileAppearance, TileColor } from './puzzle.types.js';

export const dailyPuzzleTargetCycleLength = 45;
const millisecondsPerDay = 86_400_000;
const boardTypes = [
  { id: 'courtyard', label: 'Courtyard' },
  { id: 'ribbons', label: 'Ribbons' },
  { id: 'compass', label: 'Compass' },
  { id: 'stepped-path', label: 'Stepped path' },
  { id: 'rosette', label: 'Rosette' },
] as const;

export interface DailyPuzzleArt {
  readonly motifSetId: number;
  readonly motifSetName: string;
  readonly boardTypeId: typeof boardTypes[number]['id'];
  readonly boardTypeLabel: typeof boardTypes[number]['label'];
}

function modulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function datePosition(date: string): number {
  if (!isIsoDate(date)) throw new RangeError(`Invalid puzzle date: ${date}`);
  return Math.floor(Date.parse(`${date}T00:00:00.000Z`) / millisecondsPerDay);
}

export function getDailyPuzzleArt(date: string, variation = 0): DailyPuzzleArt {
  if (!Number.isInteger(variation) || variation < 0 || variation >= dailyPuzzleTargetCycleLength) {
    throw new RangeError('Daily art variation is invalid.');
  }
  const cycleIndex = modulo(datePosition(date) + variation, dailyPuzzleTargetCycleLength);
  const motifSet = getMotifSet(modulo(cycleIndex, 9) + 1);
  const boardType = boardTypes[modulo(cycleIndex, boardTypes.length)]!;
  return {
    motifSetId: motifSet.id,
    motifSetName: motifSet.name,
    boardTypeId: boardType.id,
    boardTypeLabel: boardType.label,
  };
}

function motifIndexFor(
  boardTypeId: DailyPuzzleArt['boardTypeId'],
  row: number,
  column: number,
  motifCount: number,
): number {
  const edge = Math.min(row, column, 5 - row, 5 - column);
  const radius = Math.round(Math.hypot(row - 2.5, column - 2.5));
  const angle = Math.atan2(row - 2.5, column - 2.5) + Math.PI;
  switch (boardTypeId) {
    case 'courtyard': return modulo(edge * 2 + Math.floor((row + column) / 2), motifCount);
    case 'ribbons': return modulo(row + column, motifCount);
    case 'compass': return modulo(Math.floor(angle * motifCount / (Math.PI * 2)), motifCount);
    case 'stepped-path': return modulo(Math.floor(row / 2) + column + row % 2, motifCount);
    case 'rosette': return modulo(radius + Math.floor(angle * motifCount / (Math.PI * 2)), motifCount);
  }
}

function colorFor(
  art: DailyPuzzleArt,
  row: number,
  column: number,
  palette: readonly TileColor[],
): TileColor {
  const edge = Math.min(row, column, 5 - row, 5 - column);
  const radius = Math.round(Math.hypot(row - 2.5, column - 2.5));
  const angle = Math.atan2(row - 2.5, column - 2.5) + Math.PI;
  const boardIndex = boardTypes.findIndex(({ id }) => id === art.boardTypeId);
  const colorIndex = art.boardTypeId === 'courtyard'
    ? row + column + edge
    : art.boardTypeId === 'ribbons'
      ? row + Math.floor(column / 2)
      : art.boardTypeId === 'compass'
        ? Math.floor(angle * palette.length / (Math.PI * 2)) + radius
        : art.boardTypeId === 'stepped-path'
          ? row + Math.floor(column / 2) + boardIndex
          : radius + row + column;
  return palette[modulo(colorIndex, palette.length)]!;
}

export function createDailyPuzzleTarget(date: string, variation = 0): {
  readonly art: DailyPuzzleArt;
  readonly target: readonly TileAppearance[];
} {
  const art = getDailyPuzzleArt(date, variation);
  const motifSet = getMotifSet(art.motifSetId);
  const palette: readonly TileColor[] = art.motifSetId === 9
    ? ['indigo', 'terracotta', 'ochre']
    : ['teal', 'terracotta'];
  const turns = [0, 90, 180, 270] as const;
  const boardIndex = boardTypes.findIndex(({ id }) => id === art.boardTypeId);
  const target: TileAppearance[] = Array.from({ length: 36 }, (_, position) => {
    const row = Math.floor(position / 6);
    const column = position % 6;
    const motif: Motif = motifSet.motifs[motifIndexFor(art.boardTypeId, row, column, motifSet.motifs.length)]!;
    return {
      motif,
      color: colorFor(art, row, column, palette),
      strokeWeight: (row * 3 + column + art.motifSetId + boardIndex) % 4 === 0 ? 7 : 4,
      orientation: turns[modulo(row * 3 + column * 2 + art.motifSetId + boardIndex, turns.length)]!,
      inverted: (row + column + boardIndex) % 7 === 0,
      mirrored: (row * 2 + column + art.motifSetId) % 5 === 0,
    };
  });
  return { art, target };
}
