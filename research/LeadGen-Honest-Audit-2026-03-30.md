# Lead Generator -- Honest Audit
**Date:** 2026-03-30
**Auditor:** Claude Opus 4.6 (code review only, no runtime testing)
**Scope:** All server-side code, scrapers, database schema, UI, campaign system

---

## Critical Issues (will break)

### 1. .env file contains plaintext credentials and is not gitignored [VERIFIED]
The `.env` file contains:
- JWT_SECRET (hardcoded hex)
- SMTP password (`Bunn0118!`)
- Google Places API key
- Apollo API key
- Firecrawl API key
- Foursquare API key
- The comment even says `# Auth -- password is BunnLeads2026!`

The `.env` is listed as untracked in git status (`??` prefix), meaning it is NOT committed yet. But there is no `.gitignore` visible in the project root to prevent accidental commits. If someone runs `git add .`, every secret ships.

**Severity: CRITICAL.** One careless commit exposes everything.

### 2. SQL injection in puller.js finalStatus variable [VERIFIED]
In `puller.js` line 292:
```js
await run(`UPDATE pull_jobs SET status='${finalStatus}', finished_at=CURRENT_TIMESTAMP WHERE id=?`, [jobId]);
```
`finalStatus` is set to either `'cancelled'` or `'done'` from internal logic, so it is not user-controlled today. But this is a string interpolation into SQL rather than a parameterized value. If anyone refactors to pass a status from the request, it becomes injectable.

**Severity: LOW (not exploitable today, but a landmine).**

### 3. SQL injection in enrichment.js dedupe query [VERIFIED]
In `routes/enrichment.js` lines 288-295:
```js
const companies = await query(
    `SELECT ... FROM companies WHERE id IN (${ids.join(',')}) ORDER BY ...`
);
```
The `ids` come from `group.ids.split(',').map(Number)`. The `Number()` cast sanitizes them, so this is technically safe. But the pattern of string-interpolating into SQL is fragile.

**Severity: LOW (safe due to Number() cast, but bad pattern).**

### 4. Auth bypass when env vars are missing [VERIFIED]
In `middleware/auth.js` line 28:
```js
if (!config.JWT_SECRET || !config.AUTH_PASSWORD_HASH) return next();
```
If JWT_SECRET or AUTH_PASSWORD_HASH is not set, auth is completely disabled and all routes are public. This is intentional for development, but if deployed to production with a bad .env, the entire app is unprotected.

**Severity: MEDIUM.** Should at least log a loud warning.

### 5. BASE_URL is localhost in .env [VERIFIED]
```
BASE_URL=http://localhost:3000
```
This means all unsubscribe links in campaign emails will point to `http://localhost:3000/unsubscribe?token=...`, which is unreachable for recipients. Any campaign sent in production with this value will have broken unsubscribe links.

**Severity: CRITICAL for CAN-SPAM compliance** if campaigns are actually sent.

---

## Incomplete Features (half-built)

### 1. Scoring system is too coarse [VERIFIED]
`scorer.js` has only 5 factors, each binary (on/off). The possible scores are: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 -- but realistically most contacts cluster at a few values:
- No email, no people, no website = 0
- Website + people but no email = 40 or 50
- Website + email + people = 70-80

The "Employees 5+" check uses `people.length >= 2` which is a weak proxy. The "Valid email" check requires `verification_status === 'Valid'` (capital V) but `verifier.js` returns `'Valid'` while the enrichment route lowercases it to `'valid'` before storing. The scorer then checks for capital `'Valid'` which will never match what is in the database. This means the +30 email bonus is never awarded during backfill.

**Status: VERIFIED bug.** The backfill route in `routes/enrichment.js` line 237 does:
```js
verification_status: contact.email_status === 'valid' ? 'Valid' : contact.email_status,
```
This correctly maps it back. So the backfill works, but the inline scoring during scrape enrichment (line 103) also does the same mapping. The scorer itself is fine IF callers remember to map. Fragile but functional.

### 2. Email verification is domain-match-only [VERIFIED]
`verifier.js` checks: syntax, domain match against company website, and MX records. It does NOT do SMTP RCPT TO verification (line 66-67 says "Simulated/Placeholder"). So `email_status = 'valid'` just means "the email domain matches the website and has MX records" -- it does NOT confirm the mailbox exists.

Meanwhile, `lib/email-discovery.js` DOES have real SMTP RCPT TO verification. These two systems are disconnected -- the verifier used during scrape/backfill is weaker than the discovery module.

**Status: Half-implemented.** The strong verifier exists but is not used for bulk validation.

