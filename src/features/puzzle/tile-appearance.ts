import type { Motif, TileAppearance } from './puzzle.types.js';

type Point = readonly [number, number];
type Stroke = readonly Point[];

// A motif is geometry, not a UI component. New art never changes the game rules.
export const motifs: Record<Motif, { readonly label: string; readonly strokes: readonly Stroke[] }> = {
  meander: {
    label: 'Greek key',
    strokes: [[[20, 20], [80, 20], [80, 80], [40, 80], [40, 45], [60, 45], [60, 60]]],
  },
  chevron: {
    label: 'double chevron',
    strokes: [ [[22, 24], [50, 48], [78, 24]], [[22, 50], [50, 74], [78, 50]] ],
  },
  diamond: {
    label: 'nested diamonds',
    strokes: [
      [[50, 16], [84, 50], [50, 84], [16, 50], [50, 16]],
      [[50, 37], [63, 50], [50, 63], [37, 50], [50, 37]],
    ],
  },
};

const colors = { teal: '#245951', terracotta: '#a7432e' } as const;
const cream = '#fff9eb';

function transform([x, y]: Point, tile: TileAppearance): Point {
  let dx = tile.mirrored ? 50 - x : x - 50;
  let dy = y - 50;
  for (let turn = 0; turn < tile.orientation; turn += 90) [dx, dy] = [-dy, dx];
  return [dx + 50, dy + 50];
}

const pointsText = (points: Stroke) => points.map(([x, y]) => `${x},${y}`).join(' ');

/** Stroke direction/start point do not change its appearance. */
function canonicalStroke(points: Stroke): string {
  const closed = pointsText([points[0]!]) === pointsText([points.at(-1)!]);
  const vertices = closed ? points.slice(0, -1) : points;
  const candidates: string[] = [];
  for (const direction of [vertices, [...vertices].reverse()]) {
    const starts = closed ? direction.length : 1;
    for (let start = 0; start < starts; start++) {
      const ordered = [...direction.slice(start), ...direction.slice(0, start)];
      candidates.push(pointsText(closed ? [...ordered, ordered[0]!] : ordered));
    }
  }
  return candidates.sort()[0]!;
}

/** Both rendering and equality consume the same final colors and geometry. */
export function visibleAppearance(tile: TileAppearance) {
  return {
    background: tile.inverted ? colors[tile.color] : cream,
    foreground: tile.inverted ? cream : colors[tile.color],
    strokeWeight: tile.strokeWeight,
    strokes: motifs[tile.motif].strokes
      .map((stroke) => canonicalStroke(stroke.map((point) => transform(point, tile))))
      .sort(),
  };
}

export const visualKey = (tile: TileAppearance) => JSON.stringify(visibleAppearance(tile));
export const sameAppearance = (left: TileAppearance, right: TileAppearance) => visualKey(left) === visualKey(right);

export function describeTile(tile: TileAppearance): string {
  return `${tile.color} ${motifs[tile.motif].label}, ${tile.strokeWeight === 7 ? 'bold' : 'fine'} lines, ${tile.orientation} degrees${tile.mirrored ? ', mirrored' : ''}${tile.inverted ? ', light motif on dark background' : ', dark motif on light background'}`;
}
