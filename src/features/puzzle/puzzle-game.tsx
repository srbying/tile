import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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

function GameHeader({ onChooseDifficulty }: { readonly onChooseDifficulty?: () => void } = {}) {
  return (
    <header className={`site-header${onChooseDifficulty ? ' site-header--round' : ''}`}>
      <a className="wordmark" href="/">TILE-SWAP PUZZLE</a>
      <nav className="site-header-navigation" aria-label="Puzzle navigation">
        {onChooseDifficulty && (
          <button className="choose-difficulty-navigation" type="button" onClick={onChooseDifficulty}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M16 10H4m0 0 6-6m-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Choose mode</span>
          </button>
        )}
        <a className="preview-navigation-link" href="/preview">Compare modes</a>
      </nav>
    </header>
  );
}

function GameFooter({ releaseDate }: { readonly releaseDate?: string } = {}) {
  return <footer className="site-footer"><span>Small tiles. A clearer picture.</span><span>{releaseDate ? `Daily puzzle · ${releaseDate}` : 'Sample puzzles'}</span><a href="/author">Puzzle editor</a></footer>;
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
  pausedProgress,
  focusPrimaryAction,
  onSelect,
  onStart,
  onResume,
  onReplacePausedRound,
}: {
  readonly selectedTier: DifficultyTierId;
  readonly puzzle: DailyPuzzleRelease['puzzle'];
  readonly releaseDate: string;
  readonly cachedCopy: boolean;
  readonly completions: PuzzleCompletionsByTier;
  readonly pausedProgress: SavedPuzzleProgressV1 | null;
  readonly focusPrimaryAction: boolean;
  readonly onSelect: (tier: DifficultyTierId) => void;
  readonly onStart: () => void;
  readonly onResume: () => void;
  readonly onReplacePausedRound: () => void;
}) {
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const replaceActionRef = useRef<HTMLButtonElement>(null);
  const selectedTierConfig = getDifficultyTierConfig(selectedTier);
  const hasPausedRoundForSelectedTier = pausedProgress?.tierId === selectedTier;
  const selectedTierIsFinished = Boolean(completions[selectedTier]);
  const requiresReplacementConfirmation = Boolean(pausedProgress)
    && !hasPausedRoundForSelectedTier
    && !selectedTierIsFinished;

  useEffect(() => {
    if (focusPrimaryAction) primaryActionRef.current?.focus({ preventScroll: true });
  }, [focusPrimaryAction]);

  useEffect(() => {
    if (confirmReplacement) replaceActionRef.current?.focus({ preventScroll: true });
  }, [confirmReplacement]);

  const activatePrimaryAction = () => {
    if (requiresReplacementConfirmation) {
      setConfirmReplacement(true);
      return;
    }
    if (hasPausedRoundForSelectedTier) {
      onResume();
      return;
    }
    onStart();
  };

  return (
    <div className="page-shell player-shell">
      <GameHeader />
      <main id="main">
        <section className="intro mode-intro" aria-labelledby="game-title">
          <h1 id="game-title">Daily Tile-Swap Puzzle</h1>
          <p className="intro-copy">Restore today’s pattern by swapping tiles.</p>
          {cachedCopy && <p className="cached-copy-label">Using a saved copy of today’s puzzle</p>}
        </section>

        <section className="mode-selection" aria-labelledby="mode-heading">
          <div className="mode-heading">
            <h2 id="mode-heading">Choose your mode</h2>
            <p>Choose how easy the tiles should be to tell apart.</p>
          </div>
          <fieldset className="mode-options">
            <legend className="visually-hidden">Choose a mode</legend>
            {difficultyTierConfigs.map((tier) => {
              const finished = Boolean(completions[tier.id]);
              const paused = pausedProgress?.tierId === tier.id;
              const statusId = `difficulty-${tier.id}-status`;
              return (
                <label
                  className={`mode-option${selectedTier === tier.id ? ' is-selected' : ''}${finished ? ' is-finished' : ''}${paused ? ' is-paused' : ''}`}
                  htmlFor={`difficulty-${tier.id}`}
                  key={tier.id}
                >
                  <input
                    type="radio"
                    id={`difficulty-${tier.id}`}
                    name="difficulty"
                    value={tier.id}
                    checked={selectedTier === tier.id}
                    onChange={() => {
                      setConfirmReplacement(false);
                      onSelect(tier.id);
                    }}
                    aria-labelledby={`difficulty-${tier.id}-label difficulty-${tier.id}-budget${finished || paused ? ` ${statusId}` : ''}`}
                    aria-describedby={`difficulty-${tier.id}-details`}
                  />
                  <span className="mode-option-copy">
                    <span className="mode-option-heading">
                      <span className="mode-option-title" id={`difficulty-${tier.id}-label`}>{tier.label}</span>
                      <span className="mode-option-meta">
                        <span className="mode-option-budget" id={`difficulty-${tier.id}-budget`}>{puzzle.attemptLimits[tier.id]} swaps</span>
                        {finished && <span className="mode-option-status" id={statusId}>Finished</span>}
                        {paused && <span className="mode-option-status mode-option-status--paused" id={statusId}>Paused</span>}
                      </span>
                    </span>
                    <span className="mode-option-description" id={`difficulty-${tier.id}-details`}>{tier.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <button className="start-puzzle" type="button" ref={primaryActionRef} onClick={activatePrimaryAction}>
            {hasPausedRoundForSelectedTier
              ? 'Resume puzzle'
              : selectedTierIsFinished ? 'Review finished puzzle' : 'Start puzzle'}
          </button>
          {confirmReplacement && requiresReplacementConfirmation && pausedProgress && (
            <section className="save-replacement-confirmation" aria-labelledby="save-replacement-heading">
              <h3 id="save-replacement-heading">Replace paused puzzle?</h3>
              <p>
                Starting {selectedTierConfig.label} will replace your paused {getDifficultyTierConfig(pausedProgress.tierId).label} puzzle and its saved progress.
              </p>
              <div className="save-replacement-actions">
                <button className="replace-saved-puzzle" type="button" ref={replaceActionRef} onClick={onReplacePausedRound}>
                  Replace and start
                </button>
                <button className="keep-saved-puzzle" type="button" onClick={() => {
                  setConfirmReplacement(false);
                  primaryActionRef.current?.focus({ preventScroll: true });
                }}>
                  Keep saved puzzle
                </button>
              </div>
            </section>
          )}
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
  onBackToModes,
}: {
  readonly tier: DifficultyTierConfig;
  readonly release: DailyPuzzleRelease;
  readonly restoredProgress: SavedPuzzleProgressV1 | null;
  readonly restoredCompletion: SavedPuzzleCompletionV1 | null;
  readonly cachedCopy: boolean;
  readonly progressRepository: PuzzleProgressRepository;
  readonly onComplete: (completion: SavedPuzzleCompletionV1) => void;
  readonly onChooseDifficulty: () => void;
  readonly onBackToModes: (progress: SavedPuzzleProgressV1 | null) => void;
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
    ? `Puzzle solved. All 36 tiles match the target.`
    : lost
      ? `No match after ${state.attemptsUsed} swaps. ${tilesInPlace} of 36 tiles match the target.`
      : selected === null
      ? `${tilesInPlace} of 36 tiles match the target. ${attemptsRemaining} swaps left. Select two tiles to swap.`
      : `${describePosition(selected)} selected. Select another tile to swap, or select this tile again to cancel.`;
  const hintMessage = state.hintedPositions === null
    ? null
    : `Hint: Swap ${describePosition(state.hintedPositions[0])} with ${describePosition(state.hintedPositions[1])} to make progress toward the target.`;

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
        setShareFeedback('Choose an app to share your result.');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setShareFeedback('Share canceled.');
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback('Result copied.');
    } catch {
      setShareFeedback('Could not copy result. Try again.');
    }
  };

  const createProgressSnapshot = useCallback((nextState: typeof state, now: number): SavedPuzzleProgressV1 => ({
      version: 1,
      puzzleId: release.puzzleId,
      tierId: tier.id,
      board: nextState.board,
      attemptsUsed: nextState.attemptsUsed,
      hintUsed: nextState.hintUsed,
      hintedPositions: nextState.hintedPositions,
      elapsedMilliseconds: getActiveSolveMilliseconds(timer.current, now),
  }), [release.puzzleId, tier.id]);
  const saveProgress = useCallback((nextState: typeof state, now: number) => {
    progressRepository.save(createProgressSnapshot(nextState, now));
  }, [createProgressSnapshot, progressRepository]);

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

  const returnToModes = () => {
    if (terminal) {
      onBackToModes(null);
      return;
    }

    const now = performance.now();
    timer.current = stopActiveSolveTimer(timer.current, now);
    const progress = createProgressSnapshot(state, now);
    progressRepository.save(progress);
    onBackToModes(progress);
  };

  return (
    <div className="page-shell player-shell">
      <GameHeader onChooseDifficulty={returnToModes} />
      <main id="main">
        <section className="intro puzzle-intro" aria-labelledby="game-title">
          <div className="puzzle-caption"><span className="mode-badge">{tier.label} mode</span>{cachedCopy && <span className="cached-copy-label">Using a saved copy of today’s puzzle</span>}</div>
          <h1 id="game-title">Daily Tile-Swap Puzzle</h1>
          <p id="game-instruction" className="intro-copy">Look at the target, then select two tiles to swap.</p>
        </section>

        <div className="game-layout">
          <section className="board-section target-section" aria-labelledby="target-heading">
            <div className="board-heading">
              <h2 id="target-heading">Target pattern</h2>
            </div>
            <div className="target-reference-row">
              <TargetBoard tiles={puzzle.target} />
              <div className="target-reference-actions">
                <span>Keep the target in view as you play.</span>
                <button
                  className="enlarge-target-button"
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls="target-enlargement-dialog"
                  ref={targetZoomButtonRef}
                  onClick={openTargetDialog}
                >
                  Enlarge target
                </button>
              </div>
            </div>
            <p className="board-note"><span aria-hidden="true">◇</span> Compare each tile’s shape, color, and direction.</p>
          </section>

          <section className="board-section player-section" aria-labelledby="board-heading">
            <div className="board-heading">
              <h2 id="board-heading">Your tiles</h2>
              <span className={`board-tag progress-tag${won ? ' complete-tag' : ''}${lost ? ' failed-tag' : ''}`}>
                <span aria-hidden="true">{won ? '✓' : lost ? '×' : '○'}</span> {won ? 'SOLVED' : lost ? 'NO SWAPS LEFT' : 'IN PROGRESS'}
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
                <span className="stat-copy">{tilesInPlace} of 36 tiles match the target</span>
              </span>
              <span className="swap-stat">
                <svg className="swap-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                  <path d="M8 15h27l-6-6m6 6-6 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M40 33H13l6 6m-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="stat-copy">{attemptsRemaining} swaps left</span>
              </span>
            </p>

            <div className="game-actions">
              <button className="hint-button" type="button" disabled={state.hintUsed || terminal} onClick={useHint}>
                Show hint
              </button>
              <button className="clear-selection" type="button" tabIndex={0} disabled={selected === null || terminal} onClick={() => dispatch({ type: 'cancel' })}>
                Cancel selection
              </button>
            </div>

            {terminal && (
              <div className={`round-result${won ? ' won-result' : ' lost-result'}`} aria-label="Round result">
                <strong>{tier.label} mode</strong>
                <span>{won ? `Solved in ${state.attemptsUsed} of ${state.attemptLimit} swaps` : `No match after ${state.attemptsUsed} swaps`}</span>
                <span>Solve time: {formatActiveSolveTime(activeElapsedMilliseconds ?? 0)}</span>
                <span>{state.hintUsed ? 'Hint used' : 'No hint'}</span>
                <div className="result-share">
                  <button className="result-share-button" type="button" onClick={() => void shareResult()}>
                    {nativeSharingAvailable ? 'Share result' : 'Copy result'}
                  </button>
                  <span className="result-share-feedback" aria-live="polite" aria-atomic="true">{shareFeedback}</span>
                </div>
                <div className="result-actions">
                  <button className="choose-difficulty" type="button" onClick={onChooseDifficulty}>
                    Choose another mode
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
                <p>Target pattern · 6 × 6</p>
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
              Use the larger pattern as a guide. Your place in the puzzle is saved while you view it.
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
          <p><span className="tip-number">1</span> Select a tile.</p>
          <p><span className="tip-number">2</span> Select another tile to swap them.</p>
          <p><span className="tip-number">3</span> Match the target using as few swaps as you can.</p>
        </aside>
        <p className="keyboard-note" id="keyboard-instruction">Keyboard: Use Tab and the arrow keys to move between tiles. Press Enter or Space to select a tile, then select another to swap. Press Escape to cancel. Moving focus alone does not change the board. Each swap counts as one move.</p>
      </main>
      <GameFooter releaseDate={release.releaseDate} />
    </div>
  );
}

const loadingTileTones = [
  'plaster', 'blue', 'cyan', 'plaster', 'gold', 'coral',
  'coral', 'plaster', 'blue', 'plaster', 'cyan', 'plaster',
  'plaster', 'gold', 'plaster', 'coral', 'blue', 'plaster',
  'blue', 'plaster', 'coral', 'plaster', 'gold', 'cyan',
  'plaster', 'coral', 'plaster', 'cyan', 'plaster', 'blue',
  'gold', 'plaster', 'blue', 'plaster', 'coral', 'plaster',
] as const;

function LoadingPuzzle() {
  return (
    <div className="page-shell loading-shell player-shell">
      <GameHeader />
      <main id="main" className="loading-main">
        <section className="loading-content" aria-label="Daily puzzle loading">
          <div className="loading-mosaic" aria-hidden="true">
            {loadingTileTones.map((tone, index) => (
              <span
                className={`loading-tile loading-tile--${tone}`}
                key={index}
                style={{ '--tile-order': index } as CSSProperties}
              />
            ))}
          </div>
          <output className="loading-status" aria-live="polite" aria-atomic="true">
            Loading today’s puzzle…
          </output>
        </section>
      </main>
    </div>
  );
}

function PuzzleLoadError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <main id="main" className="page-shell player-shell">
      <section className="daily-load-message" aria-labelledby="daily-error-heading">
        <div role="alert">
          <h1 id="daily-error-heading">We couldn’t load today’s puzzle</h1>
          <p>Please try again.</p>
        </div>
        <button className="start-puzzle" type="button" onClick={onRetry}>Try again</button>
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
  const [focusModeActionOnReturn, setFocusModeActionOnReturn] = useState(false);
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
  const returnToDifficultyPicker = useCallback((progress: SavedPuzzleProgressV1 | null) => {
    if (progress) {
      progressRepository.save(progress);
      setRestoredProgress(progress);
      setSelectedTier(progress.tierId);
    }
    setReviewCompletion(null);
    setStarted(false);
    setFocusModeActionOnReturn(true);
  }, [progressRepository]);
  const chooseAnotherDifficulty = useCallback(() => {
    returnToDifficultyPicker(null);
  }, [returnToDifficultyPicker]);

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
      setStarted(Boolean(loaded.restoredProgress));
      setFocusModeActionOnReturn(false);
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
  if (started) {
    return <PuzzleRound
      key={`${release.puzzleId}-${selectedTier}`}
      tier={tier}
      release={release}
      restoredProgress={restoredProgress?.tierId === selectedTier ? restoredProgress : null}
      restoredCompletion={reviewCompletion}
      cachedCopy={releaseSource === 'cache'}
      progressRepository={progressRepository}
      onComplete={handleCompletion}
      onChooseDifficulty={chooseAnotherDifficulty}
      onBackToModes={returnToDifficultyPicker}
    />;
  }
  return <ModeSelection
      selectedTier={selectedTier}
      puzzle={release.puzzle}
      releaseDate={release.releaseDate}
      cachedCopy={releaseSource === 'cache'}
      completions={completions}
      pausedProgress={restoredProgress}
      focusPrimaryAction={focusModeActionOnReturn}
      onSelect={setSelectedTier}
      onStart={() => {
        setReviewCompletion(completions[selectedTier] ?? null);
        setStarted(true);
      }}
      onResume={() => {
        setReviewCompletion(null);
        setStarted(true);
      }}
      onReplacePausedRound={() => {
        progressRepository.clear();
        setRestoredProgress(null);
        setReviewCompletion(completions[selectedTier] ?? null);
        setStarted(true);
      }}
    />;
}
