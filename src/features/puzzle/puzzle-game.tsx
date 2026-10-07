import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildDifficultyPuzzle, difficultyTierConfigs, getDifficultyTierConfig } from './difficulty-preview';
import type { DifficultyTierId, DifficultyTierConfig } from './difficulty-preview';
import { createPuzzleEngine } from './puzzle-engine';
import { PuzzleBoard, TargetBoard, describePosition } from './puzzle-board';
import { createPuzzleCompletionRepository, createPuzzleProgressRepository } from './puzzle-progress';
import type { PuzzleCompletionsByTier, PuzzleProgressRepository } from './puzzle-progress';
import type { DailyPuzzleRelease, SavedPuzzleCompletionV1, SavedPuzzleProgressV1 } from './puzzle.types';
import { getNextNewYorkMidnight, getNewYorkPuzzleDate } from './daily-puzzle-generator';
import {
  createDailyPuzzleReleaseCache,
  createDailyPuzzleReleaseLoader,
} from './daily-puzzle-release-cache';
import { sameAppearance } from './tile-appearance';
import { buildResultShareText } from './result-sharing';
import {
  createActiveSolveTimer,
  formatActiveSolveTime,
  getActiveSolveMilliseconds,
  resumeActiveSolveTimer,
  setActiveSolveTimerVisibility,
  startActiveSolveTimer,
  stopActiveSolveTimer,
} from './active-solve-timer';

function GameHeader() {
  return (
    <header className="site-header">
      <a className="wordmark" href="/">TILE-SWAP PUZZLE</a>
      <a className="preview-navigation-link" href="/preview">Compare difficulty art</a>
    </header>
  );
}

function GameFooter({ releaseDate }: { readonly releaseDate?: string } = {}) {
  return <footer className="site-footer"><span>Small tiles. A clearer picture.</span><span>{releaseDate ? `DAILY PUZZLE · ${releaseDate}` : 'SAMPLE COLLECTION'}</span><a href="/author">Offline authoring</a></footer>;
}

function validatePuzzleCompletions(
  release: DailyPuzzleRelease,
  completions: PuzzleCompletionsByTier,
): PuzzleCompletionsByTier {
  const valid: PuzzleCompletionsByTier = {};
  for (const tier of difficultyTierConfigs) {
    const completion = completions[tier.id];
    if (!completion || completion.puzzleId !== release.puzzleId || completion.tierId !== tier.id) continue;
    const puzzle = buildDifficultyPuzzle(release.puzzle, tier.id);
    const engine = createPuzzleEngine(puzzle, {
      sameAppearance,
      attemptLimit: release.puzzle.attemptLimits[tier.id],
    });
    if (engine.restoreCompletion(completion)) valid[tier.id] = completion;
  }
  return valid;
}

function isCompletionSnapshot(
  saved: SavedPuzzleCompletionV1 | SavedPuzzleProgressV1,
): saved is SavedPuzzleCompletionV1 {
  return 'status' in saved && (saved.status === 'won' || saved.status === 'lost');
}

