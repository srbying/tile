import { useMemo, useRef, useState } from 'react';
import { buildDifficultyPuzzle, difficultyTierConfigs } from './difficulty-preview';
import {
  dailyPuzzleTargetCycleLength,
  generateDailyCandidate,
  getNewYorkPuzzleDate,
  getRecentPuzzleTargets,
} from './daily-puzzle-generator';
import { parsePuzzleCandidate, validatePuzzleCandidate } from './puzzle-candidate';
import type { PuzzleValidationResult } from './puzzle-candidate';
import { describePosition } from './puzzle-board';
import { describeTile } from './tile-appearance';
import { TileArtwork } from './tile-artwork';
import type { PuzzleCandidate, TileAppearance } from './puzzle.types';

function CandidateBoard({
  tier,
  kind,
  tiles,
}: {
  readonly tier: string;
  readonly kind: 'target' | 'starting';
  readonly tiles: readonly TileAppearance[];
}) {
  return (
    <ol className="tile-grid preview-grid author-grid" aria-label={`${tier} ${kind} board`}>
      {tiles.map((tile, position) => (
        <li className="target-tile" key={position}>
          <span className="visually-hidden">{describePosition(position)}: {describeTile(tile)}</span>
          <TileArtwork tile={tile} />
        </li>
      ))}
    </ol>
  );
}

function parseEditorText(text: string): { candidate: PuzzleCandidate | null; error: string | null } {
  try {
    const value: unknown = JSON.parse(text);
    const parsed = parsePuzzleCandidate(value);
    if (!parsed) {
      const issue = validatePuzzleCandidate(value).issues[0];
      return { candidate: null, error: issue?.message ?? 'Puzzle JSON is invalid.' };
    }
    return { candidate: parsed, error: null };
  } catch {
    return { candidate: null, error: 'The editor contents are not valid JSON.' };
  }
}

