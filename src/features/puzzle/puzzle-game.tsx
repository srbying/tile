import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildDifficultyPuzzle, difficultyTierConfigs, getDifficultyTierConfig } from './difficulty-preview';
import type { DifficultyTierId, DifficultyTierConfig } from './difficulty-preview';
import { createPuzzleEngine } from './puzzle-engine';
import { PuzzleBoard, TargetBoard, describePosition } from './puzzle-board';
import { samplePuzzle } from './sample-puzzle';
import { sameAppearance } from './tile-appearance';
import {
  createActiveSolveTimer,
  formatActiveSolveTime,
  getActiveSolveMilliseconds,
  setActiveSolveTimerVisibility,
  startActiveSolveTimer,
  stopActiveSolveTimer,
} from './active-solve-timer';

function MosaicMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      <path d="M15 1 29 15 15 29 1 15Z" fill="currentColor" />
      <path d="m15 7 8 8-8 8-8-8Z" fill="none" stroke="#f5f0e5" strokeWidth="2" />
      <path d="m15 12 3 3-3 3-3-3Z" fill="#f5f0e5" />
    </svg>
  );
}

function GameHeader() {
  return (
    <header className="site-header">
      <a className="wordmark" href="#main"><MosaicMark /><span>TILE-SWAP PUZZLE</span></a>
      <a className="preview-navigation-link" href="/preview">Compare difficulty art</a>
      <span className="edition">A moment of order</span>
    </header>
  );
}

function GameFooter() {
  return <footer className="site-footer"><span>Small tiles. A clearer picture.</span><span>SAMPLE COLLECTION <span aria-hidden="true">✦</span> 001</span></footer>;
}

