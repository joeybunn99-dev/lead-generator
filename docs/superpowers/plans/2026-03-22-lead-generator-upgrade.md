# Lead Generator Power Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Lead Generator from a basic scraper into a production-grade, secure, AI-powered lead generation platform with Firecrawl integration, email verification, lead scoring, and a modern Tailwind dark-mode UI.

**Architecture:** Keep Express + SQLite foundation. Add JWT auth layer, split monolithic routes into focused modules, replace Cheerio scraping with Firecrawl (Cheerio fallback), wire in unused scorer/verifier/PDF modules, modernize frontend with Tailwind.

**Tech Stack:** Node.js, Express, SQLite (LibSQL/Turso), Firecrawl, bcryptjs, jsonwebtoken, zod, express-rate-limit, pino, Tailwind CSS CDN

**Spec:** `docs/superpowers/specs/2026-03-22-lead-generator-upgrade-design.md`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install security + logging packages**

```bash
cd "c:\Users\jlb2s\Documents\Lead Generator"
npm install bcryptjs jsonwebtoken zod express-rate-limit pino pino-http
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('bcryptjs'); require('jsonwebtoken'); require('zod'); require('express-rate-limit'); require('pino'); console.log('All deps OK')"
```

Expected: `All deps OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add security, validation, and logging dependencies"
```

---

## Task 2: Harden Config — Remove Hardcoded API Keys

**Files:**
- Modify: `config.js`
- Create: `.env.example`

- [ ] **Step 1: Rewrite config.js to env-only (no fallbacks)**

```javascript
// config.js
module.exports = {
    // API Keys — MUST be set in .env, no fallbacks
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',
    APOLLO_API_KEY:        process.env.APOLLO_API_KEY        || '',
    FOURSQUARE_API_KEY:    process.env.FOURSQUARE_API_KEY    || '',
    FIRECRAWL_API_KEY:     process.env.FIRECRAWL_API_KEY     || '',
    N8N_WEBHOOK_URL:       process.env.N8N_WEBHOOK_URL       || '',
    BUNNCOMM_API:          process.env.BUNNCOMM_API          || 'http://localhost:3500',

    // Auth
    JWT_SECRET:            process.env.JWT_SECRET            || '',
    AUTH_PASSWORD_HASH:    process.env.AUTH_PASSWORD_HASH     || '',
    AUTH_USERNAME:         process.env.AUTH_USERNAME           || 'admin',

    // Database
    TURSO_DATABASE_URL:    process.env.TURSO_DATABASE_URL    || '',
    TURSO_AUTH_TOKEN:      process.env.TURSO_AUTH_TOKEN       || '',

    PORT:                  process.env.PORT                   || 3000,
};
```

- [ ] **Step 2: Create .env.example**

```
# Lead Generator Environment Variables
# Copy to .env and fill in values

# Google Places API
GOOGLE_PLACES_API_KEY=

# Apollo.io Enrichment
APOLLO_API_KEY=

# Foursquare Places
FOURSQUARE_API_KEY=

# Firecrawl AI Scraping
FIRECRAWL_API_KEY=

# n8n Google Sheets Webhook
N8N_WEBHOOK_URL=

# Auth (run: npm run setup)
JWT_SECRET=
AUTH_PASSWORD_HASH=
AUTH_USERNAME=admin

# Database (optional — defaults to local SQLite)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

PORT=3000
```

- [ ] **Step 3: Create .env with actual keys from old config**

Move the hardcoded keys from old config.js into the `.env` file. Ensure `.env` is in `.gitignore`.

- [ ] **Step 4: Add .env to .gitignore if not already**

```bash
echo ".env" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add config.js .env.example .gitignore
git commit -m "security: remove hardcoded API keys, use env-only config"
```

---

## Task 3: Auth Middleware — JWT + bcrypt

**Files:**
- Create: `middleware/auth.js`
- Create: `setup.js`
- Modify: `package.json` (add setup script)

- [ ] **Step 1: Create middleware/auth.js**

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { JWT_SECRET, AUTH_PASSWORD_HASH, AUTH_USERNAME } = require('../config');

// Rate limiter for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts, try again in 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for API routes (global)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for heavy endpoints (scrape/enrich/pull)
const heavyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Rate limit exceeded for this endpoint' },
});

