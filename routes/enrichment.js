const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database');
const { extractContactInfo } = require('../scraper');
const { enrichWithApollo } = require('../enricher');
const { APOLLO_API_KEY } = require('../config');
const { isDecisionMaker, isPersonalEmail, passesGate, parsePerson, BLOCKED_EMAIL_DOMAINS } = require('../lib/quality-gate');

// ── Scrape state ─────────────────────────────────────────────────────────────
const scrapeState = { running: false, cancelled: false, done: 0, total: 0, found: 0 };
const apolloState = { running: false, cancelled: false, done: 0, total: 0, found: 0 };

// ── Scrape enrichment ─────────────────────────────────────────────────────────
router.post('/enrich/scrape', async (req, res) => {
    if (scrapeState.running) return res.json({ message: 'Scrape already running', state: scrapeState });

    // Dedup by domain — only visit each unique website once per run.
    // Companies without a domain fall back to grouping by id (scraped individually).
    const companies = await query(
        `SELECT * FROM companies
         WHERE scraped=0 AND website IS NOT NULL
         GROUP BY COALESCE(NULLIF(domain,''), id)
         ORDER BY rating DESC`, []
    );

    if (companies.length === 0) return res.json({ message: 'No companies to scrape' });

    Object.assign(scrapeState, { running: true, cancelled: false, done: 0, total: companies.length, found: 0 });
    res.json({ message: 'Scrape started', total: companies.length });

    (async () => {
        for (const company of companies) {
            if (scrapeState.cancelled) break;
            try {
                const contact = await extractContactInfo(company.website);

                // Mark every company that shares this domain as scraped (prevents re-scraping duplicates)
                if (company.domain) {
                    await run('UPDATE companies SET scraped=1 WHERE domain=?', [company.domain]);
                }

                // Update phone/address on this specific company if missing
                await run(
                    `UPDATE companies SET
                        phone   = CASE WHEN phone IS NULL THEN ? ELSE phone END,
                        address = CASE WHEN address IS NULL THEN ? ELSE address END,
                        scraped = 1
                     WHERE id = ?`,
                    [contact.phones[0] || null, contact.address || null, company.id]
                );

                // Parse people lines into contacts
                for (const line of (contact.people || [])) {
                    const parsed = parsePerson(line);
                    if (!parsed) continue;

                    // Find best personal email
                    const personalEmails = (contact.emails || []).filter(isPersonalEmail);
                    const email = personalEmails[0] || null;
                    const phone = contact.phones[0] || null;

                    const candidate = { name: parsed.name, title: parsed.title, email, phone };
                    if (!passesGate(candidate)) continue;

                    const exists = await queryOne(
                        'SELECT id FROM contacts WHERE company_id=? AND name=?',
                        [company.id, parsed.name]
                    );
                    if (exists) continue;

                    await run(
                        'INSERT INTO contacts (company_id, name, title, email, phone, source) VALUES (?,?,?,?,?,?)',
                        [company.id, parsed.name, parsed.title, email, phone, 'scraped']
                    );
                    scrapeState.found++;
                }
            } catch (err) {
                console.error(`Scrape error [${company.name}]:`, err.message);
            }

            scrapeState.done++;
            await new Promise(r => setTimeout(r, 500));
        }
        scrapeState.running = false;
        console.log(`Scrape complete: ${scrapeState.found} contacts found`);
    })();
});

router.get('/enrich/scrape/status', (req, res) => {
    const pct = scrapeState.total
        ? Math.round((scrapeState.done / scrapeState.total) * 100) : 0;
    res.json({ ...scrapeState, pct });
});

router.post('/enrich/scrape/cancel', (_req, res) => {
    if (scrapeState.running) scrapeState.cancelled = true;
    res.json({ ok: true });
});

