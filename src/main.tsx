import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PuzzleGame } from './features/puzzle/puzzle-game';
import { DifficultyPreviewPage } from './features/puzzle/difficulty-preview-page';
import { PuzzleAuthoringPage } from './features/puzzle/puzzle-authoring-page';
import './styles.css';

const page = window.location.pathname === '/preview'
  ? <DifficultyPreviewPage />
  : window.location.pathname === '/author' ? <PuzzleAuthoringPage /> : <PuzzleGame />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {page}
  </StrictMode>,
);
