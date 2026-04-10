# Lead Generator

B2B lead generation tool for NC businesses. Express + SQLite + Tailwind.

## Commands
- `node server.js` — start on port 3000
- `node email-crawler.js --limit N` — crawl N companies for emails
- `node score-emails.js` — score all emails A/B/C/D
- `node municipal-scraper.js` — scrape NC municipal websites

## Architecture
- `server.js` — Express entry, mounts all routes
- `routes/` — modular: companies, contacts, enrichment, campaigns, exports, pulls, municipal
- `database.js` — SQLite via `@libsql/client` (Turso-compatible), `leads.db`
- `public/` — single-page app (`index.html` + `app.js`)
- `scraper.js` — Cheerio-based web scraper
- `lib/email-discovery.js` — SMTP email discovery

## Data
- 20,167 companies in leads.db
- 18,511 clean emails, fully crawled
- Proximity sorted: closest to Bunn, NC first

## Rules
- Use conventional commits
- Keep routes modular — one file per domain
- SQLite queries use `@libsql/client` async API (`query`, `queryOne`, `run` from `./database`)
- Email crawler respects rate limits (2s delay between requests)
