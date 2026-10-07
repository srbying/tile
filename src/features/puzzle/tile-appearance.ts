import { motifArtwork } from './motif-artwork.js';
import type { Motif, TileAppearance, TileColor } from './puzzle.types.js';

type Point = readonly [number, number];
type Stroke = readonly Point[];

const colors: Record<TileColor, string> = {
  teal: '#084888',
  terracotta: '#dc4e36',
  indigo: '#08486f',
  ochre: '#f8c954',
};
const cream = '#f7eee6';
const colorNames: Record<TileColor, string> = {
  teal: 'Aegean blue',
  terracotta: 'coral',
  indigo: 'deep sea blue',
  ochre: 'gold',
};
const pathToken = /[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const transformedStrokes = new Map<string, readonly string[]>();

function arcPoints(
  x1: number,
  y1: number,
  rxValue: number,
  ryValue: number,
  rotation: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
): Point[] {
  let rx = Math.abs(rxValue);
  let ry = Math.abs(ryValue);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x2, y2]];
  const phi = rotation * Math.PI / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const xp = cosPhi * dx + sinPhi * dy;
  const yp = -sinPhi * dx + cosPhi * dy;
  const lambda = xp * xp / (rx * rx) + yp * yp / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }
  const numerator = Math.max(0, rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp);
  const denominator = rx * rx * yp * yp + ry * ry * xp * xp;
  let coefficient = denominator === 0 ? 0 : Math.sqrt(numerator / denominator);
  if (Boolean(largeArc) === Boolean(sweep)) coefficient *= -1;
  const cxp = coefficient * rx * yp / ry;
  const cyp = coefficient * -ry * xp / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  const ux = (xp - cxp) / rx;
  const uy = (yp - cyp) / ry;
  const vx = (-xp - cxp) / rx;
  const vy = (-yp - cyp) / ry;
  const start = Math.atan2(uy, ux);
  let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const steps = Math.max(8, Math.ceil(Math.abs(delta) * 18));
  return Array.from({ length: steps }, (_, index) => {
    const angle = start + delta * (index + 1) / steps;
    return [
      cx + rx * Math.cos(angle) * cosPhi - ry * Math.sin(angle) * sinPhi,
      cy + rx * Math.cos(angle) * sinPhi + ry * Math.sin(angle) * cosPhi,
    ];
  });
}

/** Compile the authored SVG paths once; the game compares and draws the same polylines. */
function parsePath(data: string): readonly Stroke[] {
  const tokens = data.match(pathToken) ?? [];
  const paths: Stroke[] = [];
  let points: Point[] = [];
  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let start: Point = [0, 0];
  const number = () => Number(tokens[index++]);

  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index]!)) command = tokens[index++]!;
    if (command === 'M') {
      if (points.length) paths.push(points);
      x = number();
      y = number();
      start = [x, y];
      points = [[x, y]];
      command = 'L';
    } else if (command === 'L') {
      x = number();
      y = number();
      points.push([x, y]);
    } else if (command === 'H') {
      x = number();
      points.push([x, y]);
    } else if (command === 'V') {
      y = number();
      points.push([x, y]);
    } else if (command === 'C') {
      const x1 = number();
      const y1 = number();
      const x2 = number();
      const y2 = number();
      const nextX = number();
      const nextY = number();
      const startX = x;
      const startY = y;
      for (let step = 1; step <= 16; step++) {
        const t = step / 16;
        const inverse = 1 - t;
        points.push([
          inverse ** 3 * startX + 3 * inverse ** 2 * t * x1 + 3 * inverse * t ** 2 * x2 + t ** 3 * nextX,
          inverse ** 3 * startY + 3 * inverse ** 2 * t * y1 + 3 * inverse * t ** 2 * y2 + t ** 3 * nextY,
        ]);
      }
      x = nextX;
      y = nextY;
    } else if (command === 'A') {
      const rx = number();
      const ry = number();
      const rotation = number();
      const largeArc = number();
      const sweep = number();
      const nextX = number();
      const nextY = number();
      points.push(...arcPoints(x, y, rx, ry, rotation, largeArc, sweep, nextX, nextY));
      x = nextX;
      y = nextY;
    } else if (command === 'Z') {
      if (points.length && (points.at(-1)![0] !== start[0] || points.at(-1)![1] !== start[1])) points.push(start);
      x = start[0];
      y = start[1];
      if (points.length) paths.push(points);
      points = [];
      command = '';
    } else {
      throw new Error(`Unsupported motif path command: ${command}`);
    }
  }
  if (points.length) paths.push(points);
  return paths;
}

export const motifs: Record<Motif, { readonly label: string; readonly strokes: readonly Stroke[] }> =
  Object.fromEntries(Object.entries(motifArtwork).map(([motif, artwork]) => [
    motif,
    { label: artwork.label, strokes: artwork.paths.flatMap(parsePath) },
  ])) as unknown as Record<Motif, { readonly label: string; readonly strokes: readonly Stroke[] }>;

export function isMotif(value: unknown): value is Motif {
  return typeof value === 'string' && Object.hasOwn(motifs, value);
}

export function isTileColor(value: unknown): value is TileColor {
  return typeof value === 'string' && Object.hasOwn(colors, value);
}

function transform([x, y]: Point, tile: TileAppearance): Point {
  let dx = tile.mirrored ? 50 - x : x - 50;
  let dy = y - 50;
  for (let turn = 0; turn < tile.orientation; turn += 90) [dx, dy] = [-dy, dx];
  return [dx + 50, dy + 50];
}

const coordinateText = (value: number) => Number(value.toFixed(2)).toString();
const pointsText = (points: Stroke) => points.map(([x, y]) => `${coordinateText(x)},${coordinateText(y)}`).join(' ');

/** Stroke direction and start point do not change its appearance. */
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
  const geometryKey = `${tile.motif}:${tile.orientation}:${tile.mirrored}`;
  let strokes = transformedStrokes.get(geometryKey);
  if (!strokes) {
    strokes = motifs[tile.motif].strokes
      .map((stroke) => canonicalStroke(stroke.map((point) => transform(point, tile))))
      .sort();
    transformedStrokes.set(geometryKey, strokes);
  }
  return {
    background: tile.inverted ? colors[tile.color] : cream,
    foreground: tile.inverted ? cream : colors[tile.color],
    strokeWeight: tile.strokeWeight,
    strokes,
  };
}

export const visualKey = (tile: TileAppearance) => JSON.stringify(visibleAppearance(tile));
export const sameAppearance = (left: TileAppearance, right: TileAppearance) => visualKey(left) === visualKey(right);

export function describeTile(tile: TileAppearance): string {
  return `${colorNames[tile.color]} ${motifs[tile.motif].label}, ${tile.strokeWeight === 7 ? 'bold' : 'fine'} lines, ${tile.orientation} degrees${tile.mirrored ? ', mirrored' : ''}${tile.inverted ? ', light motif on dark background' : ', dark motif on light background'}`;
}
