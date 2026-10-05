import { visibleAppearance } from './tile-appearance';
import { motifArtwork } from './motif-artwork';
import type { TileAppearance } from './puzzle.types';

export function TileArtwork({ tile }: { readonly tile: TileAppearance }) {
  const appearance = visibleAppearance(tile);
  return (
    <svg className="tile-artwork" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect width="100" height="100" fill={appearance.background} />
      <g
        fill="none"
        stroke={appearance.foreground}
        strokeWidth={appearance.strokeWeight}
        strokeLinecap={motifArtwork[tile.motif].lineCap ?? 'square'}
        strokeLinejoin={motifArtwork[tile.motif].lineJoin ?? 'miter'}
      >
        {appearance.strokes.map((points) => <polyline key={points} points={points} />)}
      </g>
    </svg>
  );
}
