const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database');
const { extractContactInfo } = require('../scraper');
const { enrichWithApollo } = require('../enricher');
const { APOLLO_API_KEY } = require('../config');
const { isDecisionMaker, isPersonalEmail, passesGate, parsePerson, BLOCKED_EMAIL_DOMAINS } = require('../lib/quality-gate');
const { validateEmail } = require('../verifier');
const { calculateScore } = require('../scorer');
const { scrapeWithFirecrawl } = require('../lib/firecrawl-scraper');

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
                // Use Firecrawl (falls back to Cheerio automatically)
                const contact = await scrapeWithFirecrawl(company.website);

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

                // Track inserted contact IDs for post-processing
                const insertedContactIds = [];

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

                    const result = await run(
                        'INSERT INTO contacts (company_id, name, title, email, phone, source) VALUES (?,?,?,?,?,?)',
                        [company.id, parsed.name, parsed.title, email, phone, 'scraped']
                    );
                    if (result.lastID) insertedContactIds.push({ id: result.lastID, email, phone });
                    scrapeState.found++;
                }

                // Post-processing: verify emails and score contacts
                const peopleCount = insertedContactIds.length;
                for (const c of insertedContactIds) {
                    // Email verification
                    let emailStatus = 'unverified';
                    if (c.email) {
                        try {
                            const vResult = await validateEmail(c.email, company.website || company.domain || '');
                            emailStatus = vResult.status.toLowerCase();
                        } catch (e) {
                            // Keep unverified on error
                        }
                        await run('UPDATE contacts SET email_status = ? WHERE id = ?', [emailStatus, c.id]);
                    }

                    // Lead scoring
                    const score = calculateScore({
                        website: company.website,
                        verification_status: emailStatus === 'valid' ? 'Valid' : emailStatus,
                        people: peopleCount > 0 ? new Array(peopleCount) : [],
                        rating: company.rating,
                    });
                    await run('UPDATE contacts SET lead_score = ? WHERE id = ?', [score, c.id]);
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

// ── Backfill: score all existing contacts + verify emails ────────────────────
router.post('/admin/backfill', async (req, res) => {
    try {
        const contacts = await query(`
            SELECT co.id, co.email, co.email_status, co.name, co.title,
                   c.website, c.rating, c.domain,
                   (SELECT COUNT(*) FROM contacts WHERE company_id = c.id) as people_count
            FROM contacts co
            JOIN companies c ON c.id = co.company_id
        `);

        let verified = 0, scored = 0;

        for (const contact of contacts) {
            // Verify email if unverified
            if (contact.email && contact.email_status === 'unverified') {
                try {
                    const result = await validateEmail(contact.email, contact.website || contact.domain || '');
                    await run('UPDATE contacts SET email_status = ? WHERE id = ?', [result.status.toLowerCase(), contact.id]);
                    contact.email_status = result.status.toLowerCase();
                    verified++;
                } catch (e) {
                    // Skip on error
                }
            }

            // Calculate score
            const score = calculateScore({
                website: contact.website,
                verification_status: contact.email_status === 'valid' ? 'Valid' : contact.email_status,
                people: contact.people_count > 0 ? new Array(contact.people_count) : [],
                rating: contact.rating,
            });
            await run('UPDATE contacts SET lead_score = ? WHERE id = ?', [score, contact.id]);
            scored++;
        }

        res.json({ ok: true, verified, scored, total: contacts.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Cleanup: cross-source deduplication ──────────────────────────────────────
router.post('/cleanup/dedupe', async (_req, res) => {
    try {
        let companiesMerged = 0, contactsDeduped = 0, contactsRemoved = 0;

        // Step 0: Clean junk emails (digit-prefixed, long local parts, blocked domains)
        const r0a = await run(
            `DELETE FROM contacts WHERE email IS NOT NULL AND email != '' AND email GLOB '[0-9]*'`, []
        );
        contactsRemoved += Number(r0a.rowsAffected || 0);

        const r0b = await run(
            `DELETE FROM contacts WHERE email IS NOT NULL AND email != '' AND INSTR(email,'@') > 41`, []
        );
        contactsRemoved += Number(r0b.rowsAffected || 0);

        for (const domain of BLOCKED_EMAIL_DOMAINS) {
            const r = await run(`DELETE FROM contacts WHERE email LIKE ?`, [`%@${domain}`]);
            contactsRemoved += Number(r.rowsAffected || 0);
            const r2 = await run(`DELETE FROM contacts WHERE email LIKE ?`, [`%@%.${domain}`]);
            contactsRemoved += Number(r2.rowsAffected || 0);
        }

        // Step 1: Company-level dedup by domain
        const withDomain = await query(`
            SELECT domain, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
            FROM companies
            WHERE domain IS NOT NULL AND domain != ''
            GROUP BY domain
            HAVING cnt > 1
        `);

        for (const group of withDomain) {
            const ids = group.ids.split(',').map(Number);
            // Find winner: most populated fields
            const companies = await query(
                `SELECT *,
                    (CASE WHEN website IS NOT NULL AND website != '' THEN 1 ELSE 0 END +
                     CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END +
                     CASE WHEN address IS NOT NULL AND address != '' THEN 1 ELSE 0 END +
                     CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) as field_count
                FROM companies WHERE id IN (${ids.join(',')})
                ORDER BY field_count DESC, id ASC`
            );

            const winner = companies[0];
            const losers = companies.slice(1);

            for (const loser of losers) {
                // Merge missing fields into winner
                const updates = [];
                const args = [];
                for (const field of ['website', 'phone', 'address', 'rating', 'lat', 'lng']) {
                    if (!winner[field] && loser[field]) {
                        updates.push(`${field} = ?`);
                        args.push(loser[field]);
                    }
                }
                if (updates.length > 0) {
                    await run(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`, [...args, winner.id]);
                }

                // Reassign contacts from loser to winner
                await run('UPDATE contacts SET company_id = ? WHERE company_id = ?', [winner.id, loser.id]);
                // Delete loser company
                await run('DELETE FROM companies WHERE id = ?', [loser.id]);
                companiesMerged++;
            }
        }

        // Step 2: Contact-level dedup by email
        const dupEmails = await query(`
            SELECT LOWER(email) as email, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
            FROM contacts
            WHERE email IS NOT NULL AND email != ''
            GROUP BY LOWER(email)
            HAVING cnt > 1
        `);

        for (const group of dupEmails) {
            const ids = group.ids.split(',').map(Number);
            const keepId = Math.min(...ids);
            const deleteIds = ids.filter(id => id !== keepId);
            for (const id of deleteIds) {
                await run('DELETE FROM contacts WHERE id = ?', [id]);
                contactsDeduped++;
            }
        }

        // Step 3: Remove contacts with no email AND no phone
        const r3 = await run(
            `DELETE FROM contacts WHERE (email IS NULL OR email = '') AND (phone IS NULL OR phone = '')`, []
        );
        contactsRemoved += Number(r3.rowsAffected || 0);

        res.json({ ok: true, companiesMerged, contactsDeduped, contactsRemoved });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
