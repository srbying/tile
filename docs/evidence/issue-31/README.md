# Issue #31 evidence, 2026-10-30

These are historical observations supporting [the report](../../traffic-and-local-load.md),
not a maintained performance-test suite. Application source is unchanged.

| File | Contents |
| --- | --- |
| `context.json` | Sanitized account/deployment facts, excluded capture count, host conditions and check results |
| `browser.json` | Six final journeys; `networkLog` is authoritative for network sends/encoded bodies; `cdp` provides supplemental page/worker cache observations |
| `validation.json` | Local known-size gzip, HTTP cache, worker and controlled-503 collection controls |
| `local.json` | Preview startup, fresh/warm request costs and six load-phase summaries |
| `local-requests.csv` | 4,251 local requests: phase, ordinal, schedule offset, dispatch lag, elapsed latency, status, failure category, body bytes |
| `model-inputs.json` | Measured inputs, monitoring/compute/header assumptions and six allowance values |
| `monthly-scenarios.csv` | All 27 player/cold-share/miss-share combinations; warm/fresh compute proxies and largest allowance fractions |
| `peak-scenarios.csv` | All 18 player/arrival-share/cold-share combinations; CDN/API and origin request rates |
| `model-validation.json` | Literal arithmetic and request-validation checks |
| `*.mjs.txt` | Exact one-off collection/control/calculation source archived as inert text; not integrated into npm or CI |

## Counting and formulas

For each same-origin NetLog URL-request source, an
`HTTP_TRANSACTION_[HTTP2_/QUIC_]SEND_REQUEST_HEADERS` event increments `sent`.
`sent > 0` identifies actual HTTP transactions. Worker-provided page responses
are not added again. Local HTTP-cache reads can have body-read events but no
send; those contribute zero requests/transfer. HTTP 304 contributes a request
and estimated headers, with zero encoded response body. A worker script fetch
can be absent from page DevTools events; NetLog includes it.

Encoded body size uses `URL_REQUEST_JOB_BYTES_READ` before decoding when present,
otherwise unencoded `URL_REQUEST_JOB_FILTERED_BYTES_READ`. HTTP status/cache
headers come from `HTTP_TRANSACTION_READ_RESPONSE_HEADERS`; CDP can show a
reconstructed 200 for a network 304. Header estimates sum UTF-8 textual lines
with CRLF plus the full request URL. They are not HTTP/2 compressed header sizes
or exact billable bytes. The gzip fixture checks the before-decoding count.
Reference: [Chromium NetLog event definitions](https://chromium.googlesource.com/chromium/src/+/main/net/log/net_log_event_type_list.h).

For daily players `D`, cold fraction `c`, API miss fraction `m`, and days `T=30`:

```text
visits = T × D
API requests = visits + 120 monitor runs
CDN requests = visits × (10c + 3(1−c)) + 120 × 5
Fast Data Transfer proxy bytes = visits × (199812c + 3697(1−c)) + 120 × 194759
origin invocations = max(30, API requests × m)
Fast Origin Transfer proxy bytes = origin invocations × (7950 + 2048)
CPU-hours = origin invocations × (7.75436 warm or 236.623 fresh) / 3600000
memory GB-hours = origin invocations × 2 GB × (7.14212 warm or 206.928 fresh) / 3600000
visits/s during peak = D × arrival fraction / 60
CDN requests/s during peak = visits/s × (10c + 3(1−c))
origin requests/s during peak = visits/s × m
```

The 30-origin floor is an explicit single-active-region minimum for daily new
releases, not a regional/cache-coalescing promise. `limitingWarm` and
`limitingCold` name the resource with the largest usage/allowance fraction in
that row, not an experimentally exhausted resource. CPU/memory are local-cost
sensitivity proxies. All scenarios assume otherwise unused allowances; actual
shared headroom is unknown. Decimal GB is used throughout the model.

## Reproduce the one-off procedure

Use the report's source commit for comparable results, with supported Node,
`npm ci`, and the repository's installed Chromium. The recorded run used local
Node 26.13.0 and the locked packages; changing versions changes the experiment.
The commands below copy inert snapshots into a temporary directory, replacing
only their original repository/output paths. Output stays outside the repo.

```sh
npm ci
npm run build
npx playwright install chromium
tile_measure_repo=$(git rev-parse --show-toplevel)
tile_measure_tmp=$(mktemp -d)
python3 - "$tile_measure_repo" "$tile_measure_tmp" <<'PY'
import pathlib, sys
repo, output = map(pathlib.Path, sys.argv[1:])
evidence = repo / 'docs/evidence/issue-31'
for source in evidence.glob('*.mjs.txt'):
    text = source.read_text()
    text = text.replace('/private/tmp/tile-issue-31', str(repo))
    text = text.replace('/private/tmp/tile31-capture', str(output))
    (output / source.name.removesuffix('.txt')).write_text(text)
PY
node "$tile_measure_tmp/fixture.mjs"
```

Stop if a collection assertion fails. Then make the six **serial normal browser
visits**; this is the only measurement command below that contacts production:

```sh
node "$tile_measure_tmp/capture.mjs" public
```

Keep ordinary production browser measurements infrequent. Do not point the load
exercise at any deployment. Stop other test/browser batches before the local
exercise. Its URL is fixed to `127.0.0.1`, redirects are not followed, and the
client and preview server run in separate processes:

```sh
node "$tile_measure_tmp/local-exercise.mjs"
node "$tile_measure_tmp/model.mjs"
```

The local script validates one fresh release, performs 50 serial warm requests,
then offers 5/25/50 requests/s for 20 seconds each, 100/s for 10 seconds, 25/s
for 60 seconds, and 5/s for 20 seconds. All phases drain before the next phase.
It records unsent requests at 64 in flight and enforces 10-second request
deadlines. Per-request elapsed time begins at dispatch; dispatch lag is recorded
separately. CPU snapshots are from the **server process**, excluding client
validation/hashing. Quantiles use nearest rank. Status, exact validated body
hash and network/timeout outcome determine success; redirects cannot count as
successful responses. The local clock must not cross New York midnight during
the exercise, since a legitimate release change would fail the fixed-body check.

The capture's temporary NetLogs/profiles can contain raw request metadata. Keep
those local. Only its sanitized `browser.json`/`validation.json` derivatives
belong in shareable evidence. Recheck provider limits, account settings, target
deployment identity, dates, and the report's limitations for any new run; the
archived fixed commit/limit metadata describes this run only.
