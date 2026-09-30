import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildDifficultyPuzzle, difficultyTierConfigs, getDifficultyTierConfig } from './difficulty-preview';
import type { DifficultyTierId, DifficultyTierConfig } from './difficulty-preview';
import { createPuzzleEngine } from './puzzle-engine';
import { PuzzleBoard, TargetBoard, describePosition } from './puzzle-board';
import { parsePuzzleCandidate, validatePuzzleCandidate } from './puzzle-candidate';
import { createPuzzleProgressRepository } from './puzzle-progress';
import type { PuzzleProgressRepository } from './puzzle-progress';
import type { DailyPuzzleRelease, SavedPuzzleProgressV1 } from './puzzle.types';
import { sameAppearance } from './tile-appearance';
import {
  createActiveSolveTimer,
  formatActiveSolveTime,
  getActiveSolveMilliseconds,
  resumeActiveSolveTimer,
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

function GameFooter({ releaseDate }: { readonly releaseDate?: string } = {}) {
  return <footer className="site-footer"><span>Small tiles. A clearer picture.</span><span>{releaseDate ? `DAILY PUZZLE · ${releaseDate}` : 'SAMPLE COLLECTION'} <span aria-hidden="true">✦</span></span><a href="/author">Offline authoring</a></footer>;
}

function ModeSelection({
  selectedTier,
  puzzle,
  releaseDate,
  onSelect,
  onStart,
}: {
  readonly selectedTier: DifficultyTierId;
  readonly puzzle: DailyPuzzleRelease['puzzle'];
  readonly releaseDate: string;
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
          <p className="intro-copy">Choose a challenge. Same daily mosaic, same tile placement.</p>
          <div className="puzzle-caption"><span className="sample-badge">DAILY Nº {releaseDate}</span><span>{puzzle.title}</span></div>
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
                    <span className="mode-option-budget" id={`difficulty-${tier.id}-budget`}>{puzzle.attemptLimits[tier.id]} swaps</span>
                  </span>
                  <span className="mode-option-description" id={`difficulty-${tier.id}-details`}>{tier.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button className="start-puzzle" type="button" onClick={onStart}>Start puzzle</button>
        </section>
      </main>
      <GameFooter releaseDate={releaseDate} />
    </div>
  );
}

function PuzzleRound({
  tier,
  release,
  restoredProgress,
  progressRepository,
}: {
  readonly tier: DifficultyTierConfig;
  readonly release: DailyPuzzleRelease;
  readonly restoredProgress: SavedPuzzleProgressV1 | null;
  readonly progressRepository: PuzzleProgressRepository;
}) {
  const puzzle = useMemo(() => buildDifficultyPuzzle(release.puzzle, tier.id), [release.puzzle, tier.id]);
  const attemptLimit = release.puzzle.attemptLimits[tier.id];
  const engine = useMemo(
    () => createPuzzleEngine(puzzle, { sameAppearance, attemptLimit }),
    [puzzle, attemptLimit],
  );
  const [state, dispatch] = useReducer(
    engine.reduce,
    restoredProgress,
    (saved) => saved ? engine.restore(saved) ?? engine.initialize() : engine.initialize(),
  );
  const checkpointState = useRef(state);
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

  const saveProgress = useCallback((nextState: typeof state, now: number) => {
    progressRepository.save({
      version: 1,
      puzzleId: release.puzzleId,
      tierId: tier.id,
      board: nextState.board,
      attemptsUsed: nextState.attemptsUsed,
      hintUsed: nextState.hintUsed,
      hintedPositions: nextState.hintedPositions,
      elapsedMilliseconds: getActiveSolveMilliseconds(timer.current, now),
    });
  }, [progressRepository, release.puzzleId, tier.id]);

  useEffect(() => {
    if (!restoredProgress) return;
    timer.current = resumeActiveSolveTimer(
      restoredProgress.elapsedMilliseconds,
      restoredProgress.attemptsUsed > 0,
      performance.now(),
      document.visibilityState === 'visible',
    );
  }, [restoredProgress]);

  useEffect(() => {
    const checkpoint = (now: number) => {
      const currentState = checkpointState.current;
      if (currentState.status === 'playing' && (currentState.attemptsUsed > 0 || currentState.hintUsed)) {
        saveProgress(currentState, now);
      }
    };
    const setVisibility = (visible: boolean) => {
      const now = performance.now();
      timer.current = setActiveSolveTimerVisibility(timer.current, visible, now);
      if (!visible) checkpoint(now);
    };
    const updateVisibility = () => setVisibility(document.visibilityState === 'visible');
    const onPageHide = () => setVisibility(false);
    const onPageShow = () => updateVisibility();

    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [saveProgress]);

  const activatePosition = (position: number) => {
    const action = { type: 'activate', position } as const;
    const nextState = engine.reduce(state, action);
    checkpointState.current = nextState;
    const commitsSwap = state.status === 'playing'
      && state.selectedPosition !== null
      && state.selectedPosition !== position;

    if (commitsSwap) {
      const now = performance.now();
      timer.current = startActiveSolveTimer(timer.current, now, document.visibilityState === 'visible');
      if (nextState.status !== 'playing') {
        const stopped = stopActiveSolveTimer(timer.current, now);
        timer.current = stopped;
        setActiveElapsedMilliseconds(getActiveSolveMilliseconds(stopped, now));
        progressRepository.clear();
      } else {
        saveProgress(nextState, now);
      }
    }

    dispatch(action);
  };

  const useHint = () => {
    const nextState = engine.reduce(state, { type: 'useHint' });
    checkpointState.current = nextState;
    if (nextState !== state) saveProgress(nextState, performance.now());
    dispatch({ type: 'useHint' });
  };

  return (
    <div className="page-shell">
      <GameHeader />
      <main id="main">
        <section className="intro" aria-labelledby="game-title">
          <div className="eyebrow"><span className="small-rule" /> AN EVERYDAY MOSAIC</div>
          <h1 id="game-title">Daily Tile-Swap Puzzle<span className="title-dot">.</span></h1>
          <p id="game-instruction" className="intro-copy">Match the target. Tap two tiles to swap them.</p>
          <div className="puzzle-caption"><span className="sample-badge">DAILY Nº {release.releaseDate}</span><span>{release.puzzle.title}</span><span className="mode-badge">{tier.label} mode</span></div>
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
                <button className="hint-button" type="button" disabled={state.hintUsed || terminal} onClick={useHint}>Use hint</button>
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
      <GameFooter releaseDate={release.releaseDate} />
    </div>
  );
}

function LoadingPuzzle() {
  return <main id="main" className="page-shell"><output className="daily-load-message">Preparing today’s mosaic…</output></main>;
}

function PuzzleLoadError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <main id="main" className="page-shell">
      <section className="daily-load-message" aria-labelledby="daily-error-heading">
        <h1 id="daily-error-heading">Today’s puzzle is unavailable</h1>
        <p>Daily puzzle generation could not be verified. Try again shortly.</p>
        <button className="start-puzzle" type="button" onClick={onRetry}>Retry puzzle load</button>
      </section>
    </main>
  );
}

export function PuzzleGame() {
  const [progressRepository] = useState(() => createPuzzleProgressRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  }));
  const [selectedTier, setSelectedTier] = useState<DifficultyTierId>('medium');
  const [started, setStarted] = useState(false);
  const [release, setRelease] = useState<DailyPuzzleRelease | null>(null);
  const [restoredProgress, setRestoredProgress] = useState<SavedPuzzleProgressV1 | null>(null);
  const [loadingError, setLoadingError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const tier = getDifficultyTierConfig(selectedTier);

  const fetchRelease = useCallback(async (path: string, signal: AbortSignal): Promise<DailyPuzzleRelease | null> => {
    const response = await fetch(path, { cache: 'no-store', signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Puzzle request failed.');
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Invalid release.');
    const value = payload as Record<string, unknown>;
    const puzzle = parsePuzzleCandidate(value.puzzle);
    if (!puzzle || value.puzzleId !== puzzle.id || typeof value.releaseDate !== 'string'
      || value.generatorVersion !== 1 || !validatePuzzleCandidate(puzzle).valid) throw new Error('Invalid release.');
    return {
      puzzleId: value.puzzleId,
      releaseDate: value.releaseDate,
      generatorVersion: value.generatorVersion,
      puzzle,
    };
  }, []);

  const loadPuzzle = useCallback(async (signal: AbortSignal) => {
    const saved = progressRepository.load();
    if (saved) {
      const savedRelease = await fetchRelease(`/api/puzzles/${encodeURIComponent(saved.puzzleId)}`, signal);
      if (savedRelease?.puzzleId === saved.puzzleId) {
        const savedTier = getDifficultyTierConfig(saved.tierId);
        const savedPuzzle = buildDifficultyPuzzle(savedRelease.puzzle, savedTier.id);
        const savedEngine = createPuzzleEngine(savedPuzzle, {
          sameAppearance,
          attemptLimit: savedRelease.puzzle.attemptLimits[savedTier.id],
        });
        if (savedEngine.restore(saved)) return { release: savedRelease, restoredProgress: saved };
      }
      progressRepository.clear();
    }

    const dailyRelease = await fetchRelease('/api/puzzles/today', signal);
    if (!dailyRelease) throw new Error('Daily puzzle is unavailable.');
    return { release: dailyRelease, restoredProgress: null };
  }, [fetchRelease, progressRepository]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPuzzle(controller.signal).then((loaded) => {
      setRelease(loaded.release);
      setRestoredProgress(loaded.restoredProgress);
      setLoadingError(false);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setRelease(null);
        setLoadingError(true);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [loadPuzzle, loadAttempt]);
  if (loading) return <LoadingPuzzle />;
  if (loadingError || !release) return <PuzzleLoadError onRetry={() => {
    setLoading(true);
    setLoadingError(false);
    setLoadAttempt((attempt) => attempt + 1);
  }} />;
  if (restoredProgress) {
    const restoredTier = getDifficultyTierConfig(restoredProgress.tierId);
    return <PuzzleRound
      key={`${release.puzzleId}-${restoredTier.id}`}
      tier={restoredTier}
      release={release}
      restoredProgress={restoredProgress}
      progressRepository={progressRepository}
    />;
  }
  return started
    ? <PuzzleRound
      key={`${release.puzzleId}-${selectedTier}`}
      tier={tier}
      release={release}
      restoredProgress={null}
      progressRepository={progressRepository}
    />
    : <ModeSelection
      selectedTier={selectedTier}
      puzzle={release.puzzle}
      releaseDate={release.releaseDate}
      onSelect={setSelectedTier}
      onStart={() => setStarted(true)}
    />;
}
