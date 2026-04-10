# Research: SQLite Performance Tuning for Node.js Apps

**Date:** 2026-04-09
**Cycles:** 2
**Final Score:** 8.6/10
**Playbook Version:** 1.2

## Executive Summary

SQLite with better-sqlite3 can achieve 10,000+ inserts/sec and 14,000+ selects/sec on Node.js v20 LTS with proper tuning. The critical configuration is a combination of WAL mode, NORMAL synchronous, memory-mapped I/O, and appropriate cache sizing — all set at connection open time. Beyond PRAGMAs, the biggest wins come from covering indexes (2x read speedup), transaction batching (2-20x write throughput), BEGIN IMMEDIATE for write transactions (prevents unrecoverable SQLITE_BUSY errors), and worker threads for CPU-heavy queries. Production deployments must manage WAL checkpoint starvation, use SQLite's backup API (never `cp`), and avoid overlapping container deploys on shared volumes.

## Detailed Findings

### Essential PRAGMA Configuration

Every better-sqlite3 connection should run these PRAGMAs at open time. Non-persistent PRAGMAs (cache_size, foreign_keys, temp_store) reset per connection — journal_mode persists in the DB file.

```javascript
const Database = require('better-sqlite3');
const db = new Database('app.db');

// Performance PRAGMAs (run on every connection open)
db.pragma('journal_mode = WAL');         // Concurrent reads + writes
db.pragma('synchronous = NORMAL');       // Safe in WAL mode, avoids FSYNC per write
db.pragma('cache_size = -64000');        // 64MB cache (negative = KB)
db.pragma('temp_store = MEMORY');        // Temp tables/indexes in RAM
db.pragma('mmap_size = 268435456');      // 256MB memory-mapped I/O
db.pragma('busy_timeout = 5000');        // 5s wait on write locks
db.pragma('foreign_keys = ON');          // Enforce constraints

// Maintenance (run periodically or on close)
db.pragma('analysis_limit = 400');       // Limit ANALYZE row count
db.pragma('optimize');                   // Update query planner statistics
```

**Why these values:**
- `cache_size = -64000`: ForwardEmail benchmarks show 64MB is the sweet spot; default 2000 pages (~8MB) is too small for production workloads
- `mmap_size = 268435456`: 256MB memory-mapped I/O reduces syscalls; uses virtual memory only, not physical RAM. Phiresky recommends up to 30GB but 256MB is conservative and safe
- `temp_store = MEMORY`: Faster for most workloads. **Exception**: ForwardEmail found disk-based temp storage is better when datasets exceed available RAM (their email DBs hit 10+ GB during VACUUM)
- `synchronous = NORMAL`: better-sqlite3 is compiled with `SQLITE_DEFAULT_WAL_SYNCHRONOUS=1`, making this the default in WAL mode. Safe against app crashes; power loss may rollback the last transaction (not corrupt the DB)

### WAL Mode Deep Dive

WAL (Write-Ahead Logging) is the single most impactful configuration change. It inverts the traditional rollback journal: instead of writing original content to a journal before modifying the DB, WAL preserves the original DB and appends changes to a separate `-wal` file.

**How it works:**
1. Writers append changes to the WAL file
2. Readers check WAL first, then fall back to the main DB file
3. A commit completes by appending a commit marker (no FSYNC in NORMAL mode)
4. Checkpointing transfers WAL changes back to the main DB

**Performance impact:**
- PowerSync measured 97%+ reduction in per-transaction overhead (from 30ms+ to <1ms)
- ForwardEmail benchmarks: +12% inserts, +5% selects, +33% updates vs default journal mode
- Concurrent reads during writes (impossible in default rollback mode)

**Limitations:**
- Only ONE writer at a time (others get SQLITE_BUSY)
- Read performance degrades as WAL file grows — checkpoint regularly
- Cannot change page_size while in WAL mode
- Large transactions (>100MB): rollback journal may actually be faster
- Requires shared memory (-shm file) — no network filesystems
- Cross-database transactions lose atomicity across ATTACHed databases

