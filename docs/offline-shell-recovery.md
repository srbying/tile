# Reopening the game during an outage

Returning players can reopen the game from a complete app shell installed during an earlier successful visit. The production build installs a service worker on HTTPS (or localhost) and precaches the game HTML, scripts, styles, and bundled font. Browser support, worker activation, and retained browser storage are required. Development mode does not install the worker.

## Navigation behavior

The worker tries the network first for same-origin GET navigations outside `/api/`.

| Navigation result | With an installed, retained shell | Without a cached shell |
| --- | --- | --- |
| Offline or rejected network request | Open cached game HTML and assets. | Browser navigation error. |
| HTTP 429 or 500–599 | Open cached game HTML and assets. | Retain the original HTTP error response. |
| Successful response or other HTTP status, including 401, 403, and 404 | Use the network response. | Use the network response. |

Fetch resolves HTTP error responses, so the worker checks their status before choosing the shell. See [MDN: Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch). Navigations do not write to the shell cache. Installation uses `Cache.addAll`, which rejects unsuccessful responses; an outage error page cannot replace the installed app through these paths. See [MDN: Cache.addAll](https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll).

An uncached first visit cannot show the game's unavailable screen if the host cannot deliver the app. The player sees the browser's network error or the host's HTTP error page and can reload after service returns. Clearing site data, using another browser or hostname, or browser eviction can remove the installed fallback. A previously open tab alone does not prove that installation finished.

## Release, progress, and retry

The shell contains no daily release. `/api/` requests bypass the shell worker; the existing release loader owns the request deadline, response validation, and dated fallback. See [daily release caching](daily-release-caching.md).

After reopening, the game tries today's release. Eligible load failures can use the latest validated cached release, dated no later than the current New York day. The game displays and announces “Using a saved puzzle from YYYY-MM-DD. Today’s puzzle could not be loaded.” An older release also uses its own date in the footer and saved-pattern instructions, so the player can identify the puzzle they are playing. Future or corrupt cached content cannot start a round.

A delivered shell with no valid release shows the existing alert and **Try again** button. The button supports keyboard activation. Failed loads preserve saved progress. A valid fallback for the saved puzzle restores the board, mode, attempts, and hint state; ordinary swaps stay local. Reload after service returns to fetch the online release. Same-day recovery preserves the round, while a new day's successful release follows the existing daily reset rules.

## Origin outage and hosting pause

An origin or puzzle-function outage can leave CDN delivery available. The browser can still receive the shell, and returning players can use a retained release if the current request fails.

A site-wide hosting pause can affect delivery of the HTML, worker, assets, and API together. Vercel documents a `503 DEPLOYMENT_PAUSED` response for paused projects and pauses Hobby plans that exceed included usage. See [project pause behavior](https://vercel.com/docs/projects/managing-projects#pause-a-project-using-the-rest-api) and [plan usage behavior](https://vercel.com/docs/plans#what-happens-when-i-reach-100-usage).

A browser that already controls the site with a complete retained shell can use the same local fallback for an eligible response during such a pause. First-time visitors and browsers missing that installation still depend on hosting delivery. These local tests simulate failures; they do not verify a provider pause or guarantee availability through one. This change adds no service, paid feature, overage setting, or hosting configuration and does not bypass free-plan limits.

## Verification

```sh
npm run test:e2e -- e2e/shell-recovery.spec.ts
npm run test:e2e -- e2e/daily-puzzle.spec.ts e2e/load-recovery.spec.ts
```

The shell suite uses the built production worker and real browser Cache Storage. Desktop and phone Chromium cases close the original page and reopen during offline, rejected-network, 429, and representative 5xx failures. They cover repeated outage navigation, saved board/mode/attempts/hint restoration, local swaps, and successful online recovery. Other cases check older-release labeling, missing/corrupt/future/unavailable release storage, keyboard retry, excluded client errors, lost shell cache, and uncached first visits.

Playwright service-worker network interception limits these shell tests to Chromium. WebKit skips them; the existing loader and gameplay browser tests still run in WebKit. Physical Safari and device offline checks remain manual. All failure simulation runs against a local preview, with no production load or capacity claim.