// JWT auth middleware
function requireAuth(req, res, next) {
    // Skip if auth not configured (legacy fallback)
    if (!JWT_SECRET || !AUTH_PASSWORD_HASH) return next();

    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Login handler
async function handleLogin(req, res) {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    // Legacy fallback if auth not configured
    if (!AUTH_PASSWORD_HASH || !JWT_SECRET) {
        if (username === 'admin' && password === 'password') {
            return res.json({ ok: true, legacy: true });
        }
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (username !== AUTH_USERNAME) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, AUTH_PASSWORD_HASH);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
}

// Logout handler
function handleLogout(req, res) {
    res.clearCookie('token');
    res.json({ ok: true });
}

module.exports = { requireAuth, handleLogin, handleLogout, loginLimiter, apiLimiter, heavyLimiter };
```

- [ ] **Step 2: Create setup.js (auth bootstrap CLI)**

```javascript
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_PATH = path.join(__dirname, '.env');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

(async () => {
    console.log('\n=== Lead Generator Setup ===\n');

    // Check if already configured
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf8');
        if (envContent.includes('AUTH_PASSWORD_HASH=') && !envContent.match(/AUTH_PASSWORD_HASH=\s*$/m)) {
            console.log('Auth already configured in .env. Delete AUTH_PASSWORD_HASH line to reconfigure.');
            rl.close();
            return;
        }
    }

    const username = await ask('Username (default: admin): ') || 'admin';
    const password = await ask('Password: ');
    if (!password || password.length < 6) {
        console.log('Password must be at least 6 characters.');
        rl.close();
        return;
    }

    const hash = await bcrypt.hash(password, 12);
    const secret = crypto.randomBytes(32).toString('hex');

    // Append to .env
    const lines = [
        '',
        '# Auth (generated by setup.js)',
        `AUTH_USERNAME=${username}`,
        `AUTH_PASSWORD_HASH=${hash}`,
        `JWT_SECRET=${secret}`,
    ];

    fs.appendFileSync(ENV_PATH, lines.join('\n') + '\n');
    console.log(`\nAuth configured for user "${username}".`);
    console.log('JWT secret generated and saved to .env');
    rl.close();
})();
```

- [ ] **Step 3: Add setup script to package.json**

Add to scripts: `"setup": "node setup.js"`

- [ ] **Step 4: Commit**

```bash
git add middleware/auth.js setup.js package.json
git commit -m "feat: add JWT auth middleware, bcrypt login, rate limiting, setup CLI"
```

---

## Task 4: Input Validation Middleware

**Files:**
- Create: `middleware/validate.js`

- [ ] **Step 1: Create Zod validation middleware**

```javascript
const { z } = require('zod');

// Generic middleware factory
function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
            });
        }
        req.validated = result.data;
        next();
    };
}

// Schemas
const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

const pullSchema = z.object({
    industries: z.array(z.string()).min(1),
    radius: z.number().min(10).max(500).default(300),
});

const importSchema = z.array(z.object({
    name: z.string().min(1),
    city: z.string().optional(),
    state: z.string().optional(),
    industry: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
}));

const scrapeUrlSchema = z.object({
    url: z.string().url(),
});