**Checkpoint management:**
```javascript
// Monitor WAL size and trigger manual checkpoint
const checkWal = () => {
  try {
    const stat = fs.statSync('app.db-wal');
    if (stat.size > 50 * 1024 * 1024) { // 50MB threshold
      db.pragma('wal_checkpoint(RESTART)');
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
};
setInterval(checkWal, 5000).unref();
```

Checkpoint types: PASSIVE (non-blocking, may not complete), FULL (blocks writers until done), RESTART (blocks + resets WAL position), TRUNCATE (blocks + deletes WAL file). `wal_autocheckpoint=1000` (default) showed best overall performance in ForwardEmail benchmarks.

### Transaction Batching

Wrapping writes in transactions provides 2-20x throughput improvement. Without transactions, each individual INSERT triggers a full commit cycle (FSYNC in non-WAL mode).

```javascript
// BAD: each insert is its own transaction
for (const item of items) {
  db.prepare('INSERT INTO leads VALUES (?, ?)').run(item.name, item.email);
}

// GOOD: all inserts in one transaction (2-20x faster)
const insert = db.prepare('INSERT INTO leads VALUES (?, ?)');
const insertMany = db.transaction((items) => {
  for (const item of items) insert.run(item.name, item.email);
});
insertMany(items);
```

**Critical: Use BEGIN IMMEDIATE for write transactions.**
Default `BEGIN` (DEFERRED) starts as a read lock, then tries to upgrade to write. If upgrade fails, `busy_timeout` cannot help — you get an unrecoverable SQLITE_BUSY. `BEGIN IMMEDIATE` acquires the write lock upfront, allowing `busy_timeout` to work properly.

```javascript
// Use .immediate() for write transactions
const insertMany = db.transaction((items) => {
  for (const item of items) insert.run(item.name, item.email);
}).immediate(); // <-- This matters in production
```

### Indexing Strategies

#### Covering Indexes (2x Read Speedup)

A covering index includes ALL columns a query needs — both search conditions and output columns. SQLite reads directly from the index B-tree without touching the main table, eliminating one binary search per row.

```sql
-- Query: SELECT email, score FROM leads WHERE company_id = ?
-- Regular index (2 binary searches per row):
CREATE INDEX idx_company ON leads(company_id);

-- Covering index (1 binary search per row — 2x faster):
CREATE INDEX idx_company_covering ON leads(company_id, email, score);
```

**Trade-off:** More storage and slower writes (index must be maintained). Worth it for frequently-run read queries.

#### Composite Index Column Ordering

The left-most column is the primary sort key. Subsequent columns break ties. The **no-gaps rule** is critical: if your WHERE clause has columns a, b, d (but not c), and the index is (a,b,c,d), only a and b are used.

```sql
-- Index: CREATE INDEX idx ON leads(state, industry, score)
-- This query uses ALL 3 columns:
SELECT * FROM leads WHERE state = 'NC' AND industry = 'optometry' AND score > 80;

-- This query uses only state (gap at industry):
SELECT * FROM leads WHERE state = 'NC' AND score > 80;
```

**Rule:** Never have two indexes where one is a prefix of the other. Drop the shorter one — the longer index handles both use cases.

#### Partial Indexes

Index only rows matching a condition. Smaller index = faster scans, less write overhead.

```sql
-- Only index active leads (skip 80% of rows)
CREATE INDEX idx_active_leads ON leads(email, score) WHERE status = 'active';
```

#### Expression Indexes

Index computed values for queries that filter on expressions:

```sql
-- Index for case-insensitive email lookups
CREATE INDEX idx_lower_email ON leads(LOWER(email));
-- Query must use exact same expression:
SELECT * FROM leads WHERE LOWER(email) = 'joey@example.com';
```

#### Hash Key Indexing (Non-Obvious Technique)

For multi-column equality lookups, combine fields into a single BigInt hash. Benchmarks on 52k rows: hash lookup = 74,680 QPS vs composite text = 49,391 QPS (1.5x faster).

```javascript
const crypto = require('crypto');
function hashKey(fields) {
  const hash = crypto.createHash('sha256').update(fields.join('|')).digest();
  return hash.readBigInt64BE(0).toString();
}
// Store hash in a BIGINT column, index it, query with WHERE hash_key = ?
```

Only works for equality lookups, not range queries. Best for 3-4 fields that always appear together in WHERE clauses.

