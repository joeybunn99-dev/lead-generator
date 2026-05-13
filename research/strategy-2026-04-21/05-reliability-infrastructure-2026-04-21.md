# Reliability Infrastructure — 2026-04-21

## Why this exists

Today's brother-demo fizzle breaks down as three independent reliability failures that happened to land on the same day:
- **BunnUSBtest** shipped with a bug (Notepad first-run callout) that was only caught at the demo site itself.
- **Joshua** worker was down because the process died silently and nothing alerted.
- **BunnTranslator** mic was locked, then (after the Cirrus cycle) fed pure silence — no health telemetry surfaced the zero-signal state until after two hours of manual debugging.

Individually, each is a 2/10 severity bug. Collectively, they cost the credibility of the whole Saturday visit. **The risk isn't that individual products fail — it's that they fail in undetected combinations.** The fix is structural: every product gets (1) a pre-demo preflight, (2) a continuous heartbeat, and (3) a unified status surface that Joey checks in 30 seconds before any demo or customer call.

## Design principles

1. **One command, one answer.** `bunn-status` returns GREEN or a list of broken things. No interpretation needed.
2. **Preflight > reactive diagnosis.** Preflights are mandatory before any customer-facing event. Don't debug at the demo.
3. **Self-contained per product, aggregated globally.** Each product owns its own `/health` and `check-<x>.ps1`; `bunn-status` is just an aggregator. No one product's failure blocks checking the others.
4. **Fail loud, fail early.** Silent process death (Joshua worker gone without alert) is the number-one cause of "it was working yesterday." Heartbeat + alert rules.
5. **Test the things that actually broke.** Every post-incident, add a pre-flight check that would have caught it. Keeps the checklist grounded in real failures, not paranoia.

## The three layers

```
┌────────────────────────────────────────────────────────────────┐
│ Layer 3 — UNIFIED STATUS DASHBOARD                             │
│   bunn-status.js   →   single CLI, 30 sec, all products        │
│   outputs: GREEN / list of broken things                       │
├────────────────────────────────────────────────────────────────┤
│ Layer 2 — PER-PRODUCT PREFLIGHT + HEALTHCHECK                  │
│   BunnTranslator   →  /api/health (exists) + tools/check-mic   │
│   Joshua           →  worker liveness + LiveKit registration   │
│   BunnUSBtest      →  staging smoke-test (probe.ps1 on own PC) │
│   AdForge          →  ffmpeg present, Kie.ai balance, fal.ai   │
│   bunncom.com      →  HTTP 200 on critical pages, sitemap      │
│   Princeville      →  VPS :8080 reachable, DB intact           │
│   Bunn Transcribe  →  VPS :3850 reachable                      │
├────────────────────────────────────────────────────────────────┤
│ Layer 1 — CONTINUOUS HEARTBEAT (background)                    │
│   PM2 keep-alive on VPS services (already done)                │
│   bunn-status-watcher (NEW — polls every 5 min, logs SQLite)   │
│   Alert rules (email Joey when a service has been down 10min)  │
└────────────────────────────────────────────────────────────────┘
```

## What to build, in priority order

### Tier 1 — ship tonight (~1 hour)

**`bunn-status` CLI.** Single command that aggregates all existing healthchecks + runs quick probes against things that don't have a formal endpoint. Human-readable output, exit 0 on green / exit 1 on any red. See concrete build below.

**Per-product healthcheck endpoints where missing:**
- **Joshua** currently has no /health endpoint. Add one. Exposes: worker uptime, LiveKit registration status, last-call timestamp, active child-process count.
- **bunncom.com** has no formal /health. Add one that pings sitemap + returns 200.

### Tier 2 — ship next week

**Pre-demo runbook template (markdown).** Every demo gets a 10-item checklist Joey walks through the night before. Example:
```
[ ] bunn-status returns GREEN
[ ] Walk through the customer's #1 use case end-to-end on the real device
[ ] Back up demo data / environment to a clean state
[ ] Test recovery from expected failures (mic re-plug, restart, etc.)
[ ] Print one physical copy of the key URLs + phone numbers in case wifi fails
```
Save per-product at `<project>/docs/demo-preflight.md`.

