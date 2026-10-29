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

## Local behavior checks

```sh
npm test -- src/features/puzzle/daily-puzzle-api.test.ts src/features/puzzle/daily-puzzle-release-cache.test.ts
npm run test:e2e -- e2e/daily-puzzle.spec.ts
```

Controlled-clock tests cover ordinary rollover, both DST transition days and their ending midnights, generation crossing midnight, subsecond expiry, validation failures, stable release identity, and supported historical IDs becoming available at midnight. Loader tests reject stale/future replies before overwriting the offline copy. Browser tests cover all three mode choices, request headers, saved-round retry, existing rollover, offline play, and v1 replay. The broader browser suite exercises completion and resume compatibility.

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

Record the deployment URL, UTC timestamps, status/cache headers, IDs, and dates. If all three requests remain misses, inspect cache directives, authorization, rewrites, and the `x-vercel-id` region before increasing traffic. These three requests are a smoke test, not a load test or a capacity claim.

For rollover, save one response shortly before New York midnight and one just after, using the same URL. The first must expire no later than midnight; the second must carry the new date and a new ID, with the next midnight as its expiry. A previous-date body served as `HIT` or `STALE` after midnight fails the deployment check even though the client will reject it. Repeat the check after deployment changes; deterministic local tests cover the spring and autumn clock changes without waiting for those dates.

In a clean browser, confirm first visit loads, all modes share the date, and reload resumes a saved round with its mode, swaps, and hint state. For an unchanged date, completion markers must persist. Existing rollover resets previous-day progress; existing offline fallback remains a separately validated copy. This PR does not change production settings or deploy manually; record live smoke results after the authorized deployment.