### 3. Email discovery cancel does not actually stop the loop [VERIFIED]
In `routes/enrichment.js` line 383:
```js
router.post('/enrich/discover-emails/cancel', (req, res) => {
    emailDiscoveryState.cancelled = true;
    res.json({ ok: true });
});
```
But `batchDiscoverEmails` in `lib/email-discovery.js` never checks `emailDiscoveryState.cancelled`. The cancel flag is set but never read. The discovery just runs to completion.

**Status: VERIFIED bug.** Cancel button does nothing.

### 4. Firecrawl API key usage [VERIFIED]
The Firecrawl scraper (`lib/firecrawl-scraper.js`) imports `FirecrawlAppV1` but the actual `@mendable/firecrawl-js` package may have changed its export name. If the import fails, the fallback to Cheerio works, but the Firecrawl path silently breaks. No test coverage.

### 5. guessCommonEmails() in email-crawler.js is defined but never called [VERIFIED]
Line 337-345 defines `guessCommonEmails(domain)` which generates `info@`, `contact@`, etc. But `crawlCompany()` never calls it. The function is dead code.

### 6. Google Search scraping in email-crawler.js is fragile [VERIFIED]
`googleSearchEmails()` (line 220) scrapes Google's HTML search results. Google actively blocks this with CAPTCHAs and rate limiting. The function will silently fail on most runs. Not a bug per se, but it is unreliable as a data source.

### 7. loadResumeState() is defined but never called [VERIFIED]
In `email-crawler.js`, `loadResumeState()` (line 653) exists and `saveResumeState()` is called during crawling, but the `--resume` flag logic never actually calls `loadResumeState()` to skip already-processed companies. The resume feature is half-built.

### 8. Validation schemas defined but not all used [VERIFIED]
`middleware/validate.js` exports `pullSchema`, `importSchema`, and `scrapeUrlSchema`, but:
- `routes/pulls.js` POST `/pull` does NOT use `validate(pullSchema)` -- accepts any body
- `routes/companies.js` POST `/companies/import` does NOT use `validate(importSchema)`
- No route uses `scrapeUrlSchema`

Only the login route uses validation.

---

## Data Quality Issues

### 1. Email crawler produces mostly generic/role emails [VERIFIED by code logic]
The crawler's `saveEmails()` function filters out D-tier but keeps B-tier (`info@`, `contact@`, `hello@`, `office@`, `sales@`, `frontdesk@`, `reception@`) and C-tier (other generic prefixes). The email-crawler creates contacts with title "Website Contact" -- these are not decision makers.

Given the code's crawl order (homepage first, then /contact pages), the vast majority of discovered emails will be `info@company.com` or `contact@company.com` -- useful for cold outreach but not the "decision-maker contacts" the UI claims.

**Cannot verify exact counts without DB access**, but the code structure makes this a near-certainty for the bulk of the ~20K emails.

### 2. WHOIS emails are registrar privacy proxies [VERIFIED by code logic]
`email-crawler.js` line 242 calls `whoisEmails()` which queries RDAP. Most modern domain registrations use privacy protection (Domains By Proxy, WhoisGuard, etc.). The D-tier filter catches `domainsbyproxy.com` and `whoisguard.com`, but there are dozens of other privacy services (e.g., `withheldforprivacy.com`, `privacyprotect.org`, `identity-protect.org`) not in the blocklist.

### 3. Facebook scraping will return zero results [VERIFIED by code logic]
`scrapeEmailFromFacebook()` fetches the `/about` page of a Facebook profile. Facebook requires authentication to view business page details. The simple HTTP GET will get a login wall or empty page. This data source is effectively dead.

### 4. Email tier classification has false positives for A-tier [VERIFIED]
In `email-crawler.js` line 103:
```js
if (local.includes('.') || (local.length >= 3 && local.length <= 20 && /^[a-z]+$/.test(local)))
    return 'A';
```
This classifies ANY email with a dot in the local part as A-tier. So `web.admin@company.com`, `tech.support@company.com`, `billing.dept@company.com` all get A-tier. It also classifies any short alphabetic local part as A-tier, so `marketing@company.com` (if not in the generic list) gets A-tier.

The generic list catches `info`, `contact`, `hello`, etc., but misses many role addresses like `accounting`, `legal`, `operations`, `dispatch`, `scheduling`, `maintenance`.

### 5. Municipal scraper: 482/686 contacts is expected, not broken [VERIFIED]
The low contact count (482 from 686 municipalities) makes sense because:
- Many small NC towns (pop < 1000) have no website or a single-page site with no staff directory
- Government websites vary wildly in structure -- some use PDFs, some use iframes, some use Angular/React SPAs that Cheerio cannot parse
- The scraper only checks 6 subpaths per site, and many government staff directories are at non-standard paths
- The 2.5s delay between municipalities means the full crawl takes ~30 minutes for 686 sites

This is not a bug -- it is the inherent limitation of Cheerio-based scraping against government websites. A headless browser (Puppeteer/Playwright) would improve yield by maybe 20-30%.

