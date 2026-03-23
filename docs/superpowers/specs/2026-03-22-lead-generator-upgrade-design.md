# Lead Generator Power Upgrade — Design Spec

**Date**: 2026-03-22
**Approach**: C — Power Upgrade (keep Express+SQLite, upgrade every layer)
**Current state**: 22,227 companies, 558 contacts (264 with email), ~1,000 lines of app code

---

## 1. Security Overhaul

### Config Hardening
- Remove all hardcoded API key fallbacks from `config.js`
- Keys come from `.env` only; missing key = feature disabled
- Add `FIRECRAWL_API_KEY`, `JWT_SECRET`, `AUTH_PASSWORD_HASH` to config
- Create proper `.env.example` with all required variables

### Authentication
- Replace client-side `admin/password` with server-side JWT + bcrypt
- `POST /api/login` — validates credentials, returns JWT in httpOnly cookie
- `middleware/auth.js` — verifies JWT on all `/api/*` routes except `/api/login` and `/api/health`
- Rate limit login: 5 attempts per 15 minutes via `express-rate-limit`
- Password hash stored in `AUTH_PASSWORD_HASH` env var (generated with bcrypt)

### Input Validation
- Add `zod` schemas for all POST/PUT request bodies
- `middleware/validate.js` — generic validation middleware
- Reject malformed requests with 400 + descriptive error

### Rate Limiting
- Global: 100 requests/min per IP
- Scrape/enrich endpoints: 10 requests/min
- Pull endpoints: 5 requests/min

### Dependencies Added
- `bcryptjs` (pure JS, no native build)
- `jsonwebtoken`
- `zod`
- `express-rate-limit`

---

## 2. Scraping & Enrichment Pipeline

### Firecrawl Integration (`lib/firecrawl-scraper.js`)
- Primary scraper replacing Cheerio for website contact extraction
- `scrapeWithFirecrawl(url)` → clean markdown + metadata via Firecrawl API
- AI Extract mode: returns `{emails[], phones[], people: [{name, title}], address, services[]}`
- Graceful fallback to existing Cheerio scraper (`scraper.js`) if:
  - Firecrawl API key missing
  - Credits exhausted (402 response)
  - API error
- Used in bulk enrichment pipeline AND new URL-to-Leads one-off feature

### Email Verification (wire in existing `verifier.js`)
- Called after scraping/Apollo finds an email
- `validateEmail(email, websiteUrl)` performs:
  - Syntax check
  - Domain match against company website
  - Free provider detection
  - Role-address detection (info@, sales@, etc.)
  - MX record lookup via DNS
- Results stored in `contacts.email_status`: 'valid', 'invalid', 'risky'
- Replaces current default of 'unverified'

### Lead Scoring (wire in existing `scorer.js`)
- New `lead_score` column on `contacts` table (INTEGER DEFAULT 0)
- Scoring formula (0-100):
  - Website present: +10
  - Valid email (domain match + MX): +30
  - Decision maker title: +30
  - Google rating >= 4.0: +20
  - Multiple contacts at company: +10
- Recalculated after each enrichment pass
- Exposed in API responses and UI

### Cross-Source Deduplication
- Run before enrichment, after pulling from multiple sources
- Primary match: normalized `domain` (strip www, trailing slash)
- Secondary match: fuzzy `name` + exact `city` (for companies without websites)
- Merge strategy: keep earliest record, merge in missing fields from duplicates
- Delete duplicate company records, reassign contacts to survivor

---

## 3. Architecture & Code Structure

### Route Decomposition
Split `routes/leads.js` (710 lines) into:

| File | Endpoints | Lines (est.) |
|------|-----------|-------------|
| `routes/contacts.js` | GET/PUT contacts, export CSV, mark contacted | ~120 |
| `routes/companies.js` | GET/DELETE companies, expand contacts, import CSV | ~100 |
| `routes/pulls.js` | POST/GET/cancel for Google, Foursquare, OSM pulls | ~150 |
| `routes/enrichment.js` | Scrape, Apollo, Firecrawl, verify, score | ~150 |
| `routes/exports.js` | CSV, Google Sheets, PDF report generation | ~80 |
| `middleware/auth.js` | JWT verification, rate limiting setup | ~50 |
| `middleware/validate.js` | Zod schema validation middleware | ~30 |

