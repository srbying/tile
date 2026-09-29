import { useReducer } from 'react';
import { createPuzzleEngine } from './puzzle-engine';
import { PuzzleBoard, TargetBoard, describePosition } from './puzzle-board';
import { samplePuzzle } from './sample-puzzle';
import { sameAppearance } from './tile-appearance';

const engine = createPuzzleEngine(samplePuzzle, sameAppearance);

function MosaicMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      <path d="M15 1 29 15 15 29 1 15Z" fill="currentColor" />
      <path d="m15 7 8 8-8 8-8-8Z" fill="none" stroke="#f5f0e5" strokeWidth="2" />
      <path d="m15 12 3 3-3 3-3-3Z" fill="#f5f0e5" />
    </svg>
  );
}

export function PuzzleGame() {
  const [state, dispatch] = useReducer(engine.reduce, undefined, engine.initialize);
  const solved = state.status === 'solved';
  const selected = state.selectedPosition;
  const message = solved
    ? 'Puzzle complete. The pattern is restored.'
    : selected === null
      ? 'Choose any tile to begin a swap.'
      : `${describePosition(selected)} selected. Choose another tile to swap, or clear your selection.`;

  return (
    <div className="page-shell">
      <header className="site-header">
        <a className="wordmark" href="#main"><MosaicMark /><span>TILE-SWAP PUZZLE</span></a>
        <a className="preview-navigation-link" href="/preview">Compare difficulty art</a>
        <span className="edition">A moment of order</span>
      </header>

      <main id="main">
        <section className="intro" aria-labelledby="game-title">
          <div className="eyebrow"><span className="small-rule" /> AN EVERYDAY MOSAIC</div>
          <h1 id="game-title">Daily Tile-Swap Puzzle<span className="title-dot">.</span></h1>
          <p id="game-instruction" className="intro-copy">Match the target. Tap two tiles to swap them.</p>
          <div className="puzzle-caption"><span className="sample-badge">SAMPLE Nº 01</span><span>{samplePuzzle.title}</span></div>
        </section>

        <div className="game-layout">
          <section className="board-section" aria-labelledby="target-heading">
            <div className="board-heading">
              <h2 id="target-heading"><span className="section-number">01</span> The target</h2>
              <span className="board-tag">LOOK CLOSELY</span>
            </div>
            <TargetBoard tiles={samplePuzzle.target} />
            <p className="board-note"><span aria-hidden="true">◇</span> A little symmetry, waiting to be restored.</p>
          </section>

          <section className="board-section" aria-labelledby="board-heading">
            <div className="board-heading">
              <h2 id="board-heading"><span className="section-number">02</span> Your mosaic</h2>
              <span className={`board-tag progress-tag${solved ? ' complete-tag' : ''}`}><span aria-hidden="true">{solved ? '✓' : '○'}</span> {solved ? 'RESTORED' : 'IN PROGRESS'}</span>
            </div>
            <PuzzleBoard state={state} onActivate={(position) => dispatch({ type: 'activate', position })} onCancel={() => dispatch({ type: 'cancel' })} />
            <div className={`game-feedback${solved ? ' complete-feedback' : ''}`}>
              <output aria-live="polite" aria-atomic="true"><span className="feedback-icon" aria-hidden="true">{solved ? '✓' : '↔'}</span>{message}</output>
              <button className="clear-selection" type="button" tabIndex={0} disabled={selected === null || solved} onClick={() => dispatch({ type: 'cancel' })}>Clear selection</button>
            </div>
          </section>
        </div>

        <aside className="how-to-play" aria-label="Playing tips">
          <p><span className="tip-number">1</span> Pick a tile.</p>
          <p><span className="tip-number">2</span> Pick another. They trade places.</p>
          <p><span className="tip-number">3</span> Bring the pattern together.</p>
        </aside>
        <p className="keyboard-note" id="keyboard-instruction">Keyboard: Tab to a tile, then Enter or Space to select and swap. Escape clears selection.<br />Tap a selected tile again to cancel. Take your time — there’s no move limit.</p>
      </main>

      <footer className="site-footer"><span>Small tiles. A clearer picture.</span><span>SAMPLE COLLECTION <span aria-hidden="true">✦</span> 001</span></footer>
    </div>
  );
}
