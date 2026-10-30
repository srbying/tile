# Daily release operations

Response owner: **Steven Byington (`@srbying`)**. Public game: <https://tile-livid.vercel.app/>.
Vercel project: `tile`, team `srbyington-6585s-projects`.

See [traffic, free allowances, and local burst measurements](traffic-and-local-load.md)
for the 2026-10-30 first/returning visit evidence, daily-player scenarios, quota
boundary response, and limits of the isolated local exercise. Connected Vercel
metadata now confirms Hobby; remaining shared usage and account settings still
need owner verification before promotion.

## Activate checks and failure email

**Check public daily release** runs at **00:17, 06:17, 12:17 and 18:17 UTC** once
the workflow reaches `main`. It opens one fresh Chromium context with service
workers blocked, observes the page's normal release request, validates its payload
and New York date, starts Medium, checks both 36-tile boards and swaps two tiles.
It uses ordinary CDN caching, with no extra API probe, retry or cache-busting.

1. In GitHub **Settings → Notifications → Actions**, enable email and select
   failed workflows only. Verify the destination email address.
2. Open repository **Actions → Check public daily release**. Ensure it is enabled.
   Scheduled email follows the schedule actor (creator, last cron editor or
   person re-enabling it), not everyone watching the repo. The owner can disable
   and re-enable the workflow to establish notification ownership.
3. **Run workflow** on `main` with `simulate_failure` unchecked; confirm green
   against the public URL after deployment.
4. Run again with **simulate_failure checked**. Expect a red run with
   `release_http`, `releaseStatus: 503`, `controlledFailure: true` and failure
   email. Only that browser's release response is intercepted; production stays
   available. This drill tests detection/notification, not server logging.
5. Run normally again. Record run URLs and email receipt. Until this drill is
   completed, actual notification delivery is **unverified**.

Native email has no separate integration fee. Delivery depends on personal
settings, schedule ownership, GitHub and email availability. Six hours is a
nominal detection window, not an SLA: jobs can be delayed/dropped, brief outages
can be missed, and a stopped scheduler cannot alert. Public-repo schedules are
disabled after 60 days without repository activity; check/re-enable before
promotion. See [notification rules][notifications] and [schedule limits][schedules].

For one-off checks, install dependencies and Chromium and specify the target:

```sh
npm ci
npx playwright install --with-deps chromium
TILE_MONITOR_URL=https://tile-livid.vercel.app/ npm run monitor
```

Set `TILE_MONITOR_SIMULATE_FAILURE=true` for the same browser-only drill. A local
preview URL also works. The standalone monitor does not start a server. Ordinary
PR browser tests use local intercepted responses and do not contact production.

## Respond to a failure

1. **Read the Actions run.** Inspect reason, UTC timestamp, statuses, release
   identity and elapsed time in its log/summary. A marked drill is expected to
   fail. Failure before the probe report indicates runner/dependency/browser
   setup trouble. Re-run once normally or open the public URL in a private
   browser without Vercel login. Notify Steven through the configured email;
   manual handoffs should include run URL, timestamp, reason and player impact.
2. **Inspect errors promptly.** In Vercel → `tile` → **Logs**, select Production
   and the incident time within the last hour; filter `daily_puzzle_failure`.
   `today` / `by_id` events distinguish generation, invalid release, wrong date
   and serialization failures. `load_today` events are local browser-console
   diagnostics for HTTP/network/JSON/timeout/validation failures, including when
   a cached fallback works. Player browser errors are not centrally collected.
   Cancellation is quiet. Application diagnostics exclude raw exceptions,
   stacks, queries, request headers, response bodies, cookies and player progress.
3. **Inspect delivery/cache.** In browser Network, inspect `/` and canonical
   `/api/puzzles/today`: status, release date/ID, `Date`, `Expires`, `Age`,
   `x-vercel-cache` and `x-vercel-id` when present. Use only the synthetic
   request's correlation ID for investigation. Browser `Cache-Control: no-store`
   coexists with CDN caching; Vercel may consume CDN-specific headers. `MISS`
   alone is not a failure. A cache hit proves delivery, not new origin generation;
   origin logs cannot cover every CDN/network failure. Avoid cache-busting and
   repeated purges.
4. **Inspect requests/usage.** Use project **Observability** for available CDN,
   transfer, cache and function views, then team **Usage** for shared requests,
   Fast Data/Origin Transfer, CPU, memory and invocations. Distinguish edge traffic
   from origin work. Record unavailable/expired views; use synthetic timings,
   response headers and available logs instead. Monitor timings do not establish
   production p95/p99 or capacity.