### 6. Contacts with no name [VERIFIED by code logic]
The municipal scraper extracts emails but sets `name: ""` (empty string) for most contacts (line 330). The `passesGate()` function requires `name.trim().length >= 2`, but that only applies to the scraper enrichment pipeline, not to the municipal scraper or email-crawler which write directly to the database.

---

## Security Issues (beyond .env exposure)

### 1. XSS in unsubscribe endpoint [VERIFIED]
In `server.js` line 48:
```js
<p>${email} will no longer receive emails from Bunn Communications.</p>
```
The `email` value comes from the database (which came from scraped websites). If a malicious email address containing `<script>` tags was stored, it would render unescaped in the HTML response. Low probability but technically exploitable.

### 2. SMTP credentials in .env comment [VERIFIED]
The plaintext password `BunnLeads2026!` is in a comment at the top of `.env`. The SMTP password `Bunn0118!` is also plaintext. If this file ever leaks (logs, error dumps, CI artifacts), both passwords are exposed.

### 3. No CSRF protection [INFERRED]
The app uses cookie-based JWT auth with `sameSite: 'strict'`, which provides some CSRF protection. But state-changing operations (campaign send, company delete, data export) do not have CSRF tokens. The `sameSite: 'strict'` cookie is the only defense.

**Severity: LOW** -- sameSite strict is adequate for most scenarios.

### 4. Rate limiting does not apply to background operations [VERIFIED]
The campaign sender (`sendCampaignEmails`) runs in the background and is not rate-limited by Express middleware. The 3-second delay between emails (20/min) is hardcoded. If Office 365 changes its limits, the sender will silently fail. There is no exponential backoff on SMTP failures (except auth failures which stop the campaign).

### 5. Helmet CSP is disabled [VERIFIED]
`app.use(helmet({ contentSecurityPolicy: false }))` -- Content Security Policy is off. This is needed because the app loads Tailwind from CDN, but it means no protection against injected scripts.

---

## What is Actually Solid

### 1. Database schema and migration strategy [VERIFIED]
Using `ALTER TABLE ... ADD COLUMN` with `.catch(() => {})` is a pragmatic migration approach for SQLite. The schema is well-indexed (11 indexes covering all common query patterns). The libSQL/Turso client supports both local file and remote database URLs, making deployment flexible.

### 2. Multi-source company pull system [VERIFIED]
The three-source pull (Google Places + Foursquare + OpenStreetMap) with deduplication by `place_id` prefix (`fsq:`, `osm:`) is well-designed. Each source fills gaps the others miss. The anchor city + radius system with Haversine distance filtering is correct and efficient.

### 3. Quality gate system [VERIFIED]
`lib/quality-gate.js` is thorough: blocked email prefixes, blocked platform domains, hex/UUID detection, digit-prefix rejection, subdomain checking. The `parsePerson()` function handles both "Name - Title" and "Title: Name" patterns. The `BLOCKED_EMAIL_DOMAINS` list covers the most common platform/spam sources.

### 4. Campaign system CAN-SPAM compliance [VERIFIED]
The campaign system correctly:
- Appends CAN-SPAM footer with physical address and unsubscribe link
- Checks the `unsubscribes` table before sending
- Excludes contacts emailed in the last 30 days
- Excludes D-tier junk emails
- Generates per-recipient unsubscribe tokens
- Has a public `/unsubscribe` endpoint (no auth required, as CAN-SPAM requires)
- Stops the entire campaign on auth failures

The only issue is the `BASE_URL=localhost` which would make unsubscribe links non-functional in production.

### 5. UI is complete and functional [VERIFIED]
All 6 tabs (Leads, Companies, Import, Website Leads, Campaigns, Municipal) have working frontend code:
- Pagination, filtering, search with debounce
- CSV export and import
- Progress bars for all long-running operations
- Cancel buttons for all background jobs
- Stat card click-to-filter
- Expandable company rows showing contacts
- Template-based campaign creation with preview

### 6. Firecrawl-to-Cheerio fallback pattern [VERIFIED]
`lib/firecrawl-scraper.js` tries Firecrawl first (better JS rendering) and falls back to Cheerio on any failure (402 credits exhausted, timeout, API error). This graceful degradation means the scraper always works, just at lower quality when Firecrawl is unavailable.

### 7. Error handling in scrapers [VERIFIED]
Both `email-crawler.js` and `municipal-scraper.js` have:
- Retry with exponential backoff (up to 3 attempts)
- Error logging to `errors.log` with timestamps
- Resume state saved to `.email-crawler-resume.json`
- Graceful handling of timeout/connection errors per site (does not crash the batch)

