# Puzzle request protection

Issue [#28](https://github.com/srbying/tile/issues/28) adds request guards and an owner-run firewall rollout. This change creates no dashboard rules, publishes no firewall configuration, and enables no paid service. Steven Byington owns rollout, traffic review, and rollback.

## Request behavior

The API checks methods before generation: unsupported methods return uncached `405` with `Allow: GET`. Historical requests also pass the bounded identity parser and New York release-date check before generation or redirects. Invalid, unsupported, and future IDs return uncached `404`. The decoder rejects encoded segments longer than 72 characters before decoding; a supported ID contains at most 24 ASCII characters, each optionally represented as `%HH`.

Valid requests with query strings or encoded historical-ID aliases return `308` to the query-free canonical path. The response has a relative `Location`, `Cache-Control: no-store`, and `CDN-Cache-Control: no-store`. It neither generates nor validates a release. For example, `/api/puzzles/%64aily-v3-2026-09-29-44-3?cacheBust=1` redirects to `/api/puzzles/daily-v3-2026-09-29-44-3`. Query values cannot choose a redirect host.

Canonical requests retain the [daily and immutable historical cache policies](daily-release-caching.md). Redirects consolidate successful release delivery under those cache keys. A request for an uncached alias still invokes the origin and consumes normal delivery usage; these guards reduce generation work without imposing a traffic or cost ceiling. Cache misses, eviction, and independent regions can still cause generation.

Players receiving HTTP `429`, including an HTML firewall response, use a validated cached release when one exists. The app announces its date and preserves the saved round. Without a valid copy, players see the accessible error and **Try again** control. The loader makes no automatic retries. Swaps remain local. Historical saved rounds and completed results retain supported v1/v2/v3 behavior.

## Free protection and known account state

On October 29, 2026, Vercel's connected account reported team `srbyington-6585s-projects` as **Hobby** and project `tile` as `prj_X1rLcZOFDkjyossR1j6pzMiCMiJD`. A read of its active firewall configuration returned `404: Seawall Config not found`. Existing custom rules, available rule slots, and remaining allowances are **unverified**; that response does not establish an empty firewall configuration.

Vercel includes [automatic DDoS mitigation](https://vercel.com/docs/vercel-firewall/ddos-mitigation) on all plans. The current [rate-limit documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) lists one Hobby rate-limit rule within three custom rules, fixed windows of 10–600 seconds, IP/JA4 counting, and 1,000,000 included allowed requests. Counters operate per region. Mitigated requests avoid CDN-request and transfer usage; allowed traffic, including log-only traffic, still consumes normal allowances. See [WAF pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing).

Before creating or enabling a rule, the owner must confirm Hobby eligibility, current plan, available slots, remaining WAF allowance, and shared team usage in **Settings → Billing/Usage** and the project's **Firewall** dashboard. Hobby applies to personal, non-commercial projects. Keep the existing plan and quotas. If the UI requires an upgrade, a paid feature, or a billing commitment, leave the proposed rule disabled. Do not replace an existing rule to make room.

The [Hobby documentation](https://vercel.com/docs/plans/hobby) describes feature pauses after allowance exhaustion, often until 30 days have passed. It does not establish this account's remaining allowance or the exact WAF exhaustion behavior. Record the current dashboard guidance before activation; do not rely on rate limiting to remain available after exhaustion. Free usage limits can interrupt play. Free fallback: retain automatic DDoS protection and use the available Firewall traffic view, normal usage dashboard, and request guards to identify abuse; document the absence of custom rate enforcement. Do not enable Observability Plus, paid managed rulesets, storage, or a metered rate-limit SDK for this task.

## Proposed rule and shared networks

| Setting | Initial value |
| --- | --- |
| Name | `Puzzle API request volume` |
| Match | Path starts with `/api/puzzles/`, all methods and environments |
| Counter | Client IP, fixed 60-second window |
| Threshold | 1,000 matching requests per IP per region |
| Exceeded action | **Log**; requests continue |
| Optional later enforcement | Default rate-limit action, HTTP `429` |

The starting assumption is 100 people behind one shared IP, each making two release requests per minute: 200 requests, with fivefold headroom. Canonical redirects add a request when callers use aliases. This is a tuning assumption, not measured capacity. Review school, workplace, carrier, and household traffic before lowering the threshold or enforcing it. A shared IP exceeding an enforced limit can affect legitimate players until the window resets. Do not add broad IP, user-agent, or JA4 blocks as a substitute for traffic review.

The rule counts canonical cache hits, redirects, historical restores, and rejected requests in the same budget. Static assets, the app shell, and authoring paths fall outside its prefix. An in-process counter would vary across serverless instances and regions, so the app adds no per-IP limiter and does not trust forwarded headers to establish identity.

## Owner setup and observation

Use an authenticated current Vercel CLI. Commands below follow the [current CLI reference](https://vercel.com/docs/cli/firewall); the implementation environment had no installed `vercel` executable, so these are owner-run instructions. Check the installed command's `--help` if its flags differ. The helper pins both team and project without relying on a local project link:

```sh
tile_firewall() {
  vercel --scope srbyington-6585s-projects firewall "$@" \
    --project prj_X1rLcZOFDkjyossR1j6pzMiCMiJD
}
tile_rule='Puzzle API request volume'
tile_firewall status
tile_firewall rules list --json
tile_firewall diff
```

Confirm the target project and inspect existing drafts. Stop if another operator has pending edits: publishing applies **all** staged firewall changes. Once the free-plan checks pass and the rule slot is available, stage the log-only rule:

```sh
tile_firewall rules add "$tile_rule" \
  --condition '{"type":"path","op":"pre","value":"/api/puzzles/"}' \
  --action rate_limit --rate-limit-algo fixed_window \
  --rate-limit-window 60 --rate-limit-requests 1000 \
  --rate-limit-keys ip --rate-limit-action log --yes
tile_firewall rules inspect "$tile_rule" --json
tile_firewall diff
```

The owner reviews the diff and runs `tile_firewall publish --yes` to activate logging. Record the returned rule ID. Review ordinary production traffic before any blocking, using the free recent window:

```sh
tile_firewall traffic list --since 1h --dimension path --dimension rule --json
tile_firewall traffic inspect rule YOUR_RULE_ID --since 1h --group-by ip
```

Open [tile's Firewall traffic dashboard](https://vercel.com/srbyington-6585s-projects/tile/firewall/traffic) and filter by the recorded rule ID. Review actions, API paths, per-IP bursts, and normal player timing. Compare CDN cache results and function usage in the standard project views to distinguish edge traffic from generation. Use the available free retention window, at most 24 hours; do not purchase longer retention. Keep IP details in the provider dashboard and out of repository evidence or player-facing errors.

Remain in log mode until traffic supports enforcement. To adjust a threshold while retaining observation, stage a change, inspect it, and have the owner publish:

```sh
tile_firewall rules edit "$tile_rule" \
  --action rate_limit --rate-limit-window 60 --rate-limit-requests 2000 \
  --rate-limit-keys ip --rate-limit-algo fixed_window --rate-limit-action log --yes
tile_firewall rules inspect "$tile_rule" --json
tile_firewall diff
```

## Bounded preview verification and enforcement

Use an isolated, owner-accessible preview and coordinate with other testers. Once the owner has reviewed production log data, stage a temporary **preview-host-only** threshold of three requests. Replace `YOUR-PREVIEW-HOST` with the exact hostname; keep both the environment and host conditions. Editing conditions replaces the whole condition list.

```sh
tile_firewall rules edit "$tile_rule" \
  --condition '{"type":"path","op":"pre","value":"/api/puzzles/"}' \
  --condition '{"type":"environment","op":"eq","value":"preview"}' \
  --condition '{"type":"host","op":"eq","value":"YOUR-PREVIEW-HOST"}' \
  --action rate_limit --rate-limit-algo fixed_window \
  --rate-limit-window 60 --rate-limit-requests 3 \
  --rate-limit-keys ip --rate-limit-action rate_limit --yes
tile_firewall rules inspect "$tile_rule" --json
tile_firewall diff
```

After owner publication, production no longer matches this single rule; its earlier logging does not continue while the rule is preview-only. Automatic DDoS protection remains available. In a fresh authorized browser context, make at most four manual GETs within one window from the same network: `/api/puzzles/today`, then `/api/puzzles/daily-v1-2026-09-29-44-3`, `/api/puzzles/daily-v2-2026-09-29-44-3`, and `/api/puzzles/daily-v3-2026-09-29-44-3`. Expect the first three to return `200` and the fourth `429`. Stop and inspect the rule, region, and window if results differ. Do not increase request volume. This is a bounded functional check, not a production load test.

Verify the rule ID and action in the Firewall dashboard. Confirm that static navigation remains accessible. After the window resets, check a normal game start and a saved-round restore, then confirm swaps make no API requests. Local tests below exercise cached fallback and first-visit errors without exhausting a deployed allowance. Do not run the 100-client local check against Vercel; follow [Vercel's load-testing policy](https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments).

Restore log-only observation across environments after the preview check:

```sh
tile_firewall rules edit "$tile_rule" \
  --condition '{"type":"path","op":"pre","value":"/api/puzzles/"}' \
  --action rate_limit --rate-limit-algo fixed_window \
  --rate-limit-window 60 --rate-limit-requests 1000 \
  --rate-limit-keys ip --rate-limit-action log --yes
tile_firewall rules inspect "$tile_rule" --json
tile_firewall diff
```

The owner publishes the restoration and confirms its active configuration. Production enforcement remains optional and pending owner review of shared-network traffic. To enable it later, retain the reviewed full path condition and threshold, change only `--rate-limit-action` to `rate_limit`, inspect the diff, and have the owner publish. Review the first 24 hours of traffic for legitimate players hitting the limit.

For rollback, restore the full log-only configuration above and publish it, or stage `tile_firewall rules disable "$tile_rule"`, inspect `tile_firewall diff`, and have the owner publish. Verify the active rule and a normal API response afterward. Disabling a custom rule does not require turning off system DDoS mitigation.

## Evidence and remaining checks

```sh
npm test -- src/features/puzzle/daily-puzzle-api.test.ts
npm run test:e2e -- e2e/puzzle-request-protection.spec.ts e2e/load-recovery.spec.ts e2e/historical-compatibility.spec.ts
```

Run the browser command against its configured local preview server. Unit tests show redirects and invalid requests avoid generation, preserve method/error precedence, and bound decoding. HTTP tests follow one redirect to unchanged v1/v2/v3 content and exercise 100 independent clients sharing a local network and forwarded IP. This proves application compatibility; Vite does not implement Vercel's WAF or CDN. Browser tests inject HTML `429` responses to verify dated fallback, saved progress/results, keyboard retry, and local swaps without retry loops.

Owner checks remain pending: active custom-rule inventory, free allowance availability, production log review, preview `429` enforcement, shared-network traffic review, and any later production enforcement. Record the date, project, rule ID, environment, threshold, response statuses, and observed actions before marking those checks verified. Keep local and deployed evidence separate. No live WAF enforcement or production capacity claim follows from local tests.