function ModeSelection({
  selectedTier,
  puzzle,
  releaseDate,
  cachedCopy,
  completions,
  onSelect,
  onStart,
}: {
  readonly selectedTier: DifficultyTierId;
  readonly puzzle: DailyPuzzleRelease['puzzle'];
  readonly releaseDate: string;
  readonly cachedCopy: boolean;
  readonly completions: PuzzleCompletionsByTier;
  readonly onSelect: (tier: DifficultyTierId) => void;
  readonly onStart: () => void;
}) {
  return (
    <div className="page-shell">
      <GameHeader />
      <main id="main">
        <section className="intro mode-intro" aria-labelledby="game-title">
          <h1 id="game-title">Daily Tile-Swap Puzzle</h1>
          <p className="intro-copy">Choose a challenge. Same daily mosaic, same tile placement.</p>
          <div className="puzzle-caption"><span className="sample-badge">DAILY Nº {releaseDate}</span>{cachedCopy && <span className="cached-copy-label">Cached copy · {releaseDate}</span>}<span>{puzzle.title}</span></div>
        </section>

        <section className="mode-selection" aria-labelledby="mode-heading">
          <div className="mode-heading">
            <h2 id="mode-heading">Choose your mode</h2>
            <p>Attempt budget and visual similarity change by mode.</p>
          </div>
          <fieldset className="mode-options">
            <legend className="visually-hidden">Difficulty mode</legend>
            {difficultyTierConfigs.map((tier) => {
              const finished = Boolean(completions[tier.id]);
              const statusId = `difficulty-${tier.id}-status`;
              return (
                <label
                  className={`mode-option${selectedTier === tier.id ? ' is-selected' : ''}${finished ? ' is-finished' : ''}`}
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
                    aria-labelledby={`difficulty-${tier.id}-label difficulty-${tier.id}-budget${finished ? ` ${statusId}` : ''}`}
                    aria-describedby={`difficulty-${tier.id}-details`}
                  />
                  <span className="mode-option-copy">
                    <span className="mode-option-heading">
                      <span className="mode-option-title" id={`difficulty-${tier.id}-label`}>{tier.label}</span>
                      <span className="mode-option-meta">
                        <span className="mode-option-budget" id={`difficulty-${tier.id}-budget`}>{puzzle.attemptLimits[tier.id]} swaps</span>
                        {finished && <span className="mode-option-status" id={statusId}>Finished</span>}
                      </span>
                    </span>
                    <span className="mode-option-description" id={`difficulty-${tier.id}-details`}>{tier.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <button className="start-puzzle" type="button" onClick={onStart}>
            {completions[selectedTier] ? 'Review finished puzzle' : 'Start puzzle'}
          </button>
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
  restoredCompletion,
  cachedCopy,
  progressRepository,
  onComplete,
  onChooseDifficulty,
}: {
  readonly tier: DifficultyTierConfig;
  readonly release: DailyPuzzleRelease;
  readonly restoredProgress: SavedPuzzleProgressV1 | null;
  readonly restoredCompletion: SavedPuzzleCompletionV1 | null;
  readonly cachedCopy: boolean;
  readonly progressRepository: PuzzleProgressRepository;
  readonly onComplete: (completion: SavedPuzzleCompletionV1) => void;
  readonly onChooseDifficulty: () => void;
}) {
  const puzzle = useMemo(() => buildDifficultyPuzzle(release.puzzle, tier.id), [release.puzzle, tier.id]);
  const attemptLimit = release.puzzle.attemptLimits[tier.id];
  const engine = useMemo(
    () => createPuzzleEngine(puzzle, { sameAppearance, attemptLimit }),
    [puzzle, attemptLimit],
  );
  const savedState = restoredCompletion ?? restoredProgress;
  const [state, dispatch] = useReducer(
    engine.reduce,
    savedState,
    (saved) => {
      if (!saved) return engine.initialize();
      return (isCompletionSnapshot(saved) ? engine.restoreCompletion(saved) : engine.restore(saved)) ?? engine.initialize();
    },
  );
  const targetDialogRef = useRef<HTMLDialogElement>(null);
  const targetZoomButtonRef = useRef<HTMLButtonElement>(null);
  const targetDialogScrollY = useRef(0);
  const checkpointState = useRef(state);
  const timer = useRef(createActiveSolveTimer());
  const [activeElapsedMilliseconds, setActiveElapsedMilliseconds] = useState<number | null>(
    restoredCompletion?.elapsedMilliseconds ?? null,
  );
  const [shareFeedback, setShareFeedback] = useState('');
  const won = state.status === 'won';
  const lost = state.status === 'lost';
  const terminal = won || lost;
  const nativeSharingAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const attemptsRemaining = state.attemptLimit - state.attemptsUsed;
  const tilesInPlace = state.board.reduce(
    (count, tile, position) => count + Number(sameAppearance(tile, puzzle.target[position]!)),
    0,
  );
  const selected = state.selectedPosition;
  const message = won
    ? `${tilesInPlace} of 36 tiles in place. Puzzle complete. The pattern is restored.`
    : lost
      ? `${tilesInPlace} of 36 tiles in place. No attempts remaining. The pattern was not restored.`
      : selected === null
      ? `${tilesInPlace} of 36 tiles in place. ${attemptsRemaining} of ${state.attemptLimit} swaps remaining. Choose any tile to begin a swap.`
      : `${describePosition(selected)} selected. Choose another tile to swap, or clear your selection.`;
  const hintMessage = state.hintedPositions === null
    ? null
    : `Hint: Swap ${describePosition(state.hintedPositions[0])} with ${describePosition(state.hintedPositions[1])} to move closer to the target.`;

  const openTargetDialog = () => {
    const dialog = targetDialogRef.current;
    if (!dialog || dialog.open) return;
    targetDialogScrollY.current = window.scrollY;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.target-dialog-close')?.focus({ preventScroll: true });
  };

  const restoreRoundView = () => {
    window.requestAnimationFrame(() => {
      targetZoomButtonRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, targetDialogScrollY.current);
    });
  };

  const shareResult = async () => {
    const text = buildResultShareText({
      releaseDate: release.releaseDate,
      mode: tier.label,
      status: won ? 'won' : 'lost',
      attemptsUsed: state.attemptsUsed,
      attemptLimit: state.attemptLimit,
      hintUsed: state.hintUsed,
    });

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Daily Tile-Swap Puzzle', text });
        setShareFeedback('Share sheet opened.');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setShareFeedback('Sharing canceled.');
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback('Result copied to clipboard.');
    } catch {
      setShareFeedback('Could not copy result. Please try again.');
    }
  };

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
    if (restoredCompletion) {
      const now = performance.now();
      timer.current = stopActiveSolveTimer(
        resumeActiveSolveTimer(restoredCompletion.elapsedMilliseconds, true, now, false),
        now,
      );
      return;
    }
    if (!restoredProgress) return;
    timer.current = resumeActiveSolveTimer(
      restoredProgress.elapsedMilliseconds,
      restoredProgress.attemptsUsed > 0,
      performance.now(),
      document.visibilityState === 'visible',
    );
  }, [restoredCompletion, restoredProgress]);

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
        const elapsedMilliseconds = getActiveSolveMilliseconds(stopped, now);
        setActiveElapsedMilliseconds(elapsedMilliseconds);
        progressRepository.clear();
        onComplete({
          version: 1,
          puzzleId: release.puzzleId,
          tierId: tier.id,
          board: nextState.board,
          attemptsUsed: nextState.attemptsUsed,
          hintUsed: nextState.hintUsed,
          hintedPositions: nextState.hintedPositions,
          status: nextState.status,
          elapsedMilliseconds,
        });
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
        <section className="intro puzzle-intro" aria-labelledby="game-title">
          <div className="puzzle-caption"><span className="sample-badge">DAILY Nº {release.releaseDate}</span>{cachedCopy && <span className="cached-copy-label">Cached copy · {release.releaseDate}</span>}<span className="mode-badge">{tier.label}</span><span className="visually-hidden">{release.puzzle.title}</span></div>
          <h1 id="game-title">Daily Tile-Swap Puzzle</h1>
          <p id="game-instruction" className="intro-copy">Match the target. Tap two tiles to swap them.</p>
        </section>

        <div className="game-layout">
          <section className="board-section target-section" aria-labelledby="target-heading">
            <div className="board-heading">
              <h2 id="target-heading">The target</h2>
              <span className="board-tag">LOOK CLOSELY</span>
            </div>
            <div className="target-reference-row">
              <TargetBoard tiles={puzzle.target} />
              <div className="target-reference-actions">
                <span>Keep this pattern in view as you play.</span>
                <button
                  className="enlarge-target-button"
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls="target-enlargement-dialog"
                  ref={targetZoomButtonRef}
                  onClick={openTargetDialog}
                >
                  View target larger
                </button>
              </div>
            </div>
            <p className="board-note"><span aria-hidden="true">◇</span> A little symmetry, waiting to be restored.</p>
          </section>

          <section className="board-section player-section" aria-labelledby="board-heading">
            <div className="board-heading">
              <h2 id="board-heading">Your mosaic</h2>
              <span className={`board-tag progress-tag${won ? ' complete-tag' : ''}${lost ? ' failed-tag' : ''}`}>
                <span aria-hidden="true">{won ? '✓' : lost ? '×' : '○'}</span> {won ? 'RESTORED' : lost ? 'OUT OF SWAPS' : 'IN PROGRESS'}
              </span>
            </div>
            <PuzzleBoard
              state={state}
              onActivate={activatePosition}
              onCancel={() => dispatch({ type: 'cancel' })}
            />
          </section>

          <div className="round-tools">
            <p className="attempt-count">
              <span className="progress-stat">
                <span className="progress-glyph" aria-hidden="true"><i /><i /><i /><i /></span>
                <span className="stat-copy">{tilesInPlace} of 36 tiles in place</span>
              </span>
              <span className="swap-stat">
                <svg className="swap-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                  <path d="M8 15h27l-6-6m6 6-6 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M40 33H13l6 6m-6-6 6-6" fill="none" stroke="#084888" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="stat-copy">{attemptsRemaining} of {state.attemptLimit} swaps left</span>
              </span>
            </p>

            <div className="game-actions">
              <button className="hint-button" type="button" disabled={state.hintUsed || terminal} onClick={useHint}>
                Use hint
              </button>
              <button className="clear-selection" type="button" tabIndex={0} disabled={selected === null || terminal} onClick={() => dispatch({ type: 'cancel' })}>
                Clear selection
              </button>
            </div>

            {terminal && (
              <div className={`round-result${won ? ' won-result' : ' lost-result'}`} aria-label="Round result">
                <strong>{tier.label} mode</strong>
                <span>{state.attemptsUsed} of {state.attemptLimit} swaps used</span>
                <span>Active time: {formatActiveSolveTime(activeElapsedMilliseconds ?? 0)}</span>
                <span>{state.hintUsed ? 'Assisted (hint used)' : 'Unassisted'}</span>
                <span className="result-motif">Motif: {puzzle.motifDescription}</span>
                <div className="result-share">
                  <button className="result-share-button" type="button" onClick={() => void shareResult()}>
                    {nativeSharingAvailable ? 'Share result' : 'Copy result'}
                  </button>
                  <span className="result-share-feedback" aria-live="polite" aria-atomic="true">{shareFeedback}</span>
                </div>
                <div className="result-actions">
                  <button className="choose-difficulty" type="button" onClick={onChooseDifficulty}>
                    Choose another difficulty
                  </button>
                </div>
              </div>
            )}

            <div className={`game-feedback${won ? ' complete-feedback' : ''}${lost ? ' failed-feedback' : ''}`}>
              <output className="visually-hidden" aria-live="polite" aria-atomic="true">
                <span className="feedback-icon" aria-hidden="true">{won ? '✓' : lost ? '×' : '↔'}</span>{message}
              </output>
              <p className="hint-instruction" id="hint-instruction" aria-live="polite">{hintMessage ?? ''}</p>
            </div>
          </div>

          <dialog
            className="target-enlargement-dialog"
            id="target-enlargement-dialog"
            ref={targetDialogRef}
            aria-labelledby="target-dialog-heading"
            aria-describedby="target-dialog-description"
            onClose={restoreRoundView}
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;
              const focusable = [...(targetDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
              if (focusable.length === 0) return;
              const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
              const nextIndex = event.shiftKey
                ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
                : currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
              event.preventDefault();
              focusable[nextIndex]?.focus();
            }}
          >
            <div className="target-dialog-heading">
              <div>
                <h2 id="target-dialog-heading">Enlarged target</h2>
                <p>Full-size reference · 6 × 6</p>
              </div>
              <button
                className="target-dialog-close"
                type="button"
                aria-label="Close enlarged target"
                onClick={() => targetDialogRef.current?.close()}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <TargetBoard tiles={puzzle.target} />
            <p id="target-dialog-description" className="target-dialog-description">
              Take a closer look, then return to your mosaic. Your puzzle position is saved.
            </p>
            <button
              className="target-dialog-return"
              type="button"
              onClick={() => targetDialogRef.current?.close()}
            >
              Return to puzzle
            </button>
          </dialog>
        </div>

        <aside className="how-to-play" aria-label="Playing tips">
          <p><span className="tip-number">1</span> Tap a tile to select it.</p>
          <p><span className="tip-number">2</span> Tap a second tile to swap them.</p>
          <p><span className="tip-number">3</span> Keep swapping until your mosaic matches the target.</p>
        </aside>
        <p className="keyboard-note" id="keyboard-instruction">Keyboard: Tab to the board; use arrow keys to move between tiles. Enter or Space selects and swaps; Escape clears selection. Tab or Shift+Tab leaves the board.<br />Moving focus alone never changes the board. Tap a selected tile again to cancel. Each swap uses one attempt.</p>
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
  const [dailyPuzzleCache] = useState(() => typeof window !== 'undefined' && 'caches' in window
    ? createDailyPuzzleReleaseCache(window.caches, window.location.origin)
    : undefined);
  const [progressRepository] = useState(() => createPuzzleProgressRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  }));
  const [completionRepository] = useState(() => createPuzzleCompletionRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  }));
  const [selectedTier, setSelectedTier] = useState<DifficultyTierId>('medium');
  const [started, setStarted] = useState(false);
  const [release, setRelease] = useState<DailyPuzzleRelease | null>(null);
  const [releaseSource, setReleaseSource] = useState<'network' | 'cache'>('network');
  const [restoredProgress, setRestoredProgress] = useState<SavedPuzzleProgressV1 | null>(null);
  const [reviewCompletion, setReviewCompletion] = useState<SavedPuzzleCompletionV1 | null>(null);
  const [completions, setCompletions] = useState<PuzzleCompletionsByTier>({});
  const [loadingError, setLoadingError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const tier = getDifficultyTierConfig(selectedTier);
  const handleCompletion = useCallback((completion: SavedPuzzleCompletionV1) => {
    completionRepository.save(completion);
    setCompletions((previous) => ({ ...previous, [completion.tierId]: completion }));
    setRestoredProgress(null);
    setReviewCompletion(null);
    setSelectedTier(completion.tierId);
    setStarted(true);
  }, [completionRepository]);
  const chooseAnotherDifficulty = useCallback(() => {
    setRestoredProgress(null);
    setReviewCompletion(null);
    setStarted(false);
  }, []);

  const fetchToday = useCallback((signal: AbortSignal) => createDailyPuzzleReleaseLoader({
    fetcher: (input, init) => fetch(input, init),
    cache: dailyPuzzleCache,
  })(signal), [dailyPuzzleCache]);

  const loadPuzzle = useCallback(async (signal: AbortSignal) => {
    const dailyLoad = await fetchToday(signal);
    if (!dailyLoad) throw new Error('Daily puzzle is unavailable.');

    const savedCompletions = validatePuzzleCompletions(
      dailyLoad.release,
      completionRepository.load(dailyLoad.release.puzzleId),
    );
    const saved = progressRepository.load();
    if (saved) {
      if (dailyLoad.release.puzzleId === saved.puzzleId && !savedCompletions[saved.tierId]) {
        const savedTier = getDifficultyTierConfig(saved.tierId);
        const savedPuzzle = buildDifficultyPuzzle(dailyLoad.release.puzzle, savedTier.id);
        const savedEngine = createPuzzleEngine(savedPuzzle, {
          sameAppearance,
          attemptLimit: dailyLoad.release.puzzle.attemptLimits[savedTier.id],
        });
        if (savedEngine.restore(saved)) {
          return {
            release: dailyLoad.release,
            restoredProgress: saved,
            completions: savedCompletions,
            source: dailyLoad.source,
          };
        }
      }
      progressRepository.clear();
    }

    return { release: dailyLoad.release, restoredProgress: null, completions: savedCompletions, source: dailyLoad.source };
  }, [completionRepository, fetchToday, progressRepository]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPuzzle(controller.signal).then((loaded) => {
      setRelease(loaded.release);
      setReleaseSource(loaded.source);
      setRestoredProgress(loaded.restoredProgress);
      setReviewCompletion(null);
      setCompletions(loaded.completions);
      if (loaded.restoredProgress) setSelectedTier(loaded.restoredProgress.tierId);
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

  const pendingReleaseDate = useRef<string | null>(null);
  useEffect(() => {
    if (!release) return;

    const refreshForCurrentDate = () => {
      const currentDate = getNewYorkPuzzleDate(new Date());
      if (currentDate === release.releaseDate) {
        pendingReleaseDate.current = null;
        return;
      }
      if (!navigator.onLine || pendingReleaseDate.current === currentDate) return;

      pendingReleaseDate.current = currentDate;
      setLoading(true);
      setLoadingError(false);
      setLoadAttempt((attempt) => attempt + 1);
    };
    const refreshOnResume = () => {
      pendingReleaseDate.current = null;
      refreshForCurrentDate();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshOnResume();
    };
    const handleOnline = () => {
      pendingReleaseDate.current = null;
      refreshForCurrentDate();
    };
    const now = new Date();
    const delay = getNextNewYorkMidnight(now).getTime() - now.getTime();
    const midnightTimer = window.setTimeout(refreshForCurrentDate, Math.max(0, delay));

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', refreshOnResume);
    window.addEventListener('online', handleOnline);
    refreshForCurrentDate();

    return () => {
      window.clearTimeout(midnightTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', refreshOnResume);
      window.removeEventListener('online', handleOnline);
    };
  }, [release]);

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
      restoredCompletion={null}
      cachedCopy={releaseSource === 'cache'}
      progressRepository={progressRepository}
      onComplete={handleCompletion}
      onChooseDifficulty={chooseAnotherDifficulty}
    />;
  }
  return started
    ? <PuzzleRound
      key={`${release.puzzleId}-${selectedTier}`}
      tier={tier}
      release={release}
      restoredProgress={null}
      restoredCompletion={reviewCompletion}
      cachedCopy={releaseSource === 'cache'}
      progressRepository={progressRepository}
      onComplete={handleCompletion}
      onChooseDifficulty={chooseAnotherDifficulty}
    />
    : <ModeSelection
      selectedTier={selectedTier}
      puzzle={release.puzzle}
      releaseDate={release.releaseDate}
      cachedCopy={releaseSource === 'cache'}
      completions={completions}
      onSelect={setSelectedTier}
      onStart={() => {
        setReviewCompletion(completions[selectedTier] ?? null);
        setStarted(true);
      }}
    />;
}
