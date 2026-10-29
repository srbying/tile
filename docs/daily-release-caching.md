# Daily release caching

`GET /api/puzzles/today` uses Vercel's built-in regional CDN. Normal repeated requests can reuse a validated public release without invoking the function. A miss, eviction, or new deployment regenerates and validates the same deterministic release. Do not assume a single invocation or request collapsing across regions.

This uses the existing CDN, available on all Vercel plans, without adding services, storage, scheduled jobs, paid features, or quota changes. Existing free-plan limits still apply; this change does not establish production capacity or verify account billing settings. See [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache).

## Response contract

| Header | Current release behavior |
| --- | --- |
| `Cache-Control` | `no-store`: the browser HTTP cache cannot retain the current pointer. |
| `CDN-Cache-Control` | `public, s-maxage=N, must-revalidate, stale-while-revalidate=0, stale-if-error=0`: shared freshness only, with no stale-serving window. |
| `Date` | UTC time after generation and validation. |
| `Expires` | Next midnight in `America/New_York`, expressed in GMT. |
| `x-vercel-cache` | Vercel adds the observed cache result, such as `MISS`, `HIT`, or `REVALIDATED`. Local Vite does not add it. |
| `Age` | When supplied by the CDN, elapsed cache age in seconds. |

`CDN-Cache-Control` overrides `Cache-Control` for Vercel and is forwarded for inspection. The loader uses ordinary fetch caching (`cache: 'default'`) so it does not force CDN revalidation; the response still prevents browser HTTP caching. See [Vercel header priority](https://vercel.com/docs/caching/cache-control-headers#behavior).

Freshness uses the remaining whole seconds until the next New York midnight, calculated after validation. It rounds down rather than extending beyond the boundary; a response in the last fractional second is `no-store` in both caches. `Expires` records the absolute boundary, and `Date` anchors HTTP age calculations. A spring-transition day can have 82,800 seconds; an autumn-transition day can have 90,000. No fixed 24-hour TTL or fixed UTC offset is used.

If generation crosses midnight, the origin regenerates for the new date once. Invalid or wrong-date releases, errors, and rejected methods are not cached. The client also rejects an online release whose date differs from its current New York date, including a request that finishes after midnight. A delayed or stale CDN reply therefore cannot be accepted as today's puzzle; the existing accessible error and retry flow is available without clearing saved progress. This client check shares the game's existing reliance on the device clock.

All difficulty modes use the same release. Generator versions, boards, IDs, budgets, completion rules, and the separately validated offline copy retain their existing behavior. Supported v1/v2/v3 IDs remain immutable; future IDs return an uncached 404 until their New York release date. A future correction that changes immutable puzzle content must use a new version or ID.

## Historical releases and saved rounds

`GET /api/puzzles/:id` returns validated immutable JSON with these headers:

| Header | Historical release behavior |
| --- | --- |
| `Cache-Control` | `public, max-age=31536000, immutable` for browsers. |
| `CDN-Cache-Control` | `public, s-maxage=31536000, immutable` for shared caches. |

One year is the configured freshness period, not a retention guarantee. A regional miss, eviction, or deployment rebuilds the same release from its versioned ID. No database, paid feature, or per-ID process cache is added. See [Vercel cache limits](https://vercel.com/docs/caching/cdn-cache#limits).

IDs have the canonical form `daily-v<version>-YYYY-MM-DD-<variation>-<scramble>`. Supported versions are 1, 2, and 3. V1 variations are 0–66; v2/v3 variations are 0–44; scrambles are 0–3. Dates must be real calendar dates, and numeric components cannot have leading-zero aliases. The API checks the bounded ID and its New York release date before generation. Malformed, unsupported, unavailable, and future IDs return JSON 404 with both caches disabled. Invalid provider output or generation exceptions return JSON 503 with both caches disabled; rejected methods return 405 with `Allow: GET` and the same no-store policy.

Valid API URLs with query strings or encoded historical-ID aliases receive an uncached `308` to the query-free canonical path before generation. Malformed and future IDs still return `404` before redirecting. Follow the redirect when checking valid aliases; use canonical URLs for cache smoke tests. See [request protection](puzzle-request-protection.md) for limits, player recovery, and the owner-run firewall guide.

Saved-round resolution uses the same identity parser and local historical generators. Valid unfinished progress takes priority; otherwise valid completed results select their original release. Saves must match the loaded release date, so an online New York rollover still expires yesterday's round. An eligible offline copy retains its displayed date and can restore a matching saved round. Puzzle ID, board, mode, attempts, hint use, elapsed time, and completed results retain the existing storage format. Visibly solved v2 saves still recover as wins without spending another swap, and legacy hint normalization remains unchanged.

Full-payload fingerprints recorded from main at `375dc65` cover all 628 version/variation/scramble combinations for a fixed date, including hints, metadata, and budgets. Content corrections must introduce a new generator identity and retain the previous replay path; do not update historical fingerprints to accept changed content behind an existing ID. This delivery change keeps v3 current.

## Local behavior checks

```sh
npm test
npm run test:e2e -- e2e/daily-puzzle.spec.ts e2e/historical-compatibility.spec.ts e2e/ribbon-equivalence.spec.ts
```

Controlled-clock tests cover ordinary rollover, both DST transition days and their ending midnights, generation crossing midnight, subsecond expiry, validation failures, stable release identity, and supported historical IDs becoming available at midnight. Loader tests reject stale/future replies before overwriting the offline copy. Browser tests cover all three mode choices, request headers, saved-round retry, existing rollover, offline play, and v1 replay. The broader browser suite exercises completion and resume compatibility.

Historical tests also cover canonical bounds, invalid IDs rejected before generation, explicit shared-cache directives, invalid provider output, independent origin misses, and the full-payload fingerprints. Restore unit tests cover unfinished rounds, wins, and losses in all three versions and modes. Browser tests verify reload preservation and read-only completion review across versions, alongside existing v2 recovery and rollover cases.

The SPA rewrite in `vercel.json` excludes `/api` and its children, so dynamic `/api/puzzles/:id` functions can resolve before the HTML fallback. A working `/api/puzzles/today` alone does not verify dynamic API routing.

Vite development and preview return the same origin headers and release content. They do not implement a shared CDN; local responses and tests cannot prove a deployed cache hit.

## Low-volume deployment smoke test

After a deployment, use its normal public URL and make three GET requests to the identical URL from one location. Use GET rather than HEAD, no random query strings, no authorization headers, and no `Pragma: no-cache` or `Cache-Control: no-cache`. Browser developer tools with “Disable cache” enabled force revalidation and are unsuitable for this check.

```sh
puzzle_origin=https://YOUR-PUBLIC-HOST
for sample in 1 2 3; do
  curl --silent --show-error --fail-with-body \
    --dump-header "today-$sample.headers" \
    --output "today-$sample.json" \
    "$puzzle_origin/api/puzzles/today"
done
rg -i '^(HTTP/|date:|expires:|cache-control:|cdn-cache-control:|age:|x-vercel-cache:|x-vercel-id:)' today-*.headers
python3 - <<'PY'
import json
from datetime import datetime
from zoneinfo import ZoneInfo

releases = [json.load(open(f'today-{sample}.json')) for sample in (1, 2, 3)]
assert releases[0] == releases[1] == releases[2]
release = releases[0]
assert release['releaseDate'] == datetime.now(ZoneInfo('America/New_York')).date().isoformat()
assert release['puzzleId'] == release['puzzle']['id']
print(release['puzzleId'], release['releaseDate'])
PY
```

Expect 200 responses, a positive shared TTL, `Expires` at the next New York midnight, and identical bodies. A cold region can start with `MISS` or `REVALIDATED`; subsequent requests should show `HIT`. An already warm region can return `HIT` immediately. Region changes or eviction can cause additional misses, which must still return the same validated release. A cache status alone does not prove freshness: compare the release date, ID, `Date`, `Age` when present, and `Expires` together. Do not run the equality check across midnight.

Also GET `/api/puzzles/<today-puzzle-id>`, `/api/puzzles/daily-v1-2026-09-29-0-0`, and `/api/puzzles/daily-v2-2026-09-29-0-0`. Require JSON 200 responses with immutable cache directives; today’s replay must equal today’s release. A supported ID dated tomorrow must return JSON 404 with `no-store`. An HTML 200 response fails this check because it indicates the SPA rewrite intercepted the API route.

To check historical shared caching, repeat each supported version's identical URL three times:

```sh
for version in 1 2 3; do
  for sample in 1 2 3; do
    curl --silent --show-error --fail-with-body \
      --dump-header "historical-v$version-$sample.headers" \
      --output "historical-v$version-$sample.json" \
      "$puzzle_origin/api/puzzles/daily-v$version-2026-09-29-0-0"
  done
  cmp "historical-v$version-1.json" "historical-v$version-2.json"
  cmp "historical-v$version-1.json" "historical-v$version-3.json"
done
rg -i '^(HTTP/|cache-control:|cdn-cache-control:|age:|x-vercel-cache:|x-vercel-id:)' historical-*.headers
```

Require 200 JSON with the exact requested `puzzleId` and matching `puzzle.id`, identical bodies per URL, and both historical headers above. Expect subsequent requests in a warm region to show `HIT`; record `Age` when present. Also request an out-of-range ID such as `daily-v3-2026-09-29-45-0`, a noncanonical ID such as `daily-v3-2026-09-29-00-0`, and a supported ID dated tomorrow: all must return JSON 404 with browser/CDN `no-store`. These checks use the existing automatic PR preview or an already authorized deployment; they do not require a manual deployment or production setting changes.

Broken percent-encoding such as `%E0%A4%A` can be rejected by the hosting HTTP layer before the function runs: the automatic preview returned plain HTTP 400 for this path. Such transport errors do not carry application headers. Malformed IDs that reach the function return the JSON 404 contract; local tests separately verify that decoding failures are handled without invoking generation.

Record the deployment URL, UTC timestamps, status/cache headers, IDs, and dates. If all three requests remain misses, inspect cache directives, authorization, rewrites, and the `x-vercel-id` region before increasing traffic. These three requests are a smoke test, not a load test or a capacity claim.

For rollover, save one response shortly before New York midnight and one just after, using the same URL. The first must expire no later than midnight; the second must carry the new date and a new ID, with the next midnight as its expiry. A previous-date body served as `HIT` or `STALE` after midnight fails the deployment check even though the client will reject it. Repeat the check after deployment changes; deterministic local tests cover the spring and autumn clock changes without waiting for those dates.

In a clean browser, confirm first visit loads, all modes share the date, and reload resumes a saved round with its mode, swaps, and hint state. For an unchanged date, completion markers must persist. Existing rollover resets previous-day progress; existing offline fallback remains a separately validated copy. This PR does not change production settings or deploy manually; record live smoke results after the authorized deployment.
