import { buildDifficultyPreviews } from './difficulty-preview';
import { samplePuzzle } from './sample-puzzle';
import { describePosition } from './puzzle-board';
import { describeTile } from './tile-appearance';
import { TileArtwork } from './tile-artwork';
import type { TileAppearance } from './puzzle.types';

const previews = buildDifficultyPreviews(samplePuzzle);

function PreviewBoard({
  tiles,
  label,
}: {
  readonly tiles: readonly TileAppearance[];
  readonly label: string;
}) {
  return (
    <ol className="tile-grid target-grid preview-grid" aria-label={label}>
      {tiles.map((tile, position) => (
        <li className="target-tile" key={position}>
          <span className="visually-hidden">{describePosition(position)}: {describeTile(tile)}</span>
          <TileArtwork tile={tile} />
        </li>
      ))}
    </ol>
  );
}

export function DifficultyPreviewPage() {
  return (
    <div className="page-shell">
      <header className="site-header preview-site-header">
        <a className="wordmark" href="/">TILE-SWAP PUZZLE</a>
        <a className="preview-back-link" href="/">Back to the puzzle</a>
      </header>

      <main id="main">
        <section className="intro preview-intro" aria-labelledby="preview-title">
          <h1 id="preview-title">Compare the modes</h1>
          <p className="intro-copy">Same puzzle, different visual clues. Each mode changes how the tiles look.</p>
        </section>

        <div className="tier-preview-list">
          {previews.map((preview, index) => (
            <section className="tier-preview-section" aria-labelledby={`${preview.id}-heading`} key={preview.id}>
              <div className="tier-preview-heading">
                <h2 id={`${preview.id}-heading`}><span className="section-number" aria-hidden="true">0{index + 1}</span> {preview.label}</h2>
                <p>{preview.description}</p>
              </div>
              <div className="tier-board-pair">
                <figure>
                  <figcaption><span className="section-number" aria-hidden="true">01</span> Target</figcaption>
                  <PreviewBoard tiles={preview.target} label={`${preview.label} target pattern`} />
                </figure>
                <figure>
                  <figcaption><span className="section-number" aria-hidden="true">02</span> Your tiles</figcaption>
                  <PreviewBoard tiles={preview.start} label={`${preview.label} starting tiles`} />
                </figure>
              </div>
            </section>
          ))}
        </div>

        <p className="preview-footnote">Pattern names are just labels. No special knowledge is needed to solve the puzzle.</p>
      </main>

      <footer className="site-footer"><span>Small tiles. A clearer picture.</span><span>MODE PREVIEW <span aria-hidden="true">✦</span></span></footer>
    </div>
  );
}