Each route file exports an Express Router, mounted in `server.js`.

### Structured Logging (`pino`)
- Replace all `console.log/error` with Pino logger
- `lib/logger.js` — configured Pino instance
- Request/response logging via `pino-http` middleware
- Log levels: info (normal ops), warn (degraded), error (failures)
- Enrichment pipeline logs with structured context (company name, url, duration)

### Job Manager (`lib/job-manager.js`)
- Replaces global `scrapeState` / `apolloState` mutable objects
- Each job gets unique ID, type, progress tracking, cancellation token
- Prevents concurrent jobs of same type from stomping each other
- SSE endpoint `GET /api/jobs/:id/stream` for real-time progress
- Job states: pending, running, completed, failed, cancelled

### Database Improvements
- New indexes:
  - `idx_companies_domain ON companies(domain)`
  - `idx_contacts_email ON contacts(email)`
  - `idx_contacts_contacted ON contacts(contacted)`
  - `idx_contacts_email_status ON contacts(email_status)`
  - `idx_contacts_lead_score ON contacts(lead_score)`
- New columns:
  - `contacts.lead_score INTEGER DEFAULT 0`
  - `companies.firecrawl_scraped INTEGER DEFAULT 0`
- Transaction wrapper: `database.js` gets `transaction(fn)` method
- Batch insert helper for bulk operations

### Dependencies Added
- `pino` + `pino-http`

---

## 4. Frontend Modernization

### Visual Overhaul
- Tailwind CSS via CDN (same approach as AdForge)
- Dark mode with glass panels, gradient accents
- Replace 100-line inline CSS block
- Professional, modern aesthetic matching AdForge

### Enhanced Dashboard Stats
- Richer stats cards at top of Leads tab:
  - Total contacts, with email, with phone, verified emails, avg lead score
  - Industry breakdown with color bars
  - Enrichment coverage percentage

### Lead Score in UI
- New column in leads table with color-coded badges:
  - 80-100: green badge (hot)
  - 50-79: yellow badge (warm)
  - 0-49: gray badge (cold)
- Sortable — click to sort by score descending
- Filterable — "Hot Leads Only" checkbox

### Email Verification Badges
- Inline in email column:
  - Green checkmark: valid
  - Yellow warning: risky
  - Red X: invalid
  - Gray dash: unverified

### URL-to-Leads Feature
- New card on Import tab
- Text input for business URL
- "Scrape with AI" button → Firecrawl extracts everything
- Preview panel shows extracted: company name, contacts, emails, phones, services
- "Add to Database" button saves to companies + contacts

### Real-time Progress (SSE)
- Replace `setInterval` polling with Server-Sent Events
- `GET /api/jobs/:id/stream` pushes progress updates
- Instant progress bar updates, no 2-second delay
- Auto-closes when job completes

### PDF Report Export
- Wire in existing `generate-pdf.js`
- "Export PDF" button on Leads tab
- Report includes: logo, date, stats summary, filtered leads table
- Downloads in browser via blob URL

---

## File Structure (After Upgrade)