5. **Handle quota pressure.** Verify actual plan, remaining shared usage and
   account email/usage-notification settings. Stop promotion and reduce avoidable
   traffic; disable monitoring if necessary. Hobby exhaustion can pause service;
   follow the affected resource's free recovery procedure. Built-in usage notices
   are automatic; custom thresholds and Spend Management are paid capabilities.

## Roll back and verify

1. In Vercel **Deployments**, confirm team/project, current production commit and
   the previous production deployment. Identify the last known healthy version.
2. Use **Instant Rollback** to the previous production deployment. Hobby permits
   only that immediately previous production version. If it is unhealthy, prepare
   a tested fix/revert PR through normal deployment instead of upgrading.
3. Run the normal public monitor manually; verify current New York date, valid
   identity, board and swap. Check a saved round restores and inspect fresh errors.
   Keep immutable release identities/content stable; corrections need a new ID.
4. Record deployment IDs, affected dates, failed/recovered run URLs and mitigation.
   Rollback disables automatic production-domain assignment; deliberately promote
   the tested fix through normal release procedure to restore it. See
   [Instant Rollback][rollback] and [Hobby rollback limits][rollback-limits].

Run a normal manual check after production deployment, rollback or relevant
cache/routing changes. Scheduled 06:17 UTC follows New York midnight in both DST
seasons. No rollback or production configuration change is performed by this PR.

## Free limits and verification status

Recorded **2026-10-30**; recheck before changing visibility, plan or cadence.

| Capability | Availability / verification |
| --- | --- |
| Public URL | Anonymous implementation smoke check at 2026-10-30 14:02 UTC passed page/release HTTP 200, release `daily-v3-2026-10-30-0-1`, modes, boards and swap in 3.037 seconds; verify again after deployment. |
| Repository | `srbying/tile` reported public during planning. Standard public-repo runners are free. |
| Hosting account | Connected deployment context confirmed Hobby on 2026-10-30, with four linked Git projects sharing the team. Eligibility, remaining shared quota, billing/notification settings and personal preferences remain unverified; see the traffic report. |
| Hobby runtime logs | Included, one-hour retention. Longer retention and Log Drains unavailable for free. |
| Hobby Observability | Included with 12-hour retention and limited breakdowns; queries/notebooks and function p75/path analysis require Observability Plus. |
| Runtime alerts/custom monitors | Pro/Enterprise with Observability Plus; unavailable in this free setup. GitHub provides the external check. |
| Usage notices | Built-in notifications available; actual settings/receipt unverified. Custom thresholds and Spend Management require paid capabilities. |
| Failure email | Native Actions email available; settings and receipt require owner activation/drill above. |
| Hobby rollback | Immediately previous production deployment only. |

Four scheduled runs daily means at most **124 runs in a 31-day month**. At the
ten-minute job cap, budget **1,240 standard Linux minutes** for scheduled runs;
verify actual billed minutes, including setup and whole-minute rounding. Manual
runs, drills and existing CI are additional. The monitor uploads no artifacts,
creates no Actions dependency cache and uses no purchased service.

For private repos, GitHub Free includes **$12/month** shared compute (equivalent
to **2,000 standard Linux minutes at $0.006/minute**); Pro includes $18. Other
eligible workflows/products share that pool. This monitor's projection alone
fits Free, but account-wide usage can exhaust it. Review **Billing → Budgets and
alerts**, enable included-usage alerts, and configure a budget with **Stop usage
when budget limit is reached** to block paid continuation. An alert-only budget
does not stop charges. Verify actual controls before relying on private-repo
monitoring; exhaustion can stop both CI and monitoring. Personal billing settings
are not changed by this PR. See [billing][billing], [rounding][rounding] and
[budget controls][budgets].

Checks are low-volume functional probes, not load tests or capacity guarantees.
No paid alerts, drains, retention, upgrades or overages are enabled.

Implementation evidence: 282 unit tests passed; the full browser matrix passed
354 tests with 42 existing platform-specific skips. Build/typecheck, lint and
workflow YAML parsing passed. The standalone command passed locally and on the
public URL. A local controlled 503 exited with status 1 and wrote the expected
failure summary; native email receipt remains the owner's post-merge drill.

[notifications]: https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs
[schedules]: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
[billing]: https://docs.github.com/en/billing/concepts/product-billing/github-actions
[rounding]: https://docs.github.com/en/billing/reference/actions-runner-pricing
[budgets]: https://docs.github.com/en/billing/how-tos/set-up-budgets
[rollback]: https://vercel.com/docs/instant-rollback
[rollback-limits]: https://vercel.com/docs/cli/rollback

Provider references: [Hobby](https://vercel.com/docs/plans/hobby),
[runtime logs](https://vercel.com/docs/logs/runtime),
[Observability limits](https://vercel.com/docs/observability/observability-plus#limitations),
[alerts](https://vercel.com/docs/alerts), [notifications](https://vercel.com/docs/notifications).