function ModeSelection({
  selectedTier,
  onSelect,
  onStart,
}: {
  readonly selectedTier: DifficultyTierId;
  readonly onSelect: (tier: DifficultyTierId) => void;
  readonly onStart: () => void;
}) {
  return (
    <div className="page-shell">
      <GameHeader />
      <main id="main">
        <section className="intro mode-intro" aria-labelledby="game-title">
          <div className="eyebrow"><span className="small-rule" /> AN EVERYDAY MOSAIC</div>
          <h1 id="game-title">Daily Tile-Swap Puzzle<span className="title-dot">.</span></h1>
          <p className="intro-copy">Choose a challenge. Same courtyard, same tile placement.</p>
          <div className="puzzle-caption"><span className="sample-badge">SAMPLE Nº 01</span><span>{samplePuzzle.title}</span></div>
        </section>

        <section className="mode-selection" aria-labelledby="mode-heading">
          <div className="mode-heading">
            <h2 id="mode-heading">Choose your mode</h2>
            <p>Attempt budget and visual similarity change by mode.</p>
          </div>
          <fieldset className="mode-options">
            <legend className="visually-hidden">Difficulty mode</legend>
            {difficultyTierConfigs.map((tier) => (
              <label
                className={`mode-option${selectedTier === tier.id ? ' is-selected' : ''}`}
                htmlFor={`difficulty-${tier.id}`}
                key={tier.id}
              >
                <input
                  type="radio"
                  id={`difficulty-${tier.id}`}
                  name="difficulty"
                  value={tier.id}
                  checked={selectedTier === tier.id}
                  onChange={() => onSelect(tier.id)}
                  aria-labelledby={`difficulty-${tier.id}-label difficulty-${tier.id}-budget`}
                  aria-describedby={`difficulty-${tier.id}-details`}
                />
                <span className="mode-option-copy">
                  <span className="mode-option-heading">
                    <span className="mode-option-title" id={`difficulty-${tier.id}-label`}>{tier.label}</span>
                    <span className="mode-option-budget" id={`difficulty-${tier.id}-budget`}>{tier.attemptLimit} swaps</span>
                  </span>
                  <span className="mode-option-description" id={`difficulty-${tier.id}-details`}>{tier.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button className="start-puzzle" type="button" onClick={onStart}>Start puzzle</button>
        </section>
      </main>
      <GameFooter />
    </div>
  );
}

function PuzzleRound({ tier }: { readonly tier: DifficultyTierConfig }) {
  const puzzle = useMemo(() => buildDifficultyPuzzle(samplePuzzle, tier.id), [tier.id]);
  const engine = useMemo(
    () => createPuzzleEngine(puzzle, { sameAppearance, attemptLimit: tier.attemptLimit }),
    [puzzle, tier.attemptLimit],
  );
  const [state, dispatch] = useReducer(engine.reduce, undefined, engine.initialize);
  const timer = useRef(createActiveSolveTimer());
  const [activeElapsedMilliseconds, setActiveElapsedMilliseconds] = useState<number | null>(null);
  const won = state.status === 'won';
  const lost = state.status === 'lost';
  const terminal = won || lost;
  const attemptsRemaining = state.attemptLimit - state.attemptsUsed;
  const selected = state.selectedPosition;
  const message = won
    ? 'Puzzle complete. The pattern is restored.'
    : lost
      ? 'No attempts remaining. The pattern was not restored.'
      : selected === null
      ? `${attemptsRemaining} of ${state.attemptLimit} swaps remaining. Choose any tile to begin a swap.`
      : `${describePosition(selected)} selected. Choose another tile to swap, or clear your selection.`;
  const hintMessage = state.hintedPositions === null
    ? null
    : `Hint: Swap ${describePosition(state.hintedPositions[0])} with ${describePosition(state.hintedPositions[1])} to move closer to the target.`;

  useEffect(() => {
    const updateVisibility = () => {
      timer.current = setActiveSolveTimerVisibility(
        timer.current,
        document.visibilityState === 'visible',
        performance.now(),
      );
    };
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  const activatePosition = (position: number) => {
    const action = { type: 'activate', position } as const;
    const commitsSwap = state.status === 'playing'
      && state.selectedPosition !== null
      && state.selectedPosition !== position;

    if (commitsSwap) {
      const now = performance.now();
      timer.current = startActiveSolveTimer(timer.current, now, document.visibilityState === 'visible');
      const nextState = engine.reduce(state, action);
      if (nextState.status !== 'playing') {
        const stopped = stopActiveSolveTimer(timer.current, now);
        timer.current = stopped;
        setActiveElapsedMilliseconds(getActiveSolveMilliseconds(stopped, now));
      }
    }

    dispatch(action);
  };

  return (
    <div className="page-shell">
      <GameHeader />
      <main id="main">
        <section className="intro" aria-labelledby="game-title">
          <div className="eyebrow"><span className="small-rule" /> AN EVERYDAY MOSAIC</div>
          <h1 id="game-title">Daily Tile-Swap Puzzle<span className="title-dot">.</span></h1>
          <p id="game-instruction" className="intro-copy">Match the target. Tap two tiles to swap them.</p>
          <div className="puzzle-caption"><span className="sample-badge">SAMPLE Nº 01</span><span>{samplePuzzle.title}</span><span className="mode-badge">{tier.label} mode</span></div>
        </section>

        <div className="game-layout">
          <section className="board-section" aria-labelledby="target-heading">
            <div className="board-heading">
              <h2 id="target-heading"><span className="section-number">01</span> The target</h2>
              <span className="board-tag">LOOK CLOSELY</span>
            </div>
            <TargetBoard tiles={puzzle.target} />
            <p className="board-note"><span aria-hidden="true">◇</span> A little symmetry, waiting to be restored.</p>
          </section>

          <section className="board-section" aria-labelledby="board-heading">
            <div className="board-heading">
              <h2 id="board-heading"><span className="section-number">02</span> Your mosaic</h2>
              <span className={`board-tag progress-tag${won ? ' complete-tag' : ''}${lost ? ' failed-tag' : ''}`}>
                <span aria-hidden="true">{won ? '✓' : lost ? '×' : '○'}</span> {won ? 'RESTORED' : lost ? 'OUT OF SWAPS' : 'IN PROGRESS'}
              </span>
            </div>
            <PuzzleBoard
              state={state}
              onActivate={activatePosition}
              onCancel={() => dispatch({ type: 'cancel' })}
            />
            <p className="attempt-count">{attemptsRemaining} of {state.attemptLimit} swaps remaining</p>
            {terminal && (
              <div className={`round-result${won ? ' won-result' : ' lost-result'}`} aria-label="Round result">
                <strong>{tier.label} mode</strong>
                <span>{state.attemptsUsed} of {state.attemptLimit} swaps used</span>
                <span>Active time: {formatActiveSolveTime(activeElapsedMilliseconds ?? 0)}</span>
                <span>{state.hintUsed ? 'Assisted (hint used)' : 'Unassisted'}</span>
                <span className="result-motif">Motif: {puzzle.motifDescription}</span>
              </div>
            )}
            <div className={`game-feedback${won ? ' complete-feedback' : ''}${lost ? ' failed-feedback' : ''}`}>
              <output aria-live="polite" aria-atomic="true">
                <span className="feedback-icon" aria-hidden="true">{won ? '✓' : lost ? '×' : '↔'}</span>{message}
              </output>
              <p className="hint-instruction" id="hint-instruction" aria-live="polite">{hintMessage ?? ''}</p>
              <div className="game-actions">
                <button className="clear-selection" type="button" tabIndex={0} disabled={selected === null || terminal} onClick={() => dispatch({ type: 'cancel' })}>Clear selection</button>
                <button className="hint-button" type="button" disabled={state.hintUsed || terminal} onClick={() => dispatch({ type: 'useHint' })}>Use hint</button>
              </div>
            </div>
          </section>
        </div>

        <aside className="how-to-play" aria-label="Playing tips">
          <p><span className="tip-number">1</span> Pick a tile.</p>
          <p><span className="tip-number">2</span> Pick another. They trade places.</p>
          <p><span className="tip-number">3</span> Bring the pattern together.</p>
        </aside>
        <p className="keyboard-note" id="keyboard-instruction">Keyboard: Tab to a tile, then Enter or Space to select and swap. Escape clears selection.<br />Tap a selected tile again to cancel. Each swap uses one attempt.</p>
      </main>
      <GameFooter />
    </div>
  );
}

export function PuzzleGame() {
  const [selectedTier, setSelectedTier] = useState<DifficultyTierId>('medium');
  const [started, setStarted] = useState(false);
  const tier = getDifficultyTierConfig(selectedTier);

  return started
    ? <PuzzleRound key={selectedTier} tier={tier} />
    : <ModeSelection selectedTier={selectedTier} onSelect={setSelectedTier} onStart={() => setStarted(true)} />;
}