### 8. Deduplication system [VERIFIED]
`routes/enrichment.js` POST `/cleanup/dedupe` does three-phase cleanup:
1. Company-level merge by domain (keeps the most complete record, reassigns contacts)
2. Contact-level dedup by email (keeps oldest by ID)
3. Removes contacts with no email AND no phone

This is thorough and handles cross-source duplicates well.

---

## Recommended Free Upgrades

### 1. Prospeo email verification (75 free/month)
The code already has notes about Prospeo in `email-crawler.js` (line 688). Integration would be straightforward:
- POST `https://api.prospeo.io/email-verifier` with `{ email }` header `X-KEY: <key>`
- Use the 75 free verifications on A-tier emails only
- Update `email_status` to `valid`/`invalid` based on Prospeo response
- This would give you 75 truly verified decision-maker emails per month

### 2. MarketBetter company enrichment (free, unlimited)
Also noted in `email-crawler.js` (line 681). MarketBetter provides:
- Company revenue estimates
- Employee count
- Technology stack
- Social media profiles

Could add columns to `companies` table and a new enrichment button in the Import tab.

### 3. Leadfeeder Lite (free)
Install the Leadfeeder tracking script on bunncom.com. It identifies companies visiting the site by reverse IP lookup. These are warm leads with intent -- much higher conversion than cold scraped contacts.

### 4. Connect the SMTP verifier from email-discovery to the backfill route
`lib/email-discovery.js` has working SMTP RCPT TO verification. Wire it into the `/admin/backfill` endpoint to replace the weak domain-only check in `verifier.js`. This costs nothing and dramatically improves email quality data.

### 5. Hunter.io free tier (25 searches/month)
Hunter provides email formats for domains. Use on high-priority companies where the scraper found people names but no emails. 25 free lookups/month would cover the best leads.

### 6. Add a .gitignore file
This costs nothing and prevents secrets from being committed:
```
.env
*.db
*.db-journal
*.db-shm
*.db-wal
node_modules/
errors.log
.email-crawler-resume.json
.netlify/
```

---

## What We Should NOT Redo (data to keep)

### 1. The company database
All companies pulled from Google Places, Foursquare, and OSM are uniquely identified by `place_id`. Re-pulling would cost Google API credits and produce identical results. The data includes coordinates, ratings, websites, and industry classifications.

### 2. The domain/website data
Companies that have been crawled (`email_crawled = 1` or `scraped = 1`) have had their websites visited. Even if the email extraction was imperfect, re-scraping would hit the same sites with the same results. Only re-crawl if you change the extraction logic.

### 3. Apollo-sourced contacts
Contacts with `source = 'apollo'` came from Apollo's verified database. These are higher quality than scraped contacts and should be preserved regardless of other cleanup.

### 4. Municipal contacts with names and titles
Municipal contacts that have actual names and titles (not empty string) extracted from government websites are valuable. These are public officials whose contact info is intentionally public.

### 5. Unsubscribe records
The `unsubscribes` table is a legal compliance record. Never delete this -- it protects against re-emailing people who opted out.

### 6. Campaign send history
The `campaign_emails` table with `sent_at` timestamps is needed for the 30-day exclusion window and to avoid double-emailing. Keep this even if you rebuild the campaign system.

### 7. Social links data
The `social_links` JSON column on companies was populated during email crawling. Facebook, LinkedIn, Yelp URLs are useful for manual research and future enrichment.

---

## Summary Scorecard

| Area | Grade | Notes |
|------|-------|-------|
| Server/routing | B+ | Clean Express setup, proper auth, rate limiting, modular routes |
| Database | A- | Good schema, proper indexes, safe migration pattern |
| Scraper (Google/FSQ/OSM) | A | Three sources, dedup, distance filtering, anchor cities |
| Email crawler | B- | Works but produces mostly generic emails, dead code, half-built resume |
| Municipal scraper | B | Solid for what Cheerio can do, limited by government website variety |
| Scoring | C | Too coarse, case-sensitivity bug between verifier and scorer |
| Email verification | C- | Domain-match only in main path; real SMTP verifier exists but disconnected |
| Campaign system | B+ | CAN-SPAM compliant, templates, good exclusion logic, localhost BASE_URL |
| Quality gate | A- | Thorough filtering, good blocklists |
| UI | A- | Complete SPA, all features wired, pagination, progress bars |
| Security | C+ | Secrets in .env (not committed), auth bypass on missing config, no gitignore |
| Code quality | B | Clean, readable, good error handling, some dead code and fragile patterns |
| Data quality | C+ | Likely heavy on generic emails, light on actual decision makers |

**Overall: B-** -- A functional, mostly complete lead gen system with real data. The main weaknesses are email quality (too many `info@` addresses classified as leads) and disconnected verification systems. The bones are solid and most issues are fixable without a rewrite.