#### OR Constraints (Gotcha)

Multi-column indexes only optimize AND-connected WHERE terms. For OR conditions, EVERY term must have an index or the entire query falls back to full table scan.

```sql
-- Both columns MUST be indexed for this to use indexes:
SELECT * FROM leads WHERE state = 'NC' OR industry = 'optometry';
-- If either column lacks an index, full table scan occurs
```

### Worker Thread Architecture

better-sqlite3 is synchronous — heavy queries block the Node.js event loop. For CPU-intensive workloads, use worker threads with dedicated connections.

```javascript
// worker.js — each worker gets its own connection
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
db.pragma('cache_size = -32000');    // 32MB per worker
db.pragma('temp_store = MEMORY');
db.pragma('query_only = ON');        // Read-only safety
```

**Benchmarks (Dev.to lovestaco, 50k-row DB):**
- 2 processes x 1 worker: 8,274 QPS (best)
- 2 processes x 2 workers: 5,199 QPS
- 2 processes x 8 workers: 1,629 QPS (regression)

**Key finding:** Adding workers beyond available CPU cores causes regression, not improvement. Primary key lookups are 155x faster than secondary index scans — fix your queries before adding threads.

### JSON1 Bulk Operations

SQLite's JSON1 extension enables efficient bulk operations that bypass per-statement overhead:

```javascript
// Bulk lookup using json_each (1-2x faster than individual prepared statements)
const ids = JSON.stringify([1, 2, 3, 4, 5]);
const rows = db.prepare(`
  SELECT * FROM leads WHERE id IN (SELECT value FROM json_each(?))
`).all(ids);
```

### Node.js Version Impact

ForwardEmail benchmarks (better-sqlite3 with WAL + production PRAGMAs):

| Node Version | Inserts/s | Selects/s | Updates/s | Recommendation |
|-------------|-----------|-----------|-----------|----------------|
| v20 LTS | 10,205 | 14,034 | 18,571 | **Production choice** |
| v22 | ~9,400 | ~12,800 | ~17,000 | 7-9% slower, inconsistent |
| v24 | 9,938 | ~6,000 | ~5,400 | **Avoid — 57% slower selects** |
| v25.9.0 | — | — | — | Unexpected improvements (new) |

### node:sqlite vs better-sqlite3