```
Lead Generator/
  server.js                  — Entry point (slimmed down)
  config.js                  — Env-only config (no fallback keys)
  database.js                — DB init, queries, transactions
  .env                       — All secrets (not in source)
  .env.example               — Template with all variables
  middleware/
    auth.js                  — JWT + rate limiting
    validate.js              — Zod schemas
  routes/
    contacts.js              — Contact CRUD + CSV export
    companies.js             — Company CRUD + CSV import
    pulls.js                 — Google/Foursquare/OSM data pulls
    enrichment.js            — Scrape + Apollo + Firecrawl + verify + score
    exports.js               — CSV, Sheets, PDF
  lib/
    firecrawl-scraper.js     — Firecrawl AI scraping (NEW)
    job-manager.js           — Background job tracking (NEW)
    logger.js                — Pino logger (NEW)
  scraper.js                 — Cheerio scraper (kept as fallback)
  enricher.js                — Apollo.io (kept)
  scorer.js                  — Lead scoring (wired in)
  verifier.js                — Email verification (wired in)
  generate-pdf.js            — PDF reports (wired in)
  puller.js                  — Data source pulls (kept)
  public/
    index.html               — Tailwind dark mode UI
    app.js                   — Frontend logic (modernized)
```

---

## Data Migration Strategy

### Schema Migration
- `ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0` — safe, existing rows get 0
- `ALTER TABLE companies ADD COLUMN firecrawl_scraped INTEGER DEFAULT 0` — safe, existing rows get 0
- `contacts.email_status` column already exists (DEFAULT 'unverified') — no migration needed

### Backfill (Phase 2.5)
- After schema changes, run a one-time backfill:
  - Score all 558 existing contacts using `scorer.js`
  - Optionally verify all 264 existing emails via MX check (batch, with rate limiting)
  - Update `email_status` from 'unverified' to 'valid'/'invalid'/'risky'
- Backfill exposed as `POST /api/admin/backfill` endpoint (auth required)

### Cross-Source Dedup Rules
- Match: normalized domain (primary), fuzzy name + exact city (secondary)
- Winner: record with most populated fields; ties broken by earliest `created_at`
- Contact-level dedup: same email = same contact (keep one, reassign to survivor company)
- Runs: on-demand via UI button (like existing dedupe), NOT automatically on every pull

---

## Auth Bootstrap

### First-Run Setup
- `npm run setup` — interactive CLI that prompts for username + password
- Generates bcrypt hash, writes `AUTH_PASSWORD_HASH` and `JWT_SECRET` (random 64-char hex) to `.env`
- If `.env` already has these values, skips with a message
- If app starts without `AUTH_PASSWORD_HASH`, falls back to legacy client-side auth with a console warning

### JWT Configuration
- Token expiration: 24 hours
- No refresh tokens (internal tool — just re-login)
- `POST /api/logout` clears the httpOnly cookie
- Cookie flags: `httpOnly`, `sameSite: strict`, `secure` when behind HTTPS

---

## SSE Lifecycle

- `GET /api/jobs/:id/stream` — SSE endpoint
- If job already completed: sends final state event immediately, then closes
- On client disconnect + reconnect: sends current state (no replay of missed events)
- `GET /api/jobs/:id` — non-streaming fallback for polling (returns current job state as JSON)
- Max concurrent SSE connections: not limited (internal tool, single user)

---

## Rate Limiting Details

- Static files (`/public/*`) are exempted from rate limiting
- Rate limiter uses `X-Forwarded-For` header when behind nginx (`trustProxy: true`)
- Global: 100 req/min per IP (API routes only)
- Scrape/enrich: 10 req/min
- Login: 5 attempts per 15 min

---

## PDF Generation

- Uses existing `generate-pdf.js` which depends on `pdfkit` (already in package.json)
- No Puppeteer or headless browser needed — pure Node.js PDF generation
- ~12KB of existing code, just needs an endpoint to call it

---

## Google Sheets Export

- Already implemented via n8n webhook push (existing code in routes/leads.js)
- No OAuth needed — n8n handles the Google Sheets API via its own credentials
- Just move existing code into `routes/exports.js` as-is

---

## Implementation Order

1. Security (config, auth, validation, rate limiting)
2. Database (new columns, indexes, transactions, backfill)
3. Architecture (split routes, logging, job manager)
4. Scraping pipeline (Firecrawl, verification, scoring, dedup)
5. Frontend (Tailwind, dark mode, scores, badges, URL-to-leads, SSE, PDF)

Each phase is independently deployable — the app works after every phase.
