const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const { query, run } = require('../database');
const { INDUSTRY_QUERIES } = require('../puller');

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [totals] = await query('SELECT COUNT(*) as companies FROM companies', []);
        const [ctotals] = await query('SELECT COUNT(*) as contacts FROM contacts', []);
        const [withEmail] = await query('SELECT COUNT(*) as n FROM contacts WHERE email IS NOT NULL', []);
        const [withPhone] = await query('SELECT COUNT(*) as n FROM contacts WHERE phone IS NOT NULL', []);
        const byIndustry = await query(
            `SELECT c.industry, COUNT(DISTINCT c.id) as companies, COUNT(co.id) as contacts
             FROM companies c LEFT JOIN contacts co ON co.company_id = c.id
             GROUP BY c.industry ORDER BY companies DESC`, []
        );
        const [coWithPhone] = await query('SELECT COUNT(*) as n FROM companies WHERE phone IS NOT NULL AND length(phone) > 0', []);
        const [coWithWebsite] = await query('SELECT COUNT(*) as n FROM companies WHERE website IS NOT NULL AND length(website) > 0', []);
        const [verifiedEmails] = await query("SELECT COUNT(*) as n FROM contacts WHERE email_status = 'valid'", []);
        const [avgScore] = await query('SELECT ROUND(AVG(lead_score)) as n FROM contacts WHERE lead_score > 0', []);
        res.json({
            totalCompanies: totals.companies,
            totalContacts: ctotals.contacts,
            contactsWithEmail: withEmail.n,
            contactsWithPhone: withPhone.n,
            companiesWithPhone: coWithPhone.n,
            companiesWithWebsite: coWithWebsite.n,
            verifiedEmails: verifiedEmails.n,
            avgLeadScore: avgScore.n || 0,
            byIndustry,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Contacts (main leads view) ────────────────────────────────────────────────
router.get('/contacts', async (req, res) => {
    try {
        const { search, industry, city, hasEmail, hasPhone, notContacted, hasVerified, sortBy, page = 1, limit = 50 } = req.query;
        const conditions = [];
        const args = [];

        if (search) {
            conditions.push('(co.name LIKE ? OR co.title LIKE ? OR c.name LIKE ?)');
            args.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (industry) { conditions.push('c.industry = ?'); args.push(industry); }
        if (city)     { conditions.push('c.city LIKE ?'); args.push(`%${city}%`); }
        if (hasEmail === 'true')  { conditions.push('co.email IS NOT NULL'); }
        if (hasPhone === 'true')  { conditions.push('co.phone IS NOT NULL'); }
        if (notContacted === 'true') { conditions.push('co.contacted = 0'); }
        if (hasVerified === 'true') { conditions.push("co.email_status = 'valid'"); }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (Number(page) - 1) * Number(limit);

        const orderBy = sortBy === 'score' ? 'co.lead_score DESC' : 'c.rating DESC, co.created_at DESC';
        const rows = await query(
            `SELECT co.id, co.name, co.title, co.email, co.email_status, co.phone,
                    co.source, co.contacted, co.created_at, co.lead_score,
                    c.id as company_id, c.name as company_name, c.website,
                    c.city, c.state, c.industry, c.rating, c.address
             FROM contacts co
             JOIN companies c ON c.id = co.company_id
             ${where}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`,
            [...args, Number(limit), offset]
        );

        const [countRow] = await query(
            `SELECT COUNT(*) as total FROM contacts co JOIN companies c ON c.id = co.company_id ${where}`,
            args
        );

        res.json({ data: rows, total: countRow.total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Export CSV ────────────────────────────────────────────────────────────────
router.get('/contacts/export', async (req, res) => {
    try {
        const { industry, city, hasEmail, hasPhone } = req.query;
        const conditions = [];
        const args = [];

        if (industry) { conditions.push('c.industry = ?'); args.push(industry); }
        if (city)     { conditions.push('c.city LIKE ?'); args.push(`%${city}%`); }
        if (hasEmail === 'true') { conditions.push('co.email IS NOT NULL'); }
        if (hasPhone === 'true') { conditions.push('co.phone IS NOT NULL'); }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const rows = await query(
            `SELECT c.name as "Company", c.website as "Website", c.city as "City",
                    c.industry as "Industry", c.rating as "Google Rating",
                    co.name as "Contact Name", co.title as "Title",
                    co.email as "Email", co.email_status as "Email Status",
                    co.phone as "Phone", co.source as "Source",
                    co.created_at as "Date Added"
             FROM contacts co JOIN companies c ON c.id = co.company_id
             ${where}
             ORDER BY c.rating DESC`,
            args
        );

        const parser = new Parser();
        const csv = parser.parse(rows);
        res.header('Content-Type', 'text/csv');
        res.attachment(`leads-${new Date().toISOString().slice(0, 10)}.csv`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Contact actions ───────────────────────────────────────────────────────────
router.put('/contacts/:id/contacted', async (req, res) => {
    try {
        const { contacted } = req.body;
        await run('UPDATE contacts SET contacted=? WHERE id=?', [contacted ? 1 : 0, req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Available industries for filter dropdowns
router.get('/industries', (_req, res) => {
    const industries = [...new Set(INDUSTRY_QUERIES.map(q => q.industry))];
    res.json(industries);
});

// Cities present in the DB (populated after a pull)
router.get('/cities', async (_req, res) => {
    try {
        const rows = await query(
            `SELECT DISTINCT city FROM companies
             WHERE city IS NOT NULL AND city != ''
             ORDER BY city ASC`,
            []
        );
        // Strip out anything that looks like an address rather than a city name:
        // no digits, no commas, not too long, not a state abbreviation fragment
        const cities = rows.map(r => r.city).filter(c =>
            !/\d/.test(c) &&          // no digits (rules out street numbers)
            !c.includes(',') &&       // no commas (rules out multi-part strings)
            c.length <= 40 &&         // not a full address line
            !/^NC\b/i.test(c)         // doesn't start with state abbreviation
        );
        res.json(cities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