Performance is "almost indistinguishable" in expanded benchmarks (GitHub issue #1266). However, node:sqlite requires `--experimental-sqlite` flag and cannot customize SQLite compile-time options. better-sqlite3 remains the production choice.

### Database Maintenance

```javascript
// On connection close or periodically (every few hours)
db.pragma('analysis_limit = 400');
db.pragma('optimize');

// Periodic space reclaim (expensive — schedule during low traffic)
// VACUUM rewrites entire DB; requires extra storage equal to DB size
db.exec('VACUUM');

// Incremental alternative (set once, run periodically)
// db.pragma('auto_vacuum = INCREMENTAL'); // only on DB creation
// db.pragma('incremental_vacuum');         // periodic reclaim
```

Monitor fragmentation: trigger maintenance when it exceeds 15%.

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| GitHub (better-sqlite3 docs, issues) | 3 | WAL, checkpoint, node:sqlite comparison | high |
| Tech blogs (phiresky, PowerSync, pecar.me, ultrathink.art, cj.rs) | 5 | PRAGMA configs, benchmarks, production gotchas | high |
| Dev.to articles (lovestaco x3, others) | 5 | Worker threads, hash keys, PRAGMAs, library comparison | high |
| SQLite official docs (WAL, query planner) | 2 | WAL internals, index mechanics, OR constraints | high |
| ForwardEmail benchmarks | 1 | Node.js version data, WAL autocheckpoint, encryption overhead | high |
| HN community discussion | 1 | Separate process advice, batch insert trick | medium |
| Medium articles | 2 | Covering indexes, WAL overview | medium |
| Web search (general) | 3 | Aggregated, surface-level | medium |
| Reddit | 1 | No relevant results returned | low |

## Contradictions & Open Questions

### Contradictions (Preserved)

1. **temp_store: MEMORY vs DISK** — Most sources recommend `temp_store = MEMORY` for speed. ForwardEmail production guide recommends disk for large datasets (their email DBs consume 10+ GB during VACUUM). **Resolution:** Both valid — use MEMORY unless your temp operations exceed available RAM.

2. **Main thread vs worker thread** — HN commenters say "never run sqlite in main thread." better-sqlite3 docs and practical articles show it working fine for typical web workloads. **Resolution:** Light queries (sub-ms) are fine on main thread; heavy queries (>50ms) or bulk operations should use workers.

3. **mmap_size values** — Ranges from 256MB (Dev.to) to 30GB (phiresky). **Resolution:** Use 256MB as default; increase if your DB is larger and you have the virtual address space (always true on 64-bit).

4. **Drop indexes before bulk inserts** — Recommended by HN/Medium for initial loads. Not mentioned by better-sqlite3 docs or PowerSync. **Resolution:** Useful for initial data loading (thousands of rows); not practical for ongoing operation.

5. **WAL vs rollback for large transactions** — SQLite official docs note transactions >100MB may be faster with rollback journal. No other source mentions this. **Resolution:** Edge case — most Node.js apps don't have single 100MB+ transactions.

### Open Questions

- What is the optimal `cache_size` for databases in the 100MB-1GB range? Sources suggest 32-64MB but no comparative benchmarks exist for this specific range.
- How does better-sqlite3 perform with FTS5 (full-text search) under load? One HN user reported FTS "didn't work" but no details.
- What is the real-world impact of `PRAGMA optimize` — how much does it actually improve query planning vs. running without it?
- WAL2 mode is mentioned as a solution for WAL growth but is still experimental — when will it ship?

## Actionable Next Steps

1. **Apply the PRAGMA configuration block** to your Lead Generator's `database.js` — all 7 PRAGMAs at connection open time
2. **Add `db.pragma('optimize')` on graceful shutdown** in `server.js` to keep query planner statistics fresh
3. **Audit indexes** with `EXPLAIN QUERY PLAN` on your most common queries (company search, email lookup, proximity sort)
4. **Add covering indexes** for the top 3-5 most frequent read queries in your app
5. **Switch write transactions to `.immediate()`** to prevent SQLITE_BUSY errors under concurrent access
6. **Add WAL checkpoint monitoring** — your 20k company DB won't hit this, but it's cheap insurance
7. **Consider hash key indexing** for multi-column lookups (e.g., state + industry + proximity combined)
8. **Use JSON1 `json_each()`** for bulk operations in campaign/export routes
9. **Pin Node.js v20 LTS** for production — avoid v22-v24 performance regressions
10. **Set up proper backup** using SQLite backup API, not file copy
11. **Add partial indexes** for filtered views (e.g., only index leads with score > 0)
12. **Monitor with `EXPLAIN QUERY PLAN`** — look for SCAN (bad) vs SEARCH (good) in output
13. **Use `VACUUM INTO 'backup.db'`** for safe backups that handle WAL mode correctly

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 7 | 8 | 8 | 8 | 7 | 7.6 |
| 2 | 9 | 8 | 9 | 9 | 8 | 8.6 |

## Related

- [[Lead Generator]] — Primary beneficiary; `database.js` uses better-sqlite3
- [[BunnBrain]] — SQLite knowledge base, also uses better-sqlite3
- [[Princeville Connect]] — Uses Knex + SQLite, could benefit from WAL + indexing
- [[Joshua]] — If SQLite is used for conversation state or call logs
- [[Gaming PC]] — Not relevant (GPU workloads)

## Meta: What the Loop Learned

- **Most valuable source this session:** SQLite official query planner docs (sqlite.org/queryplanner.html) — definitive on covering indexes, composite ordering, and OR constraint behavior. No blog post matches its precision.
- **Least valuable source this session:** Reddit — search returned zero relevant results for this topic. Stack Overflow search also returned non-SO results.
- **Surprising discovery:** The `BEGIN IMMEDIATE` gotcha from pecar.me was the single most impactful production tip — `busy_timeout` is essentially broken without it, and better-sqlite3's default transaction mode (DEFERRED) is the wrong choice for write-heavy apps. This is not mentioned in better-sqlite3's own documentation.