export function PuzzleAuthoringPage() {
  const [initialSeed] = useState(() => {
    const editorDate = getNewYorkPuzzleDate(new Date());
    return { editorDate, candidate: generateDailyCandidate(editorDate) };
  });
  const { editorDate, candidate: initialCandidate } = initialSeed;
  const [source, setSource] = useState(() => JSON.stringify(initialCandidate, null, 2));
  const [generationVariation, setGenerationVariation] = useState(0);
  const [validation, setValidation] = useState<PuzzleValidationResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileReadVersion = useRef(0);
  const parsed = useMemo(() => parseEditorText(source), [source]);
  const candidate = parsed.candidate;
  const previews = candidate
    ? difficultyTierConfigs.map((tier) => ({
      ...tier,
      puzzle: buildDifficultyPuzzle(candidate, tier.id),
    }))
    : [];

  const validate = (value: unknown) => {
    const recentTargets = getRecentPuzzleTargets(editorDate, 30);
    const result = validatePuzzleCandidate(value, { recentTargets });
    setValidation(result);
    setImportError(null);
  };

  const loadFile = async (file: File | undefined, input: HTMLInputElement) => {
    const readVersion = ++fileReadVersion.current;
    if (!file) {
      input.value = '';
      return;
    }

    let content: string;
    try {
      content = await file.text();
    } catch {
      if (readVersion === fileReadVersion.current) {
        setValidation(null);
        setImportError('Could not read the puzzle file.');
      }
      input.value = '';
      return;
    }
    input.value = '';
    if (readVersion !== fileReadVersion.current) return;
    setSource(content);
    setValidation(null);
    try {
      validate(JSON.parse(content) as unknown);
    } catch {
      setImportError('The file does not contain valid JSON.');
    }
  };

  const exportCandidate = () => {
    const blob = new Blob([source], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `candidate-${candidate?.id ?? 'draft'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const validateEditor = () => {
    try {
      validate(JSON.parse(source) as unknown);
    } catch {
      setValidation(null);
      setImportError('The editor contents are not valid JSON.');
    }
  };

  const generateCandidate = () => {
    const nextVariation = (generationVariation + 1) % dailyPuzzleTargetCycleLength;
    const generated = generateDailyCandidate(editorDate, nextVariation);
    setGenerationVariation(nextVariation);
    fileReadVersion.current++;
    setSource(JSON.stringify(generated, null, 2));
    setValidation(null);
    setImportError(null);
  };

  const firstIssue = validation?.issues[0]?.message;
  const validationMessage = validation?.valid
    ? `Puzzle is valid. The shortest solution is 10 swaps in each mode.`
    : null;

  return (
    <div className="page-shell authoring-page">
      <header className="site-header preview-site-header">
        <a className="wordmark" href="/">TILE-SWAP PUZZLE</a>
        <a className="preview-back-link" href="/">Back to the puzzle</a>
      </header>
      <main id="main">
        <section className="intro preview-intro" aria-labelledby="authoring-title">
          <h1 id="authoring-title">Puzzle editor</h1>
          <p className="intro-copy">Edit the puzzle JSON, check that it can be solved in each mode, and preview the tiles.</p>
          <div className="puzzle-caption"><span className="sample-badge">SEED DATE</span><span>{editorDate}</span></div>
        </section>

        <section className="authoring-editor" aria-labelledby="candidate-heading">
          <div className="authoring-heading">
            <h2 id="candidate-heading">Puzzle JSON</h2>
            <label className="authoring-file-label">
              Load puzzle JSON
              <input
                aria-label="Load puzzle JSON"
                type="file"
                accept="application/json,.json"
                onChange={(event) => { void loadFile(event.currentTarget.files?.[0], event.currentTarget); }}
              />
            </label>
          </div>
          <textarea
            aria-label="Puzzle JSON"
            spellCheck={false}
            value={source}
            onChange={(event) => {
              fileReadVersion.current++;
              setSource(event.currentTarget.value);
              setValidation(null);
              setImportError(null);
            }}
          />
          <div className="authoring-actions">
            <button className="authoring-export" type="button" onClick={generateCandidate}>Generate puzzle</button>
            <button className="start-puzzle" type="button" onClick={validateEditor}>Check puzzle</button>
            <button className="authoring-export" type="button" disabled={!candidate} onClick={exportCandidate}>Export puzzle JSON</button>
          </div>
          {importError && <p className="authoring-error" role="alert">{importError}</p>}
          {validationMessage && <output className="authoring-success">{validationMessage}</output>}
          {firstIssue && <div className="authoring-error" role="alert">
            <strong>Fix these puzzle issues</strong>
            <ul>{validation!.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>
          </div>}
          {validation && validation.tiers.length > 0 && (
            <ul className="authoring-tier-results" aria-label="Checks by mode">
              {validation.tiers.map((tier) => {
                const modeLabel = difficultyTierConfigs.find(({ id }) => id === tier.tierId)?.label ?? tier.tierId;
                const tooManySwaps = validation.issues.some((issue) => issue.tierId === tier.tierId && issue.code === 'incorrect-shortest-solution');
                const solution = tier.minimumSwaps === null
                  ? tooManySwaps ? 'More than 10 swaps to solve' : 'No solution found'
                  : `Shortest solution: ${tier.minimumSwaps} swaps`;
                const swapLimit = tier.attemptLimit ?? 'invalid';
                return (
                  <li key={tier.tierId}>
                    <strong>{modeLabel}:</strong> {solution}; {swapLimit} swaps allowed; hint {tier.hint ? 'works' : 'needs a fix'}.
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {candidate && (
          <section className="authoring-previews" aria-labelledby="preview-heading">
            <div className="authoring-preview-title">
              <h2 id="preview-heading">{candidate.title}</h2>
              <p>{candidate.motifDescription}</p>
            </div>
            {previews.map((preview) => (
              <section className="tier-preview-section" aria-labelledby={`author-${preview.id}-heading`} key={preview.id}>
                <div className="tier-preview-heading">
                  <h3 id={`author-${preview.id}-heading`}>{preview.label}</h3>
                  <p>{preview.description} · {candidate.attemptLimits[preview.id]} swaps</p>
                </div>
                <div className="tier-board-pair">
                  <figure>
                    <figcaption>Target</figcaption>
                    <CandidateBoard tier={preview.label} kind="target" tiles={preview.puzzle.target} />
                  </figure>
                  <figure>
                    <figcaption>Starting board</figcaption>
                    <CandidateBoard tier={preview.label} kind="starting" tiles={preview.puzzle.start} />
                  </figure>
                </div>
              </section>
            ))}
          </section>
        )}
      </main>
      <footer className="site-footer"><span>Small tiles. A clearer picture.</span><span>OFFLINE PUZZLE EDITOR <span aria-hidden="true">✦</span></span></footer>
    </div>
  );
}