// ── Apollo enrichment ─────────────────────────────────────────────────────────
router.post('/enrich/apollo', async (req, res) => {
    if (apolloState.running) return res.json({ message: 'Apollo enrichment already running', state: apolloState });

    const companies = await query(
        `SELECT * FROM companies
         WHERE enriched=0 AND domain IS NOT NULL
         ORDER BY rating DESC
         LIMIT 50`,  // stay within free tier
        []
    );

    if (companies.length === 0) return res.json({ message: 'No companies to enrich' });

    Object.assign(apolloState, { running: true, cancelled: false, done: 0, total: companies.length, found: 0 });
    res.json({ message: 'Apollo enrichment started', total: companies.length });

    (async () => {
        for (const company of companies) {
            if (apolloState.cancelled) break;
            try {
                const people = await enrichWithApollo(company.domain, APOLLO_API_KEY);

                for (const person of people.slice(0, 5)) {
                    if (!isDecisionMaker(person.title)) continue;
                    if (!isPersonalEmail(person.email)) continue;

                    const candidate = {
                        name: person.name,
                        title: person.title,
                        email: person.email,
                        phone: person.phone_numbers?.[0]?.sanitized_number || null,
                    };
                    if (!passesGate(candidate)) continue;

                    const exists = await queryOne(
                        'SELECT id FROM contacts WHERE LOWER(email)=LOWER(?)',
                        [person.email]
                    );
                    if (exists) continue;

                    await run(
                        'INSERT INTO contacts (company_id, name, title, email, phone, email_status, source) VALUES (?,?,?,?,?,?,?)',
                        [
                            company.id, person.name, person.title, person.email,
                            candidate.phone,
                            person.email_status === 'verified' ? 'valid' : 'unverified',
                            'apollo',
                        ]
                    );
                    apolloState.found++;
                }

                await run('UPDATE companies SET enriched=1 WHERE id=?', [company.id]);
            } catch (err) {
                console.error(`Apollo error [${company.domain}]:`, err.message);
            }

            apolloState.done++;
            await new Promise(r => setTimeout(r, 350));
        }
        apolloState.running = false;
        console.log(`Apollo complete: ${apolloState.found} contacts found`);
    })();
});

router.get('/enrich/apollo/status', (req, res) => {
    const pct = apolloState.total
        ? Math.round((apolloState.done / apolloState.total) * 100) : 0;
    res.json({ ...apolloState, pct });
});

router.post('/enrich/apollo/cancel', (_req, res) => {
    if (apolloState.running) apolloState.cancelled = true;
    res.json({ ok: true });
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
router.post('/cleanup/dedupe', async (_req, res) => {
    try {
        let removed = 0;

        // Step 1a: emails starting with a digit (phone-number artifacts like "2840391info@...")
        const r1a = await run(
            `DELETE FROM contacts WHERE email IS NOT NULL AND email != '' AND email GLOB '[0-9]*'`, []
        );
        removed += Number(r1a.rowsAffected || 0);

        // Step 1b: local part longer than 40 chars (system IDs, hex tokens)
        const r1b = await run(
            `DELETE FROM contacts WHERE email IS NOT NULL AND email != '' AND INSTR(email,'@') > 41`, []
        );
        removed += Number(r1b.rowsAffected || 0);

        // Step 1c: blocked platform domains — one DELETE per domain (no large IN list)
        for (const domain of BLOCKED_EMAIL_DOMAINS) {
            const r = await run(`DELETE FROM contacts WHERE email LIKE ?`, [`%@${domain}`]);
            removed += Number(r.rowsAffected || 0);
            // also catch subdomains: %.wixpress.com
            const r2 = await run(`DELETE FROM contacts WHERE email LIKE ?`, [`%@%.${domain}`]);
            removed += Number(r2.rowsAffected || 0);
        }

        // Step 2: deduplicate — for each email group with >1 row, delete all but the lowest id
        const dupeGroups = await query(
            `SELECT LOWER(email) as email FROM contacts
             WHERE email IS NOT NULL AND email != ''
             GROUP BY LOWER(email) HAVING COUNT(*) > 1`, []
        );
        for (const row of dupeGroups) {
            const [keeper] = await query(
                `SELECT MIN(id) as id FROM contacts WHERE LOWER(email) = ?`, [row.email]
            );
            if (keeper?.id != null) {
                const r = await run(
                    `DELETE FROM contacts WHERE LOWER(email) = ? AND id != ?`,
                    [row.email, keeper.id]
                );
                removed += Number(r.rowsAffected || 0);
            }
        }

        // Step 3: contacts with no email AND no phone (unfindable)
        const r3 = await run(
            `DELETE FROM contacts WHERE (email IS NULL OR email = '') AND (phone IS NULL OR phone = '')`, []
        );
        removed += Number(r3.rowsAffected || 0);

        res.json({ ok: true, removed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