**Continuous heartbeat watcher.** Runs every 5 min, logs to SQLite, alerts via email if any service has been red >10 minutes. Prevents silent death like today's Joshua worker.

**Smoke test per-product.** Automated single-command end-to-end test. For Joshua: simulate a SIP call via a test script, expect transcript. For BunnTranslator: POST a text translation via the text endpoint (if built), expect Spanish back. For BunnUSBtest: run `run.bat` on Joey's own PC before the USB goes anywhere.

### Tier 3 — ship eventually

**Proper CI.** Push to clarity-claire-test (or any feature branch) → run unit tests + smoke tests → only merge to main if green. GitHub Actions on the H&B Labs shared org OR local git hooks if Joey wants to stay off GitHub for customer repos.

**Real test coverage.** Joshua has zero tests; BunnTranslator has zero tests. This is fine at prototype stage, not fine at customer stage. When Joshua hits customer #1, any bug fix needs a regression test added before the fix ships.

**Status page.** `status.bunncom.com` showing green/red for each product. Public-facing: customers see uptime before they need to email you asking "is it down?"

## The rule of "every post-incident gets a preflight check"

Every time a Joshua / BunnTranslator / any-product failure gets diagnosed and fixed, the fix commit includes:
1. The code fix.
2. A preflight check in `tools/check-<thing>.ps1` (or similar) that would have caught this failure before a customer did.
3. A line added to the product's demo-preflight.md referencing the new check.

**Incidents from today that should become preflights:**
- LiveKit worker dies silently → Joshua /health endpoint + bunn-status ping for LiveKit registration (Tier 1).
- BunnTranslator Notepad-callout-steals-focus → already replaced with self-hosted TextBox, no recurrence possible.
- Windows Cirrus feeds zeros → already in `check-mic.ps1` (Tier 1 for BunnTranslator).
- Chrome per-site device cache goes stale → device enumeration already added to `public/app.js` (done).
- BunnUSBtest probe broke on Win11 UWP Notepad → already fixed (Notepad→TextBox), should add to build-usb.ps1 a "smoke test on local PC before shipping" step.

## Concrete build tonight

See `bunn-status.js` in `C:\Users\jlb2s\Documents\bunn-status\` (shipped alongside this doc).

It checks: BunnTranslator /api/health, Joshua worker liveness + LiveKit registration probe, bunncom.com HTTP 200 + sitemap reachable, Princeville VPS reachable, Bunn Transcribe VPS reachable, local mic health via the existing check-mic tool, AdForge Kie.ai credit balance.

Run:
```bash
node C:\Users\jlb2s\Documents\bunn-status\bunn-status.js
```

Returns in <30 seconds. If GREEN, safe to demo. If RED, the broken service is named + the recovery step is cited by reference to the right playbook / tool.

## The honest limits

- **No runbook can catch first-time unique failures.** The Chrome-per-site-device-cache bug was brand new to us today. A preflight caught after-the-fact prevents recurrence, but the first incident cost what it cost. Reduction in frequency, not elimination.
- **This infrastructure IS overhead.** Each product gets +5% maintenance burden. For a solo founder, that's a real tax. Justified because one failed demo day costs more than the aggregate tax over a month.
- **Testing customer-facing voice AI is genuinely hard.** You can't fully smoke-test Joshua without a real phone call. The smoke test is a proxy for "is the pipeline likely to work," not proof.

## Success metric

**Zero demos where Joey discovers a failure at the customer.** Every failure mode gets caught by bunn-status + preflight before it matters. Target is zero demos-broken in Q2 2026. One broken demo in 90 days is acceptable; two or more means the infrastructure is inadequate and a Tier 3 investment is warranted.

---

Next: the concrete build of `bunn-status.js`.
