const { createClient } = require('@libsql/client');
const path = require('path');

let logger;
try {
    logger = require('./lib/logger');
} catch {
    logger = { info: console.log, error: console.error, warn: console.warn };
}

let client;

async function initDb() {
    if (client) return;

    const url = process.env.TURSO_DATABASE_URL
        || `file:${path.resolve(__dirname, 'leads.db').replace(/\\/g, '/')}`;
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

    client = createClient(authToken ? { url, authToken } : { url });

    await client.execute(`CREATE TABLE IF NOT EXISTS companies (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id     TEXT UNIQUE,
        name         TEXT NOT NULL,
        website      TEXT,
        domain       TEXT,
        phone        TEXT,
        address      TEXT,
        city         TEXT,
        state        TEXT DEFAULT 'NC',
        lat          REAL,
        lng          REAL,
        rating       REAL,
        industry     TEXT,
        google_types TEXT,
        scraped      INTEGER DEFAULT 0,
        enriched     INTEGER DEFAULT 0,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS contacts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        title        TEXT NOT NULL,
        email        TEXT,
        phone        TEXT,
        email_status TEXT DEFAULT 'unverified',
        source       TEXT,
        contacted    INTEGER DEFAULT 0,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS pull_jobs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        status          TEXT DEFAULT 'running',
        queries_total   INTEGER DEFAULT 0,
        queries_done    INTEGER DEFAULT 0,
        companies_found INTEGER DEFAULT 0,
        contacts_found  INTEGER DEFAULT 0,
        started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at     DATETIME
    )`);

    await client.execute(`CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_companies_city ON companies(city)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id)`);

    // New columns (safe — no-op if already exist)
    await client.execute('ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0').catch(() => {});
    await client.execute('ALTER TABLE companies ADD COLUMN firecrawl_scraped INTEGER DEFAULT 0').catch(() => {});

    // New indexes
    await client.execute('CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_contacts_contacted ON contacts(contacted)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_contacts_email_status ON contacts(email_status)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score)');

    logger.info('Database initialized');
}

async function query(sql, args = []) {
    const result = await client.execute({ sql, args });
    return result.rows.map(row => {
        const obj = {};
        for (const [k, v] of Object.entries(row)) {
            obj[k] = typeof v === 'bigint' ? Number(v) : v;
        }
        return obj;
    });
}

async function queryOne(sql, args = []) {
    const rows = await query(sql, args);
    return rows[0] || null;
}

async function run(sql, args = []) {
    const result = await client.execute({ sql, args });
    return result;
}

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

module.exports = { initDb, query, queryOne, run, transaction };
