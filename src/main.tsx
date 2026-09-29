import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PuzzleGame } from './features/puzzle/puzzle-game';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PuzzleGame />
  </StrictMode>,
);
