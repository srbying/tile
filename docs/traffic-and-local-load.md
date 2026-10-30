# Traffic, free allowances, and local burst measurements

Measured **2026-10-30** for [issue #31](https://github.com/srbying/tile/issues/31),
against production and local source commit
[`513116e`](https://github.com/srbying/tile/commit/513116e859a41d85beb92ab32c519ef815a2265b).

A first browser visit generated **10 CDN requests**; reopening the same profile
generated **3**. At 10,000 players visiting daily, a 10% cold-visit mix projects
**1,110,600 requests in 30 days**, including monitoring. That exceeds Hobby's
1,000,000-request allowance even though estimated transfer is only 7.016 GB.
These are conditional usage projections, not a safe visitor limit: the team
also hosts other projects, and remaining allowance is unverified.

The isolated local exercise completed all **4,200 offered requests**, with no
HTTP, network, timeout, payload failures, or unsent requests. Its 100-request/s
burst had p95 **7.85 ms** and p99 **10.17 ms**. This measures one local origin
process without a CDN; it establishes neither Vercel throughput nor production
p95/p99.

## Browser journeys and cache behavior

The public target was <https://tile-livid.vercel.app/>. Connected Vercel metadata
confirmed Hobby, four linked Git projects on the team, production function region
`iad1`, and the source commit above. Response correlation headers reported the
`cle1` edge location. See [context](evidence/issue-31/context.json).

Three serial pairs ran at **18:56:01–18:56:19 UTC** in Chromium 153.0.8010.12
at 1280×900 on macOS. Each pair used a fresh persistent profile, then closed and
relaunched that profile. Normal browser caching and service workers remained
enabled. There was no routing/interception, disabled cache, cache-busting,
automatic retry, or parallel public traffic.

First visits started Medium and swapped two visibly different tiles. Reopened
visits restored the identical 36-tile board, Medium's 12 remaining swaps, and
release `daily-v3-2026-10-30-0-1`. All six journeys passed. Browser-ready timing
starts before navigation and ends when the playable board is available; it
excludes browser launch. Observation continued for worker installation/control
and two further seconds; later background activity is outside this sample.

| Journey | CDN requests | Encoded response bodies | Transfer estimate¹ | Playable times, milliseconds |
| --- | ---: | ---: | ---: | --- |
| First visit, three samples | 10 each | 189,595 B each | 199,812 B each | 641.19 / 552.32 / 510.34 |
| Returning, three samples | 3 each | 739 B each | 3,697 B each | 335.38 / 354.12 / 323.39 |

¹ Encoded body bytes plus textual request/response header sizes and full URL.
This is a reproducible transfer proxy, not Vercel billing telemetry. It does not
reproduce HTTP/2 header compression, TLS or connection overhead. Encoded bodies
come from Chromium NetLog, before content decoding; Brotli was observed for
JavaScript, CSS, release JSON, and the worker script. Uncompressed font/HTML
bodies are included. Request headers are counted but their values are not saved.

The request breakdown explains why counting only the page's JSON fetch is wrong:

| Source | First visit | Returning visit |
| --- | --- | --- |
| HTML, JavaScript, CSS, font, release | Five HTTP 200 requests | Release HTTP 200; HTML HTTP 304 |
| Worker script | One HTTP 200 | One HTTP 304 update check |
| Worker installation precache | Four HTTP 304 revalidations: HTML and three assets | None |
| Local worker responses | Never counted again as CDN traffic | JavaScript, CSS, font served locally; navigation's worker response is counted only at its underlying network transaction |

The static files currently send `public, max-age=0, must-revalidate`. A 304 still
uses a CDN request, even with no body. All six reported release requests were
CDN `HIT`, with browser `Cache-Control: no-store`; first-profile visits therefore
do **not** mean cold CDN regions. The first reported release had `Age: 220`,
`Date: Fri, 30 Oct 2026 18:52:22 GMT`, and expiry at New York midnight,
`Sat, 31 Oct 2026 04:00:00 GMT`. Its CDN TTL was 32,857 seconds, with no stale
window. IDs/dates stayed correct. A hit implies no release-function invocation
for that request; production CPU and invocation totals were not measured.

[Browser evidence](evidence/issue-31/browser.json) preserves sanitized NetLog
transactions and supplemental DevTools cache observations. NetLog counts actual
HTTP sends, including browser-owned worker-script requests, once. It excludes
local cache reads with no HTTP send. The initial six diagnostic journeys used
only DevTools and missed worker traffic; those totals were discarded. Thus
**12 ordinary serial navigations** occurred in total, six in the reported sample.
No production stress exercise or cache purge occurred.

## Thirty-day consumption scenarios

Allowances were checked on **2026-10-30** against the
[Hobby plan](https://vercel.com/docs/plans/hobby) and
[Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing).

| Shared team resource | Included allowance used in model |
| --- | ---: |
| CDN requests | 1,000,000 |
| Fast Data Transfer: visitor ↔ CDN | 100 GB |
| Fast Origin Transfer: CDN ↔ function | 10 GB |
| Function invocations | 1,000,000 |
| Active CPU | 4 CPU-hours |
| Provisioned memory | 360 GB-hours |

The model uses decimal GB, a 30-day window, one visit per daily player, and the
same deployed shell. Cold share means empty browser cache/profile: 0% assumes
players already have the shell at the start of the window; 100% assumes every
visit needs it again. These are sensitivity cases, not retention forecasts.
Next-day release size is assumed equal to the measured day. Deployments,
cleared storage, different browsers, more daily visits, crawlers, abuse, and
other team projects can increase consumption.

The existing worker-blocked monitor makes five page/asset/API requests per run.
At four daily runs, include **120 runs, 600 CDN requests, 120 API requests, and
23,371,080 estimated transfer bytes**. Its transfer proxy uses the five matching
first-visit HTTP 200 transactions; this is an assumption, not another monitor
measurement. Manual checks/drills and CI/deployment usage are additional.

| Daily players | Visits | Cold share | CDN requests incl. monitor | Estimated Fast Data Transfer, GB |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 3,000 | 0% | 9,600 | 0.0345 |
| 100 | 3,000 | 10% | 11,700 | 0.0933 |
| 100 | 3,000 | 100% | 30,600 | 0.6228 |
| 1,000 | 30,000 | 0% | 90,600 | 0.1343 |
| 1,000 | 30,000 | 10% | 111,600 | 0.7226 |
| 1,000 | 30,000 | 100% | 300,600 | 6.0177 |
| 10,000 | 300,000 | 0% | 900,600 | 1.1325 |
| 10,000 | 300,000 | 10% | 1,110,600 | 7.0159 |
| 10,000 | 300,000 | 100% | 3,000,600 | 59.9670 |

CDN hits reduce origin work, not the CDN request/visitor-transfer totals.
[Vercel's accounting definitions](https://vercel.com/docs/manage-cdn-usage)
include both directions, headers, URLs, and compression. A returning visit is
not zero-cost. Ordinary swaps themselves made no new network requests.

Origin sensitivity uses misses of **0.1%, 1%, and 100% of API requests**, with a
minimum of **30 origin invocations** for 30 distinct daily releases in one active
region. The minimum prevents the smallest scenario from implying fewer than one
new release per day. It is not an assumed global invocation count: regional
eviction, deployment changes, concurrency and additional keys can add work.
Five independently missing regions would raise this illustrative minimum to
150. No request-collapsing guarantee is assumed.

For origin transfer, budget 7,950 uncompressed JSON bytes plus **2,048 assumed
header/request bytes per invocation**. The origin link's actual encoding and
headers were not observed. CPU proxies use **7.75436 ms warm** versus **236.623 ms
fresh-process request**; memory proxies assume one 2 GB allocation for each
observed request duration, **7.14212 ms warm** versus **206.928 ms fresh**.
Local RSS is not provisioned memory. Fluid can share an instance among requests,
and its busy lifetime includes I/O; these serial-duration proxies do not measure
Vercel allocation, startup overhead, hardware, billing, or remaining compute.
The returned metadata did not expose the project's Fluid/allocation settings;
verify these in the dashboard before treating the compute model as applicable.

| Daily players | API miss rate | Expected invocations² | Origin transfer GB | CPU-hours, warm / fresh | Memory GB-hours, warm / fresh |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0.1% | 30 | 0.0003 | 0.0001 / 0.0020 | 0.0001 / 0.0034 |
| 100 | 1% | 31.2 | 0.0003 | 0.0001 / 0.0021 | 0.0001 / 0.0036 |
| 100 | 100% | 3,120 | 0.0312 | 0.0067 / 0.2051 | 0.0124 / 0.3587 |
| 1,000 | 0.1% | 30.12 | 0.0003 | 0.0001 / 0.0020 | 0.0001 / 0.0035 |
| 1,000 | 1% | 301.2 | 0.0030 | 0.0006 / 0.0198 | 0.0012 / 0.0346 |
| 1,000 | 100% | 30,120 | 0.3011 | 0.0649 / 1.9797 | 0.1195 / 3.4626 |
| 10,000 | 0.1% | 300.12 | 0.0030 | 0.0006 / 0.0197 | 0.0012 / 0.0345 |
| 10,000 | 1% | 3,001.2 | 0.0300 | 0.0065 / 0.1973 | 0.0119 / 0.3450 |
| 10,000 | 100% | 300,120 | 3.0006 | 0.6465 / 19.7265 | 1.1908 / 34.5018 |

² Fractions are expected-value arithmetic, not observed partial invocations.
Origin estimates are independent of browser cold share because every journey
requests today's API once; saved-board replay resolves locally.

For the warm-origin cases, **CDN requests use the largest fraction of the six
allowances** in every modeled row. For 100% misses with every invocation paying
the measured fresh-request CPU cost, **CPU becomes the limiting resource**;
10k daily players project 19.73 CPU-hours against four included hours.
The [27-row scenario CSV](evidence/issue-31/monthly-scenarios.csv) includes every
cold/miss combination and the largest allowance fraction for both CPU cases.
None of the cases reserves quota for the other projects. In particular,
900,600 requests for entirely returning 10k daily players leaves little shared
headroom even before unexpected traffic.

### Peak arrivals, separately from monthly totals

This table assumes 10% cold visits and uniformly spreads the stated fraction
of daily players over one minute. It is arithmetic, not a traffic forecast.

| Daily players | Arrive in one minute | Visits/s = API requests/s | CDN requests/s |
| ---: | ---: | ---: | ---: |
| 100 | 10% | 0.17 | 0.62 |
| 100 | 100% | 1.67 | 6.17 |
| 1,000 | 10% | 1.67 | 6.17 |
| 1,000 | 100% | 16.67 | 61.67 |
| 10,000 | 10% | 16.67 | 61.67 |
| 10,000 | 100% | 166.67 | 616.67 |

At 10k players arriving within a minute, all-cold visits would instead imply
1,666.67 CDN requests/s; entirely returning visits imply 500/s. API arrivals
remain 166.67/s. Origin arrivals would be 0.167/s at 0.1% misses, 1.667/s at 1%,
or 166.67/s at 100%, before any uneven arrival or regional effects. Peak rates
exclude the separately budgeted low-frequency monitor.
[All 18 peak cases](evidence/issue-31/peak-scenarios.csv) preserve these assumptions.
No monthly quota is used as a requests-per-second limit.

## Local ramp, burst, sustained load, and recovery

One production-preview server loaded the repository's unchanged Vite config and
daily API; a separate Node client offered requests to
`http://127.0.0.1:4183/api/puzzles/today`. The target was fixed to loopback,
redirects were not followed, in-flight requests were capped at 64, and each
request had a 10-second deadline. Scheduled requests refused by the cap would
be counted as unsent. Payloads had to match the SHA-256 of the first fully
validated current release. The preview supplies **no shared CDN**: each accepted
request executes the origin path, including generation and validation.

Environment: Apple M4 Pro, 12 logical CPUs, 24 GiB memory, macOS 26.6.2 arm64,
Node 26.13.0, Vite 8.3.1. Production uses Node 24.x. Client and server shared one
desktop host, with background activity uncontrolled; a brief browser collector
fixture overlapped ramp. There was no concurrent public journey batch or app
test suite. Neither the host nor preview reproduces a Vercel function's CPU,
autoscaling, regional network, cache, isolation, or concurrency allocation.

Before load, the fresh server's first request took **206.93 ms** and consumed
**236.62 ms aggregate process CPU**. Fifty serial warm requests averaged
**7.14 ms** elapsed and **7.75 ms** aggregate server CPU each. CPU can exceed
elapsed time because process accounting includes multiple threads. Preview
initialization after its static ESM import took 39.37 ms; 158.77 ms of aggregate
process CPU was already recorded at readiness. Those startup observations are
separate from the request costs and do not measure Vercel cold starts.

| Phase | Offered rate / duration | Offered = successful | Completed/s³ | p50 ms | p95 ms | p99 ms | Peak in flight | Server CPU ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ramp 1 | 5/s, 20 s | 100 | 5.00 | 15.20 | 20.56 | 22.13 | 1 | 1,507.19 |
| Ramp 2 | 25/s, 20 s | 500 | 25.00 | 10.49 | 11.70 | 12.25 | 1 | 5,340.74 |
| Ramp 3 | 50/s, 20 s | 1,000 | 50.00 | 8.41 | 9.20 | 9.79 | 1 | 8,467.72 |
| Burst | 100/s, 10 s | 1,000 | 100.00 | 6.89 | 7.85 | 10.17 | 2 | 6,859.73 |
| Sustained | 25/s, 60 s | 1,500 | 25.00 | 10.09 | 12.22 | 15.44 | 1 | 14,477.63 |
| Recovery | 5/s, 20 s | 100 | 5.00 | 13.57 | 16.04 | 17.33 | 1 | 1,280.20 |

³ Successful completions divided by actual phase elapsed time, including drain.
All six phases had **zero HTTP/network/timeout/payload failures and zero unsent
requests**. Dispatch-lag p99 stayed below 1.83 ms. Quantiles use nearest rank over
completed request latencies; there were no failed requests excluded from them.
The 150-second exercise plus one fresh and 50 warm checks made **4,251 local
requests**. Peak recorded server RSS was 208,704 KiB (203.81 MiB); it is not
Vercel's allocated memory.

Recovery completed without a backlog or errors. Latencies need not rise with
offered rate: runtime warm-up, scheduling and the uncontrolled desktop affect
these observations. The exercise did not locate saturation, prove longer-run
stability, or test distributed/CDN capacity. See [phase metrics](evidence/issue-31/local.json)
and [all request observations](evidence/issue-31/local-requests.csv).

## Free boundary and response

Hobby does not provide paid continuation within this model. The provider says
exceeding included usage generally makes the feature unavailable until usage
ages out, commonly after 30 days; there is no promised first-of-month reset or
guaranteed grace period. Hosting can be paused. Check the affected resource and
account state rather than assuming only origin compute will stop while static
delivery continues. The free response is to stop promotion/avoidable traffic,
inspect shared Usage and notification emails, allow usage to fall below the
limit, and follow the displayed free recovery/support procedure if still
paused. See [Hobby's boundary guidance](https://vercel.com/docs/plans/hobby#hobby-billing-cycle)
and the [operations runbook](operations.md).

Plan and remaining usage are different facts. Actual remaining quota, usage
notifications, eligibility and billing settings remain unverified. Hobby is for
personal, non-commercial use. Before promotion, the owner must confirm those
settings and the applicable function model. First-time visitors depend on
hosting; returning users' installed shell and validated puzzle can help only
under the documented [fallback conditions](offline-shell-recovery.md). A hosting
quota error is not guaranteed to be a supported fallback status. Quota exhaustion
was modeled, never deliberately triggered.

Vercel permits deployment load tests only under its Enterprise/approved process.
The [current policy](https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments)
was checked before execution. The ramp/burst traffic went exclusively to the
local machine. No hosting settings, plans, paid features, external test services,
or resources were enabled or purchased.

## Evidence, reproduction, and acceptance

[Evidence index and exact one-off procedure](evidence/issue-31/README.md) includes
the historical source of collection and calculation commands. These inert
snapshots are not a maintained benchmark harness, npm command, or CI job.
No production code, public API, dependency, or game behavior changed.

Local controls verified 1,000 decoded bytes → 29 gzip bytes, a repeated fetch
served from HTTP cache without another network send, a worker-script request,
and a worker-proxied controlled HTTP 503 counted once. The model also checks
literal expected request totals and the daily-origin minimum. Raw browser
profiles/NetLogs, request header values, bodies and storage are not committed;
only sanitized observations and synthetic release identities are included.

| Issue #31 criterion | Evidence |
| --- | --- |
| Cold/returning requests, compressed bytes, cache and origin work; current limits | Browser and local measurements, response headers, account context, dated provider references |
| Monthly consumption separate from peak rate; quota boundary | 27 monthly scenarios, 18 peak scenarios, explicit formulas/assumptions and free interruption procedure |
| Isolated ramp, burst, sustained and recovery; latency, failures, conditions and limits | Six local phases, 4,251 request records including prechecks, CPU/RSS, timeout/cap/dispatch accounting, local-only interpretation |
| No unapproved Vercel load test or paid resource | Loopback-only load source, serial public capture description, read-only account inspection, no platform/dependency changes |

Verification: `npm run lint`, `npm run build` (including TypeScript), and
`npm test` passed (**285 tests**). Focused browser command
`npm run test:e2e -- e2e/daily-puzzle.spec.ts e2e/puzzle.spec.ts` passed
**126 tests with six existing platform-specific skips** across the four existing
browser projects. Collection controls and arithmetic assertions passed.
