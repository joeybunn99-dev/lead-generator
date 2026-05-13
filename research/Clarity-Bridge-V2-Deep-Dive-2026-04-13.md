# Clarity Bridge v2 — Overnight Deep Dive

**Date:** 2026-04-13

## TL;DR

1. **Build Architecture A first (direct HTTP POST), keep Architecture B (Playwright) as auto-fallback in the same binary.** Payload capture is the prerequisite either way. Google's 2026 docs verbatim confirm reCAPTCHA over-quota returns `success:true, score:0.9` — so the cheap path is real, but don't depend on it forever.
2. **Ship Electron + React + shadcn/ui, not Tauri.** Tauri's "96% smaller" argument evaporates the moment Playwright downloads its own Chromium anyway. Electron plays cleanly with your existing Node/better-sqlite3 stack.
3. **Use Microsoft Trusted Signing ($9.99/mo), not an EV token.** Since March 2024 Microsoft stopped granting EV instant SmartScreen bypass. **WARNING:** late-March 2026 Azure incident migrated some Trusted Signing certs to new CA (AOC CA 03) and SmartScreen reputation did NOT carry over. Verify CA status before shipping.
4. **Transport: outbound WebSocket from Bridge to a tiny relay on your Hostinger VPS (wss://bridge.bunncom.com), not Cloudflare Tunnel.** You already run that VPS with nginx/PM2. Bridge is a client, not a server — no NAT problem. Cloudflare Tunnel is the fallback only for practices whose firewall blocks outbound 443 to arbitrary hosts.
5. **Both non-negotiables solvable:** Reliability = standard 2026 queue-first webhook pattern (verify→enqueue→2xx, exp backoff with jitter, DLQ, idempotency via SQLite UNIQUE(intent_id)). Futuristic UI = shadcn/ui dark-first + cmdk command palette + Linear violet-to-blue accent + Playfair headings. "Linear for appointments," not "AdvancedMD."

## Per-area findings and recommendations

### 1. Playwright resilience
Persistent context with `channel: 'chrome'` + `userDataDir` under `%LOCALAPPDATA%\ClarityBridge\browser-profile` is the correct primitive. Role-based locators only (`getByRole('textbox', { name: 'First Name' })`) — no CSS/XPath, which Solutionreach will break within 12 months. Enable `strictSelectors`. Never use fixed sleeps, only Playwright's auto-wait. Self-healing layer: each field has a primary and one fallback locator; snapshot the page and alert our cloud if both miss. Don't ship AI selector repair — just two locators per field and honest logging.

### 2. Solutionreach + reCAPTCHA under automation
Google's 2026 docs confirm: v3 over-quota = `success:true, score:0.9, error:"Over free quota"`; v2 shows the quota-exceeded widget string. Solutionreach uses only basic reCAPTCHA v2 invisible, no DataDome/Cloudflare-bot layer — `rebrowser-playwright` + real Chrome + persistent profile beats their fingerprint floor. `navigator.webdriver=true` is the cheapest detection signal and rebrowser-playwright patches it. **Do the controlled test submission ASAP.** Capture POST URL, headers, cookies, full JSON body, provider/slot ID format, behavior with blank/dummy `g-recaptcha-response`. This answer collapses 80% of remaining uncertainty.

### 3. Resilience patterns
Industry-standard 2026 webhook delivery: verify → enqueue → 2xx; work async; retry ladder with exponential backoff + jitter; non-retriable 4xx → immediate DLQ; retriable → retry N then DLQ. Idempotency at the DB layer (UNIQUE constraint), not app logic. Joshua assigns UUID v7 `intent_id` in the cloud. Bridge's SQLite UNIQUE(intent_id) makes double-insert a no-op. Retry ladder: 10s, 30s, 2m, 10m, 1h, then DLQ. DLQ surfaces as red badge in UI and emails joey@bunncom.com — never spam the practice. Staff-facing error copy in plain English.

### 4. Desktop shell
Tauri wins on bundle size (~10MB vs 100MB+), memory (~30MB vs 200-300MB), startup (<500ms vs 1-2s). But Tauri uses WebView2 on Windows while Playwright ships its own Chromium — you'd bundle two engines and still pay 100MB+. **Electron**: single compatible ecosystem, your Node/better-sqlite3 stack works as-is, `electron-builder` for NSIS + single-instance lock + autolaunch.

### 5. Auto-update
electron-updater against self-hosted `updates.bunncom.com/clarity-bridge/latest.yml` on your Hostinger VPS. Signed installers only. Staged rollouts later (10%→50%→100%) via multiple channels.

### 6. Cloud→PC transport
**Outbound wss:// from Bridge to relay on your Hostinger VPS (port 443, behind existing nginx).** Bridge is a WebSocket client; no inbound firewall problem. Auto-reconnect with exponential backoff, 15s keepalive ping. Joshua POSTs intent to relay; relay routes to right connected Bridge by `practice_id`; Bridge acks 2xx or queues offline. Cloudflare Tunnel only if a practice firewall blocks outbound 443 to arbitrary hosts. Polling rejected.

### 7. Local storage
`better-sqlite3-multiple-ciphers` (maintained fork) = same sync API + AES-256 via SQLCipher. Key derived from per-install secret via Windows DPAPI (`electron.safeStorage`). Tables: `appointments` (UNIQUE intent_id), `audit_log` (append-only), `submission_attempts` (retry tracking), `slots_cache` (short-TTL mirror of last-seen SR availability). Purge appointments >90 days; audit log >2 years.

### 8. Futuristic 2026 UI
State of the art (Linear/Arc/Raycast/Vercel/Warp): dark-first as the real design, monochrome + one saturated accent, subtle borders over shadows, glass/blur only on overlays, command palette (Cmd+K) first-class, keyboard-first with visible shortcuts, <200ms motion, no decorative animation. shadcn/ui is the 2026 default. Mantine if you want batteries-included hooks. **Recommendation: shadcn/ui on Radix, dark-first, violet-to-blue Linear accent, Playfair Display headings, Inter body, `cmdk` command palette with "New appointment / Retry failed / View today / Reload slots" actions. Status-pill cards with smooth height transitions. No teal, no stethoscope icons, no form-heavy layouts.**

### 9. Staff-friendliness
NN/G: confirmation dialogs become muscle-memory "Yes" within a week — use only for irreversible destructive actions. Undo is the right pattern for reversible ones. **Zero confirmations on normal ops. "Appointment sent" toast with 5s undo button (delay actual POST 5s; cancel if undone). Failures: "Solutionreach says this slot was just taken — pick a new one?" with inline picker. No red modals. No error codes.** Stack traces pipe silently to joey@bunncom.com.

### 10. Remote observability
For <20 fleet, skip OTel. Heartbeat every 60s to `https://updates.bunncom.com/health/<practice_id>` with `{version, uptime_s, last_submit_ok_at, queue_depth, error_count_24h, last_error_class}`. **Zero patient-identifying data ever leaves the PC.** If no heartbeat in 5 min → SMS Joey via Twilio. Green/yellow/red dashboard on VPS.

### 11. Code signing
EV no longer = instant SmartScreen trust (changed March 2024). Both OV and EV now build reputation organically. **Microsoft Trusted Signing Basic ($9.99/mo)** is the 2026 winner — cloud-signed, no hardware token. Budget 2-4 weeks for SmartScreen reputation from zero. **Critical: verify your Trusted Signing cert's CA against the late-March 2026 AOC CA 03 migration incident before shipping.** Fallback: SSL.com OV (~$125/yr, 3-yr prepay) + YubiKey FIPS.

### 12. Solutionreach ToS 2026 re-check
Confirmed: **no specific prohibition on automation, bots, scripts, scraping, or programmatic form submission.** Only general clause about not "interfering with the Services." At voice-AI volume (dozens/day), we're indistinguishable from a fast-typing receptionist. **Self-impose max 1 submission per 10 seconds per subscriber ID. Submit from practice IP. Accurate data only. Document the rate cap in POLICY.md as good-faith self-governance.**

### 12b. BONUS FINDING: Solutionreach has an API — "SR Enable"
`solutionreach.com/api` confirms a patient engagement + appointment reminder API exists; third-party reference names "SR Enable patient scheduling API" positioned for "hospitals, large medical systems, and EHR companies" — their 400+ integrations run over it. No self-service; sales-gated at 1-866-305-1076. **Action: email Solutionreach partnerships in parallel with building** — "We build AI phone agents for SMBs. When a caller books, we deliver the intent into your scheduler. More bookings for your customers → lower churn for you. Can we talk about API access?" Worst case they say no; best case Bridge never needs Playwright.

### 13. RPA failure modes
Honest signals: RPA breaks on (a) vendor UI changes, (b) unanticipated edge-case form states, (c) silent auth expirations, (d) rate-limit-induced partial failures retried into duplicates. All four handled by the idempotency + DLQ + selector-resilience + staff-surfaced-errors model above. **Pre-commit to: (a) POLICY.md stating Bridge fails loudly not silently, (b) weekly synthetic test submission into a Bunn test account if we can get one, (c) staff can always book manually in SR's normal UI — Bridge is an accelerator, not a dependency.**

## Recommended tech stack

| Layer | Pick | Why |
|---|---|---|
| Desktop shell | Electron 34+ | Plays with Playwright/Node; size argument moot when bundling Chromium anyway |
| UI | React 19 + TypeScript | shadcn target, industry default |
| Components | shadcn/ui on Radix | 2026 aesthetic default, cmdk command palette |
| Type | Playfair Display + Inter | Bunn design system continuity |
| Automation | rebrowser-playwright + `channel:'chrome'` + persistent userDataDir | Stealth-patched fork, real Chrome, trust build-up |
| DB | better-sqlite3-multiple-ciphers (AES-256) | Sync API, encrypted, Electron-Windows friendly |
| Key storage | electron.safeStorage (DPAPI) | OS-native, no hand-rolled crypto |
| Transport | Outbound WSS to bunncom VPS relay | One less dependency; VPS already exists |
| Updater | electron-updater → updates.bunncom.com | Battle-tested, self-hosted |
| Signing | Microsoft Trusted Signing Basic ($9.99/mo) | Cheapest legit path; verify CA status first |
| Installer | NSIS via electron-builder | Windows-native, autolaunch/uninstall handled |
| Queue | SQLite UNIQUE(intent_id) + retry_table + DLQ view | No Redis needed at this scale |
| Observability | 60s heartbeat + SMS alert on 5min silence | OTel overkill for <20 fleet |

## Build order

**Day 1 (tomorrow):** (a) Email Solutionreach partnerships re: SR Enable API. (b) Controlled form submission with fake data from headed Playwright; capture full payload/headers/recaptcha behavior. (c) Based on capture, pick Architecture A or A-with-B-fallback.

**Day 2-3 — scaffolding:** New repo `C:\Users\jlb2s\Documents\Clarity-Bridge\`. Electron-builder + React/TS/shadcn/Tailwind + dark violet theme + Playfair/Inter + cmdk with fake commands. better-sqlite3-multiple-ciphers wired, DPAPI key, schemas. Tray icon, autolaunch, single-instance lock.

**Day 4-5 — the work:** `submitAppointment(intent)` with validate → UNIQUE insert → A/B branch → attempt record → status update. Full retry ladder. DLQ surfacing. Playwright B module with self-healing locators. 20 end-to-end dev submissions.

**Day 6-7 — transport:** Node WS relay on bunncom VPS (`wss://bridge.bunncom.com`), PM2-managed, per-practice shared secret auth. Bridge WS client with auto-reconnect + 15s ping. Heartbeat endpoint. Joshua side: outbound hook POSTing intent after call ends, UUID v7 intent_id.

**Day 8-10 — polish and sign:** 5s-undo toasts. DLQ UI. Staff-friendly copy. Trusted Signing signup under Bunn, sign test builds, verify against AOC CA 03 incident. electron-updater endpoint. NSIS installer, per-user install. Smoke test on Joey's PC for 1 week before any customer.

**Week 3 — first customer (Clarity Smithfield):** In-person install. Persistent browser logged into SR as Clarity front-desk. First 10 submissions in "staff approves before Joshua commits" learning mode. Weekly synthetic test. 30 days incident-free → full auto.

## Open questions to ask Joey before building

1. Who owns the Solutionreach login Bridge's persistent browser signs into — Clarity's actual front-desk account or a dedicated "automation" user?
2. How is Joshua currently structuring appointment intents — datetime objects or human strings like "next Tuesday afternoon"? Bridge needs a concrete contract.
3. Smithfield + Apex day 1, or Smithfield first? Affects whether multi-tenant routing is day-1 or day-10 work.
4. Show browser window minimized or fully hidden? Chrome flashing on staff's screen mid-workflow might spook them.
5. Confirming: Bridge never writes to Compulink directly even if SR is down? (Yesterday's locked-in decision says no.)
6. Budget for Trusted Signing + Azure sub + `updates.bunncom.com` / `bridge.bunncom.com` subdomains?
7. Backup contact for "Bridge is dead at 2am" SMS if Joey is traveling?

## Opinion vs verified

**Verified (cited):** reCAPTCHA over-quota behavior, Solutionreach ToS text, Electron/Tauri size numbers, Trusted Signing cost + CA incident, SmartScreen EV-no-longer-instant, shadcn default status, Cloudflare Tunnel WS support, SR Enable API exists.

**Opinion (my synthesis, defensible):** Electron over Tauri for this specific bundle-Playwright case, outbound-WS-over-Cloudflare-Tunnel, skip-OTel-for-MVP, 5-second undo, AI-repair-is-overkill.

**Known unknown:** Whether Solutionreach's scheduling endpoint accepts a blank `g-recaptcha-response`. **The single controlled test submission answers this and collapses the uncertainty. Do this first.**

## Sources

Solutionreach: [ToS](https://www.solutionreach.com/terms-of-service) · [API page](https://www.solutionreach.com/api)
Playwright: [BrowserType](https://playwright.dev/docs/api/class-browsertype) · [BrowserStack persistent context](https://www.browserstack.com/guide/playwright-persistent-context) · [TestDino resilience](https://testdino.com/blog/playwright-automation-checklist/) · [AlterLab 2026 stealth](https://alterlab.io/blog/playwright-anti-bot-detection-what-actually-works-in-2026) · [Dicloak stealth 2026](https://dicloak.com/blog-detail/playwright-stealth-what-works-in-2026-and-where-it-falls-short)
reCAPTCHA: [Google FAQ](https://developers.google.com/recaptcha/docs/faq) · [Cloud quotas](https://docs.cloud.google.com/recaptcha/quotas)
Shell: [DoltHub](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) · [Tech-Insider 2026](https://tech-insider.org/tauri-vs-electron-2026/) · [Hopp](https://www.gethopp.app/blog/tauri-vs-electron) · [DEV.to Electron 2026](https://dev.to/raxxostudios/how-to-build-and-distribute-an-electron-desktop-app-in-2026-24nk)
Transport: [CF WebSockets](https://developers.cloudflare.com/network/websockets/) · [CF Tunnels FAQ](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/)
Signing: [Azure Artifact Signing](https://azure.microsoft.com/en-us/products/artifact-signing) · [AOC CA 03 incident](https://github.com/Azure/artifact-signing-action/issues/128) · [SSL.com OV vs EV](https://www.ssl.com/faqs/which-code-signing-certificate-do-i-need-ev-ov/) · [MS Q&A SmartScreen](https://learn.microsoft.com/en-us/answers/questions/417016/reputation-with-ov-certificates-and-are-ev-certifi)
UI: [PkgPulse shadcn vs Base vs Radix 2026](https://www.pkgpulse.com/blog/shadcn-ui-vs-base-ui-vs-radix-components-2026) · [Untitled UI 2026](https://www.untitledui.com/blog/react-component-libraries) · [DEV.to Raycast 2026](https://dev.to/dharanidharan_d_tech/raycast-in-2026-the-mac-launcher-that-replaced-4-apps-in-my-dev-workflow-3pka)
Storage: [better-sqlite3-multiple-ciphers](https://github.com/m4heshd/better-sqlite3-multiple-ciphers) · [OneUptime SQLCipher](https://oneuptime.com/blog/post/2026-02-02-sqlcipher-encryption/view)
Resilience: [Hookdeck retry](https://hookdeck.com/outpost/guides/outbound-webhook-retry-best-practices) · [Hookdeck idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency)
UX: [NN/G confirm dialogs](https://www.nngroup.com/articles/confirmation-dialog/) · [LogRocket reversible actions](https://blog.logrocket.com/ux-design/ux-reversible-actions-framework/) · [Smashing error UX](https://www.smashingmagazine.com/2022/08/error-messages-ux-design/)
Observability: [Coralogix+Skyflow](https://www.businesswire.com/news/home/20260320221562/en/Coralogix-and-Skyflow-Redefine-Privacy-Safe-Observability-for-the-AI-Era) · [Uptrace OTel 2026](https://uptrace.dev/blog/opentelemetry-ai-systems)