module.exports = { validate, loginSchema, pullSchema, importSchema, scrapeUrlSchema };
```

- [ ] **Step 2: Commit**

```bash
git add middleware/validate.js
git commit -m "feat: add Zod input validation middleware with schemas"
```

---

## Task 5: Structured Logging with Pino

**Files:**
- Create: `lib/logger.js`

- [ ] **Step 1: Create Pino logger**

```javascript
const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino/file',
        options: { destination: 1 }, // stdout
    } : undefined,
    formatters: {
        level(label) { return { level: label }; },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
```

- [ ] **Step 2: Commit**

```bash
git add lib/logger.js
git commit -m "feat: add Pino structured logging"
```

---

## Task 6: Database Upgrades — New Columns, Indexes, Transactions

**Files:**
- Modify: `database.js`

- [ ] **Step 1: Add new columns, indexes, and transaction support to database.js**

Add after the existing `CREATE INDEX` statements in `initDb()`:

```javascript
// New columns (safe ALTER TABLE — no-ops if already exist)
await client.execute(`ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0`).catch(() => {});
await client.execute(`ALTER TABLE companies ADD COLUMN firecrawl_scraped INTEGER DEFAULT 0`).catch(() => {});

// New indexes
await client.execute(`CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain)`);
await client.execute(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`);
await client.execute(`CREATE INDEX IF NOT EXISTS idx_contacts_contacted ON contacts(contacted)`);
await client.execute(`CREATE INDEX IF NOT EXISTS idx_contacts_email_status ON contacts(email_status)`);
await client.execute(`CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score)`);
```

Add transaction helper after existing exports:

```javascript
async function transaction(fn) {
    await client.execute('BEGIN');
    try {
        const result = await fn({ query, queryOne, run });
        await client.execute('COMMIT');
        return result;
    } catch (err) {
        await client.execute('ROLLBACK');
        throw err;
    }
}
```

Export `transaction` alongside existing exports.

- [ ] **Step 2: Replace console.log with logger**

```javascript
const logger = require('./lib/logger');
// Replace: console.log('Database initialized');
// With:    logger.info('Database initialized');
```

- [ ] **Step 3: Verify database starts with new schema**

```bash
cd "c:\Users\jlb2s\Documents\Lead Generator" && node -e "
const { initDb, query } = require('./database');
(async () => {
    await initDb();
    const [r] = await query('SELECT lead_score FROM contacts LIMIT 1');
    console.log('lead_score column:', r ? r.lead_score : 'table empty — column exists');
    console.log('OK');
})();
"
```

Expected: `OK` with no errors

- [ ] **Step 4: Commit**

```bash
git add database.js
git commit -m "feat: add lead_score column, new indexes, transaction support"
```

---

## Task 7: Wire Server with Auth, Cookies, and Logging

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Update server.js with auth, cookie parsing, rate limiting, and Pino HTTP logging**

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const pinoHttp = require('pino-http');
const cookieParser = require('cookie-parser');
const { initDb } = require('./database');
const logger = require('./lib/logger');
const { requireAuth, handleLogin, handleLogout, loginLimiter, apiLimiter } = require('./middleware/auth');
const { validate, loginSchema } = require('./middleware/validate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Request logging
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url.startsWith('/style') || req.url.endsWith('.js') || req.url.endsWith('.css') || req.url.endsWith('.webp') } }));

// Static files (no rate limit, no auth)
app.use(express.static(path.join(__dirname, 'public')));

// Public routes
app.post('/api/login', loginLimiter, validate(loginSchema), handleLogin);
app.post('/api/logout', handleLogout);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Protected API routes
app.use('/api', apiLimiter, requireAuth);

// Mount route modules
const contactsRouter = require('./routes/contacts');
const companiesRouter = require('./routes/companies');
const pullsRouter = require('./routes/pulls');
const enrichmentRouter = require('./routes/enrichment');
const exportsRouter = require('./routes/exports');

app.use('/api', contactsRouter);
app.use('/api', companiesRouter);
app.use('/api', pullsRouter);
app.use('/api', enrichmentRouter);
app.use('/api', exportsRouter);

async function start() {
    await initDb();
    app.listen(PORT, () => {
        logger.info({ port: PORT }, `Lead Generator running at http://localhost:${PORT}`);
    });
}

