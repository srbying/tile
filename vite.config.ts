import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { createDailyPuzzleApi } from './src/features/puzzle/daily-puzzle-api';
import { defineConfig } from 'vitest/config';

const puzzleApi = createDailyPuzzleApi();

function installPuzzleApi(middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: (error?: Error) => void) => void) => void }) {
  middlewares.use((request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/puzzles/today') {
      void puzzleApi.today(new Request(url, { method: request.method })).then(async (result) => {
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(await result.text());
      }).catch(next);
      return;
    }

    const match = /^\/api\/puzzles\/([^/]+)$/.exec(url.pathname);
    if (match) {
      void puzzleApi.byId(new Request(url, { method: request.method }), decodeURIComponent(match[1]!)).then(async (result) => {
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(await result.text());
      }).catch(next);
      return;
    }
    next();
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'daily-puzzle-api',
      configureServer(server) { installPuzzleApi(server.middlewares); },
      configurePreviewServer(server) { installPuzzleApi(server.middlewares); },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
