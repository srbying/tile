import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
import { createDailyPuzzleApi, decodePuzzleId } from './src/features/puzzle/daily-puzzle-api.js';
import type { Plugin } from 'vite';
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
      void puzzleApi.byId(new Request(url, { method: request.method }), decodePuzzleId(match[1]!)).then(async (result) => {
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(await result.text());
      }).catch(next);
      return;
    }
    next();
  });
}

function offlineShellPlugin(): Plugin {
  return {
    name: 'offline-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      const precacheOutputs = Object.values(bundle)
        .filter((output) => output.fileName !== 'index.html' && output.fileName !== 'sw.js'
          && !output.fileName.endsWith('.map'))
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
      const precacheUrls = [
        '/',
        ...precacheOutputs.map((output) => `/${output.fileName}`),
      ];
      const cacheHasher = createHash('sha256').update(JSON.stringify(precacheUrls));
      for (const output of precacheOutputs) {
        cacheHasher.update(output.fileName).update('\0');
        cacheHasher.update(output.type === 'chunk' ? output.code : output.source);
      }
      const cacheVersion = cacheHasher.digest('hex').slice(0, 12);
      const source = `
const CACHE_NAME = 'tile-app-shell-${cacheVersion}';
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then((cache) => cache.addAll(PRECACHE_URLS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names
      .filter((name) => name.startsWith('tile-app-shell-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match('/')) || Response.error();
    }));
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) =>
      (await cache.match(url.href)) || fetch(request)));
  }
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    offlineShellPlugin(),
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