start().catch(err => {
    logger.error(err, 'Failed to start server');
    process.exit(1);
});
```

- [ ] **Step 2: Install cookie-parser**

```bash
npm install cookie-parser
```

- [ ] **Step 3: Commit**

```bash
git add server.js package.json package-lock.json
git commit -m "feat: wire auth, cookie parsing, Pino HTTP logging, rate limiting into server"
```

---

## Task 8: Split Routes — contacts.js

**Files:**
- Create: `routes/contacts.js`

- [ ] **Step 1: Extract contacts endpoints from routes/leads.js**

Move these endpoints into `routes/contacts.js`:
- `GET /stats` (lines 104-125)
- `GET /contacts` (lines 128-169)
- `GET /contacts/export` (lines 172-206)
- `PUT /contacts/:id/contacted` (lines 515-523)
- `GET /industries` (lines 526-529)
- `GET /cities` (lines 657-677)

Keep the quality gate functions (`isDecisionMaker`, `isPersonalEmail`, `passesGate`, `parsePerson`) in a shared file `lib/quality-gate.js` since they're used by enrichment too.

- [ ] **Step 2: Create lib/quality-gate.js**

Extract lines 13-94 from `routes/leads.js` into this file. Export all functions.

- [ ] **Step 3: Commit**

```bash
git add routes/contacts.js lib/quality-gate.js
git commit -m "refactor: extract contacts routes and quality gate into separate modules"
```

---

## Task 9: Split Routes — companies.js

**Files:**
- Create: `routes/companies.js`

- [ ] **Step 1: Extract company endpoints from routes/leads.js**

Move these endpoints:
- `GET /companies` (lines 209-239)
- `GET /companies/:id/contacts` (lines 242-249)
- `DELETE /companies/:id` (lines 252-259)
- `POST /companies/import` (lines 586-612)

- [ ] **Step 2: Commit**

```bash
git add routes/companies.js
git commit -m "refactor: extract company routes into separate module"
```

---

## Task 10: Split Routes — pulls.js

**Files:**
- Create: `routes/pulls.js`

- [ ] **Step 1: Extract pull job endpoints from routes/leads.js**

Move these endpoints:
- `POST /pull` + `GET /pull/status` + `POST /pull/cancel` (Google Places)
- `POST /pull/foursquare` + status + cancel
- `POST /pull/osm` + status + cancel

- [ ] **Step 2: Commit**

```bash
git add routes/pulls.js
git commit -m "refactor: extract pull job routes into separate module"
```

---

## Task 11: Split Routes — enrichment.js

**Files:**
- Create: `routes/enrichment.js`

- [ ] **Step 1: Extract enrichment endpoints from routes/leads.js**

Move these endpoints:
- `POST /enrich/scrape` + status + cancel
- `POST /enrich/apollo` + status + cancel
- `POST /cleanup/dedupe`

Wire in `verifier.js` and `scorer.js` calls within the enrichment flow.

- [ ] **Step 2: Commit**

```bash
git add routes/enrichment.js
git commit -m "refactor: extract enrichment routes, wire in verifier and scorer"
```

---

## Task 12: Split Routes — exports.js

**Files:**
- Create: `routes/exports.js`

- [ ] **Step 1: Extract export endpoints from routes/leads.js**

Move these endpoints:
- `POST /export/sheets` (n8n webhook push)
- Wire in `generate-pdf.js` as `GET /contacts/export-pdf`

Also move the website-leads proxy endpoints (lines 682-708).

- [ ] **Step 2: Commit**

```bash
git add routes/exports.js
git commit -m "refactor: extract export routes, wire in PDF generation"
```

---

## Task 13: Remove Old Monolith Route File

**Files:**
- Delete: `routes/leads.js`

- [ ] **Step 1: Delete routes/leads.js**

All endpoints have been moved to the new modules. Delete the old file.

- [ ] **Step 2: Verify server starts**

```bash
cd "c:\Users\jlb2s\Documents\Lead Generator" && node -e "
const http = require('http');
const child = require('child_process');
const proc = child.spawn('node', ['server.js'], { stdio: 'pipe', env: { ...process.env } });
setTimeout(() => {
    http.get('http://localhost:3000/api/health', (res) => {
        let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ console.log(d); proc.kill(); });
    }).on('error', e => { console.log('FAIL:', e.message); proc.kill(); });
}, 2000);
"
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Commit**

```bash
git rm routes/leads.js
git commit -m "refactor: remove monolith routes/leads.js — all endpoints in focused modules"
```

---

## Task 14: Job Manager

**Files:**
- Create: `lib/job-manager.js`

- [ ] **Step 1: Create job manager with SSE support**

