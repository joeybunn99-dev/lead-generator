const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getDb } = require('../database');
const { searchBusiness, extractContactInfo, bulkSearchCity } = require('../scraper');
const { validateEmail: verifyEmail } = require('../verifier');
const { Parser } = require('json2csv');

const N8N_WEBHOOK = 'https://jxbunn.app.n8n.cloud/webhook-test/3307c3cd-48b1-4f15-a2c8-21896cfab4be';

async function notifyWebhook(lead) {
    try {
        await axios.post(N8N_WEBHOOK, lead, { timeout: 5000 });
        console.log(`Webhook sent for: ${lead.business_name}`);
    } catch (e) {
        console.error('Webhook notification skipped (n8n not listening):', e.message);
    }
}

// GET all leads
router.get('/', (req, res) => {
    const db = getDb();
    db.all("SELECT * FROM leads ORDER BY created_at DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// POST search for leads
router.post('/search', async (req, res) => {
    const { keyword, location, verifyEmails } = req.body;
    const db = getDb();

    try {
        // 1. Check how many leads we already have for this city from bulk import
        const cityCount = await new Promise((resolve) => {
            db.get("SELECT COUNT(*) as cnt FROM leads WHERE city = ?", [location],
                (err, row) => resolve(row?.cnt || 0));
        });

        if (cityCount >= 20) {
            // ── Serve from local bulk-import database ──────────────────────
            // Extract meaningful keyword terms to filter business names
            const isGeneric = !keyword || /^local\s+business/i.test(keyword);

            let rows;
            if (isGeneric) {
                // Return everything for this city, best-scored first
                rows = await new Promise((resolve) => {
                    db.all(
                        `SELECT * FROM leads WHERE city = ?
                         ORDER BY lead_score DESC, contact_name IS NOT NULL DESC`,
                        [location],
                        (err, r) => resolve(r || [])
                    );
                });
            } else {
                // Pull search terms: words > 3 chars excluding filler words
                const STOP = new Set(['services','service','business','businesses',
                    'management','company','companies','local','from','with','and']);
                const terms = keyword.toLowerCase().split(/\s+/)
                    .filter(w => w.length > 3 && !STOP.has(w))
                    .slice(0, 4);

                if (terms.length === 0) {
                    rows = await new Promise((resolve) => {
                        db.all(
                            `SELECT * FROM leads WHERE city = ?
                             ORDER BY lead_score DESC`,
                            [location], (err, r) => resolve(r || [])
                        );
                    });
                } else {
                    // LIKE match on business name for any extracted term
                    const conditions = terms.map(() => 'business_name LIKE ?').join(' OR ');
                    const params = [...terms.map(t => `%${t}%`), location];
                    rows = await new Promise((resolve) => {
                        db.all(
                            `SELECT * FROM leads
                             WHERE city = ? AND (${conditions})
                             ORDER BY lead_score DESC`,
                            [location, ...terms.map(t => `%${t}%`)],
                            (err, r) => resolve(r || [])
                        );
                    });
                }
            }

            console.log(`Quick Search (local DB): ${rows.length} leads for ${location}`);
            return res.json({
                message: `Search completed (${cityCount} leads in local database)`,
                new_leads: 0,
                data: rows
            });
        }

        // 2. City not in bulk DB yet — fall back to live Google Places search
        const googleQuery = `${keyword} in ${location}`;
        const businesses = await searchBusiness(googleQuery);
        const leads = [];

        // On Netlify (serverless), skip website scraping to stay within 10s timeout.
        // Google Places already provides name, address, phone, website, and rating.
        const isNetlify = !!process.env.NETLIFY;

        for (const biz of businesses) {
            // Deduplicate — by website if present, else by business name
            const existingRow = await new Promise((resolve) => {
                if (biz.url) {
                    db.get("SELECT * FROM leads WHERE website = ?", [biz.url], (err, row) => resolve(row || null));
                } else {
                    db.get("SELECT * FROM leads WHERE business_name = ? AND city = ?", [biz.name, location], (err, row) => resolve(row || null));
                }
            });
            if (existingRow) {
                leads.push(existingRow);
                continue;
            }

            let email = null, phone = biz.phone_preview || null, isVerified = false;
            let address = biz.address || null;

            if (!isNetlify) {
                // Full scrape — only runs on local / Railway server
                const contact = await extractContactInfo(biz.url);
                phone = contact.phones[0] || phone;
                address = contact.address || address;

                const SKIP_PREFIXES = ['info', 'contact', 'support', 'admin', 'hello', 'sales', 'office', 'noreply', 'no-reply'];
                const filteredEmails = contact.emails.filter(e => {
                    const local = e.split('@')[0].toLowerCase();
                    return !SKIP_PREFIXES.some(p => local === p || local.startsWith(p + '.'));
                });
                email = filteredEmails[0] || null;

                if (email && verifyEmails) {
                    const verification = await verifyEmail(email, biz.url);
                    isVerified = verification.status === 'Valid';
                }
            }

            const newLead = {
                business_name:  biz.name,
                website:        biz.url || null,
                email,
                phone,
                address,
                city:           location,
                rating:         biz.rating,
                verified_email: isVerified,
                lead_score:     biz.rating ? Math.round(biz.rating * 10) : 0,
                source:         'Quick Search',
                timestamp:      new Date().toISOString()
            };

            db.run(
                `INSERT INTO leads (business_name, website, email, phone, city, verified_email, address, source, lead_score)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newLead.business_name, newLead.website, newLead.email, newLead.phone, newLead.city,
                 isVerified ? 1 : 0, newLead.address, newLead.source, newLead.lead_score]
            );

            notifyWebhook(newLead);
            leads.push(newLead);
        }

        res.json({ message: 'Search completed', new_leads: leads.length, data: leads });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// GET Export CSV
router.get('/export', (req, res) => {
    const db = getDb();
    db.all("SELECT * FROM leads", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        try {
            const parser = new Parser();
            const csv = parser.parse(rows);
            res.header('Content-Type', 'text/csv');
            res.attachment('leads.csv');
            return res.send(csv);
        } catch (e) {
            return res.status(500).json({ error: 'CSV generation failed' });
        }
    });
});

// POST Discovery Search
router.post('/discovery', async (req, res) => {
    const { type, value } = req.body; // type: 'location' or 'category'
    const db = getDb();
    const { discoverByCategory, discoverByLocation } = require('../discovery');
    const { extractContactInfo } = require('../scraper');
    const { validateEmail } = require('../verifier');
    const { calculateScore } = require('../scorer');

    try {
        // BATCH PROCESSING LOGIC
        // Split value by comma if present
        const inputs = value.split(',').map(s => s.trim()).filter(s => s.length > 0);

        let allNewLeads = [];
        let totalFound = 0;

        for (const inputVal of inputs) {
            let businesses = [];
            if (type === 'category') {
                businesses = await discoverByCategory(inputVal);
            } else {
                businesses = await discoverByLocation(inputVal);
            }

            // Save to History
            db.run("INSERT INTO search_history (query_type, query_value, leads_found) VALUES (?, ?, ?)",
                [type, inputVal, businesses.length]);

            const targets = businesses.slice(0, 5); // Limit per batch item to avoid timeouts

            for (const biz of targets) {
                const contact = await extractContactInfo(biz.url);

                // ... (Existing Processing Logic) ...

                // Email Prioritization Logic
                let allEmails = contact.emails;
                let bestEmail = null;

                if (allEmails.length > 0) {
                    const roles = ['info', 'contact', 'support', 'admin', 'hello', 'sales', 'office'];
                    const personalEmail = allEmails.find(e => {
                        const local = e.split('@')[0];
                        return local.includes('.') && !roles.some(r => local.includes(r));
                    });
                    bestEmail = personalEmail || allEmails[0];
                }

                let phone = contact.phones[0] || biz.phone_preview || null;

                // Save to DB Check
                const exists = await new Promise((resolve) => {
                    db.get("SELECT id FROM leads WHERE website = ?", [biz.url], (err, row) => resolve(!!row));
                });

                if (!exists) {
                    // Verify
                    let verificationStatus = 'Unverified';
                    let isStored = false;

                    if (bestEmail) {
                        const v = await validateEmail(bestEmail, biz.url);
                        verificationStatus = v.status;

                        if (verificationStatus === 'Valid') {
                            isStored = true;
                        } else {
                            console.log(`Skipping ${bestEmail}: ${v.reason}`);
                        }
                    }

                    // Score
                    const score = calculateScore({
                        website: biz.url,
                        verification_status: verificationStatus,
                        people: contact.people,
                        rating: biz.rating,
                        employees_count: 0
                    });

                    // Parse Contact
                    let contactName = null;
                    let jobTitle = null;
                    if (contact.people.length > 0) {
                        const person = contact.people[0];
                        const separatorRegex = /[\s-]+(CEO|Chief|Founder|Owner|President|Director|Manager|VP|Head|Partner|Principal)/i;
                        const match = person.match(separatorRegex);
                        if (match) {
                            const splitIdx = match.index;
                            contactName = person.substring(0, splitIdx).trim().replace(/[-,\s]+$/, '');
                            jobTitle = person.substring(splitIdx).trim().replace(/^[-,\s]+/, '');
                        } else {
                            contactName = person;
                            jobTitle = "Decision Maker";
                        }
                    }

                    if (isStored) {
                        db.run(`INSERT INTO leads (business_name, website, email, phone, city, verified_email, source, best_email, people, verification_status, lead_score, address, contact_name, job_title, email_verification_status) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                biz.name, biz.url, allEmails.join(','), phone, 'Discovery', 1, 'Discovery Module',
                                bestEmail, JSON.stringify(contact.people), verificationStatus, score,
                                contact.address || biz.snippet || null, contactName, jobTitle, verificationStatus
                            ]
                        );

                        const newLead = {
                            business_name: biz.name,
                            website: biz.url,
                            email: bestEmail,
                            phone,
                            verified_email: true,
                            people: contact.people,
                            verification_status: verificationStatus,
                            lead_score: score,
                            contact_name: contactName,
                            job_title: jobTitle,
                            city: 'Discovery'
                        };
                        allNewLeads.push(newLead);
                    }
                }
            }
            totalFound += allNewLeads.length;
        }

        res.json({ message: 'Discovery completed', count: allNewLeads.length, data: allNewLeads });

    } catch (error) {
        console.error("Discovery error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ── Bulk Import ─────────────────────────────────────────────────────────────
const NC_CITIES = [
    'Aberdeen','Apex','Archdale','Asheboro','Asheville','Atlantic Beach','Ayden',
    'Beaufort','Belmont','Black Mountain','Boiling Spring Lakes','Boone','Brevard',
    'Burlington','Butner','Carrboro','Cary','Chapel Hill','Charlotte','Clayton',
    'Clemmons','Clinton','Concord','Cornelius','Davidson','Dunn','Durham','Eden',
    'Elizabeth City','Elizabethtown','Elon','Fayetteville','Fuquay-Varina','Garner',
    'Gastonia','Goldsboro','Graham','Greensboro','Greenville','Harrisburg','Henderson',
    'Hendersonville','Hickory','High Point','Holly Springs','Hope Mills','Huntersville',
    'Indian Trail','Jacksonville','Kannapolis','Kernersville','Kings Mountain','Kinston',
    'Knightdale','Laurinburg','Leland','Lenoir','Lewisville','Lexington','Lillington',
    'Lincolnton','Lumberton','Marion','Matthews','Mebane','Mint Hill','Monroe',
    'Mooresville','Morehead City','Morganton','Morrisville','Mount Airy','Mount Holly',
    'Murfreesboro','New Bern','Newton','Oxford','Pinehurst','Pineville','Pittsboro',
    'Raleigh','Roanoke Rapids','Rockingham','Rocky Mount','Rolesville','Roxboro',
    'Salisbury','Sanford','Selma','Shelby','Siler City','Smithfield','Southern Pines',
    'Southport','Spring Lake','Stallings','Statesville','Tarboro','Thomasville',
    'Wake Forest','Waxhaw','Waynesville','Wendell','Whiteville','Williamston',
    'Wilmington','Wilson','Winston-Salem','Winterville','Zebulon'
];

const importState = { running: false, done: 0, total: 0, added: 0, skipped: 0, errors: 0 };

router.get('/bulk-import/status', (req, res) => {
    res.json(importState);
});

router.post('/bulk-import', async (req, res) => {
    if (importState.running) {
        return res.json({ message: 'Import already running', state: importState });
    }
    const db = getDb();
    Object.assign(importState, { running: true, done: 0, total: NC_CITIES.length, added: 0, skipped: 0, errors: 0 });
    res.json({ message: 'Bulk import started', total_cities: NC_CITIES.length });

    // Run in background
    (async () => {
        for (const city of NC_CITIES) {
            try {
                const businesses = await bulkSearchCity(`${city}, NC`);
                for (const biz of businesses) {
                    const exists = await new Promise(resolve =>
                        db.get("SELECT id FROM leads WHERE business_name = ? AND city = ?",
                            [biz.name, `${city}, NC`], (err, row) => resolve(!!row))
                    );
                    if (exists) { importState.skipped++; continue; }
                    await new Promise(resolve =>
                        db.run(
                            `INSERT INTO leads (business_name, website, phone, city, address, rating, source, lead_score)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [biz.name, null, null, `${city}, NC`, biz.address, biz.rating,
                             'Bulk Import', biz.rating ? Math.round(biz.rating * 10) : 0],
                            resolve
                        )
                    );
                    importState.added++;
                }
            } catch (e) {
                importState.errors++;
                console.error(`Bulk import error for ${city}:`, e.message);
            }
            importState.done++;
            // Small delay to respect Google rate limits
            await new Promise(r => setTimeout(r, 300));
        }
        importState.running = false;
        console.log(`Bulk import complete: ${importState.added} added, ${importState.skipped} skipped`);
    })();
});

// ── Apollo.io Enrichment ─────────────────────────────────────────────────────
const enrichState = { running: false, done: 0, total: 0, enriched: 0, skipped: 0, errors: 0 };

router.get('/enrich/status', (req, res) => {
    res.json(enrichState);
});

router.post('/enrich', async (req, res) => {
    if (enrichState.running) {
        return res.json({ message: 'Enrichment already running', state: enrichState });
    }

    const { APOLLO_API_KEY: configKey } = require('../config');
    const apolloKey = req.body.apolloKey || configKey;
    if (!apolloKey) {
        return res.status(400).json({ error: 'Apollo API key required' });
    }

    const db = getDb();
    const { enrichWithApollo, extractDomain } = require('../enricher');

    // Find leads with a website but no contact name yet
    const leads = await new Promise((resolve, reject) => {
        db.all(
            `SELECT id, website FROM leads
             WHERE website IS NOT NULL
               AND (contact_name IS NULL OR contact_name = '')
             ORDER BY lead_score DESC`,
            [],
            (err, rows) => err ? reject(err) : resolve(rows)
        );
    });

    if (leads.length === 0) {
        return res.json({ message: 'No leads need enrichment', enriched: 0 });
    }

    Object.assign(enrichState, {
        running: true, done: 0, total: leads.length,
        enriched: 0, skipped: 0, errors: 0
    });
    res.json({ message: 'Enrichment started', total: leads.length });

    // Run in background
    (async () => {
        for (const lead of leads) {
            try {
                const domain = extractDomain(lead.website);
                if (!domain) { enrichState.skipped++; enrichState.done++; continue; }

                const people = await enrichWithApollo(domain, apolloKey);

                if (people.length > 0) {
                    const person = people[0];
                    const contactName = person.name || null;
                    const jobTitle    = person.title || null;
                    const bestEmail   = person.email || null;
                    const apolloPhone = person.phone_numbers?.[0]?.sanitized_number || null;
                    const isVerified  = person.email_status === 'verified';

                    await new Promise(resolve => {
                        db.run(
                            `UPDATE leads SET
                                contact_name       = ?,
                                job_title          = ?,
                                best_email         = ?,
                                verified_email     = ?,
                                verification_status= ?,
                                phone = CASE WHEN (phone IS NULL OR phone = '') THEN ? ELSE phone END
                             WHERE id = ?`,
                            [contactName, jobTitle, bestEmail,
                             isVerified ? 1 : 0,
                             isVerified ? 'Valid' : 'Unverified',
                             apolloPhone, lead.id],
                            resolve
                        );
                    });
                    enrichState.enriched++;
                } else {
                    enrichState.skipped++;
                }
            } catch (e) {
                console.error(`Apollo enrich error for lead ${lead.id}:`, e.message);
                enrichState.errors++;
            }
            enrichState.done++;
            // Respect Apollo rate limits (200 req/min)
            await new Promise(r => setTimeout(r, 350));
        }
        enrichState.running = false;
        console.log(`Apollo enrichment complete: ${enrichState.enriched} enriched, ${enrichState.skipped} skipped`);
    })();
});

router.get('/history', (req, res) => {
    const db = getDb();
    db.all("SELECT * FROM search_history ORDER BY timestamp DESC LIMIT 20", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

router.put('/:id/contacted', (req, res) => {
    const { contacted } = req.body;
    const db = getDb();
    db.run("UPDATE leads SET contacted = ? WHERE id = ?", [contacted ? 1 : 0, req.params.id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Updated contacted status', contacted });
    });
});

module.exports = router;
