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
      return { candidate: null, error: issue?.message ?? 'Candidate JSON is invalid.' };
    }
    return { candidate: parsed, error: null };
  } catch {
    return { candidate: null, error: 'Candidate JSON is not valid JSON.' };
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
        setImportError('Could not read candidate JSON file.');
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
      setImportError('Candidate JSON is not valid JSON.');
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
      setImportError('Candidate JSON is not valid JSON.');
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
    ? `Candidate passes validation. Minimum solution: ${validation.tiers[0]?.minimumSwaps} swaps in each tier.`
    : null;

  return (
    <div className="page-shell authoring-page">
      <header className="site-header preview-site-header">
        <a className="wordmark" href="/">TILE-SWAP PUZZLE</a>
        <a className="preview-back-link" href="/">Back to the puzzle</a>
      </header>
      <main id="main">
        <section className="intro preview-intro" aria-labelledby="authoring-title">
          <div className="eyebrow"><span className="small-rule" /> OFFLINE PUZZLE WORKSHOP</div>
          <h1 id="authoring-title">Puzzle authoring<span className="title-dot">.</span></h1>
          <p className="intro-copy">Load or edit candidate JSON, validate visible play, and preview every difficulty tier.</p>
          <div className="puzzle-caption"><span className="sample-badge">DAILY SEED</span><span>{editorDate}</span></div>
        </section>

        <section className="authoring-editor" aria-labelledby="candidate-heading">
          <div className="authoring-heading">
            <h2 id="candidate-heading">Candidate JSON</h2>
            <label className="authoring-file-label">
              Load candidate JSON
              <input
                aria-label="Load candidate JSON"
                type="file"
                accept="application/json,.json"
                onChange={(event) => { void loadFile(event.currentTarget.files?.[0], event.currentTarget); }}
              />
            </label>
          </div>
          <textarea
            aria-label="Candidate JSON"
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
            <button className="authoring-export" type="button" onClick={generateCandidate}>Generate candidate</button>
            <button className="start-puzzle" type="button" onClick={validateEditor}>Validate candidate</button>
            <button className="authoring-export" type="button" disabled={!candidate} onClick={exportCandidate}>Export candidate JSON</button>
          </div>
          {importError && <p className="authoring-error" role="alert">{importError}</p>}
          {validationMessage && <output className="authoring-success">{validationMessage}</output>}
          {firstIssue && <div className="authoring-error" role="alert">
            <strong>Candidate failed validation</strong>
            <ul>{validation!.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>
          </div>}
          {validation && validation.tiers.length > 0 && (
            <ul className="authoring-tier-results" aria-label="Validation by difficulty">
              {validation.tiers.map((tier) => (
                <li key={tier.tierId}>
                  {tier.tierId}: {tier.minimumSwaps ?? (validation.issues.some((issue) => issue.tierId === tier.tierId && issue.code === 'incorrect-shortest-solution') ? 'over 10' : 'unsolvable')} shortest swaps; {tier.attemptLimit} allowed; hint {tier.hint ? 'valid' : 'invalid'}
                </li>
              ))}
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
      <footer className="site-footer"><span>Small tiles. A clearer picture.</span><span>OFFLINE CONTENT TOOL <span aria-hidden="true">✦</span></span></footer>
    </div>
  );
}