```javascript
const crypto = require('crypto');
const logger = require('./logger');

class JobManager {
    constructor() {
        this.jobs = new Map();
        this.listeners = new Map(); // jobId -> Set<res>
    }

    create(type) {
        // Prevent concurrent jobs of same type
        for (const [id, job] of this.jobs) {
            if (job.type === type && job.status === 'running') {
                return { error: `${type} job already running`, existingId: id };
            }
        }
        const id = crypto.randomBytes(4).toString('hex');
        const job = { id, type, status: 'running', progress: 0, total: 0, done: 0, found: 0, cancelled: false, startedAt: new Date() };
        this.jobs.set(id, job);
        logger.info({ jobId: id, type }, 'Job started');
        return job;
    }

    update(id, updates) {
        const job = this.jobs.get(id);
        if (!job) return;
        Object.assign(job, updates);
        if (updates.done && job.total) job.progress = Math.round((job.done / job.total) * 100);
        this._notify(id);
    }

    complete(id, status = 'completed') {
        const job = this.jobs.get(id);
        if (!job) return;
        job.status = status;
        job.progress = 100;
        job.finishedAt = new Date();
        logger.info({ jobId: id, type: job.type, status, found: job.found }, 'Job finished');
        this._notify(id);
        // Close all SSE connections
        const subs = this.listeners.get(id);
        if (subs) { subs.forEach(res => res.end()); this.listeners.delete(id); }
    }

    cancel(id) {
        const job = this.jobs.get(id);
        if (!job || job.status !== 'running') return false;
        job.cancelled = true;
        this.complete(id, 'cancelled');
        return true;
    }

    get(id) { return this.jobs.get(id) || null; }

    getByType(type) {
        for (const job of this.jobs.values()) {
            if (job.type === type && job.status === 'running') return job;
        }
        return null;
    }

    subscribe(id, res) {
        if (!this.listeners.has(id)) this.listeners.set(id, new Set());
        this.listeners.get(id).add(res);
        res.on('close', () => { this.listeners.get(id)?.delete(res); });
        // Send current state immediately
        const job = this.jobs.get(id);
        if (job) {
            res.write(`data: ${JSON.stringify(job)}\n\n`);
            if (job.status !== 'running') res.end();
        }
    }

    _notify(id) {
        const subs = this.listeners.get(id);
        const job = this.jobs.get(id);
        if (!subs || !job) return;
        subs.forEach(res => { try { res.write(`data: ${JSON.stringify(job)}\n\n`); } catch {} });
    }
}

module.exports = new JobManager();
```

- [ ] **Step 2: Commit**

```bash
git add lib/job-manager.js
git commit -m "feat: add job manager with SSE real-time progress"
```

---

## Task 15: Firecrawl Scraper

**Files:**
- Create: `lib/firecrawl-scraper.js`

- [ ] **Step 1: Create Firecrawl scraper with Cheerio fallback**

```javascript
const { FIRECRAWL_API_KEY } = require('../config');
const { extractContactInfo } = require('../scraper');
const logger = require('./logger');

let FirecrawlAppV1;
let firecrawl;

function getFirecrawl() {
    if (!FIRECRAWL_API_KEY) return null;
    if (!firecrawl) {
        FirecrawlAppV1 = require('@mendable/firecrawl-js').FirecrawlAppV1;
        firecrawl = new FirecrawlAppV1({ apiKey: FIRECRAWL_API_KEY });
    }
    return firecrawl;
}

async function scrapeWithFirecrawl(url) {
    const fc = getFirecrawl();
    if (!fc) {
        logger.warn('Firecrawl API key not set — falling back to Cheerio');
        return scrapeWithCheerio(url);
    }

    try {
        logger.info({ url }, 'Firecrawl scraping');
        const result = await fc.scrapeUrl(url, { formats: ['markdown'] });

        if (!result.success) {
            logger.warn({ url, error: result.error }, 'Firecrawl failed — falling back to Cheerio');
            return scrapeWithCheerio(url);
        }

        // Parse the markdown for contacts
        const content = result.markdown || '';
        const metadata = result.metadata || {};

        // Extract emails
        const emailRegex = /[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
        const emails = [...new Set((content.match(emailRegex) || []).map(e => e.toLowerCase()))];

        // Extract phones
        const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const phones = [...new Set((content.match(phoneRegex) || []).map(p => p.trim()))];

        // Extract people with titles
        const titleRegex = /(CEO|CFO|COO|CTO|President|Owner|Founder|Director|VP|Manager|Partner|Principal)/i;
        const people = [];
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 100);
        for (const line of lines) {
            if (titleRegex.test(line)) people.push(line);
        }

        // Extract address
        const addressMatch = content.match(/\d+\s[A-Za-z0-9\s.,]+,\s[A-Za-z\s]+,?\s[A-Z]{2}\s\d{5}/);

        return {
            emails,
            phones,
            people: [...new Set(people)].slice(0, 5),
            address: addressMatch ? addressMatch[0].trim() : null,
            source: 'firecrawl',
            rawLength: content.length,
        };
    } catch (err) {
        if (err.statusCode === 402) {
            logger.warn('Firecrawl credits exhausted — falling back to Cheerio');
        } else {
            logger.warn({ url, error: err.message }, 'Firecrawl error — falling back to Cheerio');
        }
        return scrapeWithCheerio(url);
    }
}

async function scrapeWithCheerio(url) {
    const result = await extractContactInfo(url);
    return { ...result, source: 'cheerio' };
}

module.exports = { scrapeWithFirecrawl };
```

