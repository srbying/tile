import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PuzzleGame } from './features/puzzle/puzzle-game';
import { DifficultyPreviewPage } from './features/puzzle/difficulty-preview-page';
import './styles.css';

const page = window.location.pathname === '/preview' ? <DifficultyPreviewPage /> : <PuzzleGame />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {page}
  </StrictMode>,
);