- [ ] **Step 2: Commit**

```bash
git add lib/firecrawl-scraper.js
git commit -m "feat: add Firecrawl AI scraper with Cheerio fallback"
```

---

## Task 16: Wire Verifier + Scorer into Enrichment

**Files:**
- Modify: `routes/enrichment.js`

- [ ] **Step 1: Update enrichment route to call verifier after scraping**

In the scrape loop, after finding emails, call `validateEmail(email, website)` from `verifier.js` and update `email_status`.

- [ ] **Step 2: Update enrichment route to calculate lead scores**

After scraping + Apollo, call `calculateScore(contact)` from `scorer.js` and update `lead_score` column.

- [ ] **Step 3: Add backfill endpoint**

```javascript
// POST /api/admin/backfill — score all existing contacts + verify emails
router.post('/admin/backfill', async (req, res) => {
    // Fetch all contacts with their company data
    // For each: calculate score, optionally verify email
    // Update lead_score and email_status in DB
});
```

- [ ] **Step 4: Commit**

```bash
git add routes/enrichment.js
git commit -m "feat: wire email verification and lead scoring into enrichment pipeline"
```

---

## Task 17: Cross-Source Deduplication

**Files:**
- Modify: `routes/enrichment.js`

- [ ] **Step 1: Add smart dedup endpoint**

Replace the basic dedupe with cross-source dedup:
- Match on normalized domain (primary)
- Match on name + city (secondary)
- Winner: most populated fields, tiebreak by earliest created_at
- Contact-level dedup: same email = same contact
- Reassign contacts from loser companies to winner

- [ ] **Step 2: Commit**

```bash
git add routes/enrichment.js
git commit -m "feat: add cross-source deduplication with smart merge"
```

---

## Task 18: Frontend — Tailwind Dark Mode Overhaul

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Rewrite index.html with Tailwind dark mode**

Complete rewrite of the HTML with:
- Tailwind CDN + custom config (same as AdForge)
- Dark glass panel sidebar with gradient accents
- Professional stats cards with icons
- Lead score column + email status badges in tables
- URL-to-Leads card on Import tab
- Real-time progress bars (SSE-connected)
- PDF export button
- Updated login overlay (sends to `/api/login` backend)

- [ ] **Step 2: Rewrite app.js with server-side auth + SSE**

- Replace client-side auth with `POST /api/login` → cookie-based
- Replace `setInterval` polling with SSE for job progress
- Add lead score badge rendering (green/yellow/gray)
- Add email status badge rendering (checkmark/warning/x)
- Add URL-to-Leads scrape button handler
- Add PDF export handler

- [ ] **Step 3: Verify full app works**

```bash
cd "c:\Users\jlb2s\Documents\Lead Generator" && node server.js
```

Open http://localhost:3000, test login, browse leads, check scores/badges.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/app.js
git commit -m "feat: complete Tailwind dark mode UI with lead scores, email badges, URL-to-leads"
```

---

## Task 19: Final Verification & Cleanup

**Files:**
- Delete: `public/style.css` (replaced by Tailwind inline)
- Verify: all endpoints work

- [ ] **Step 1: Run full smoke test**

Test each major feature:
1. Login with credentials
2. Browse leads tab (scores, badges visible)
3. Browse companies tab
4. Scrape a URL with Firecrawl
5. Export CSV
6. Export PDF
7. Check stats dashboard

- [ ] **Step 2: Clean up old files**

Remove `public/style.css` if all styles are now in Tailwind.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: Lead Generator v2.0 — security, Firecrawl, scoring, Tailwind UI"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Install dependencies | 2 min |
| 2 | Harden config | 5 min |
| 3 | Auth middleware (JWT + bcrypt) | 10 min |
| 4 | Input validation (Zod) | 5 min |
| 5 | Structured logging (Pino) | 3 min |
| 6 | Database upgrades | 5 min |
| 7 | Wire server with auth + logging | 10 min |
| 8-12 | Split routes (5 modules) | 30 min |
| 13 | Remove old monolith | 5 min |
| 14 | Job manager + SSE | 10 min |
| 15 | Firecrawl scraper | 10 min |
| 16 | Wire verifier + scorer | 15 min |
| 17 | Cross-source dedup | 10 min |
| 18 | Frontend Tailwind overhaul | 45 min |
| 19 | Final verification | 10 min |
