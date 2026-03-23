const express = require('express');
const router = express.Router();
const { query, run } = require('../database');
const { extractDomain } = require('../enricher');

// ── Companies ─────────────────────────────────────────────────────────────────
router.get('/companies', async (req, res) => {
    try {
        const { industry, city, page = 1, limit = 50 } = req.query;
        const conditions = [];
        const args = [];

        if (industry) { conditions.push('industry = ?'); args.push(industry); }
        if (city)     { conditions.push('city LIKE ?'); args.push(`%${city}%`); }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (Number(page) - 1) * Number(limit);

        const rows = await query(
            `SELECT c.*, COUNT(co.id) as contact_count
             FROM companies c LEFT JOIN contacts co ON co.company_id = c.id
             ${where}
             GROUP BY c.id
             ORDER BY c.rating DESC, c.name ASC
             LIMIT ? OFFSET ?`,
            [...args, Number(limit), offset]
        );

        const [countRow] = await query(
            `SELECT COUNT(*) as total FROM companies ${where}`, args
        );

        res.json({ data: rows, total: countRow.total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET contacts for a single company
router.get('/companies/:id/contacts', async (req, res) => {
    try {
        const rows = await query('SELECT * FROM contacts WHERE company_id=? ORDER BY created_at', [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a company (cascades to contacts)
router.delete('/companies/:id', async (req, res) => {
    try {
        await run('DELETE FROM companies WHERE id=?', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── CSV Import ─────────────────────────────────────────────────────────────────
// Accepts array of { name, city, state, industry, website, phone }
router.post('/companies/import', async (req, res) => {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected JSON array' });

    let inserted = 0;
    for (const row of rows) {
        if (!row.name || row.name.length < 2) continue;
        const placeId = `csv:${encodeURIComponent(row.name.toLowerCase().trim())}`;
        const website = row.website || null;
        const domain = extractDomain(website);
        const result = await run(
            `INSERT OR IGNORE INTO companies
             (place_id, name, city, state, industry, website, domain, phone, google_types)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                placeId, row.name.trim(),
                row.city || '', row.state || 'NC',
                row.industry || '',
                website, domain,
                row.phone || null,
                JSON.stringify(['csv']),
            ]
        );
        if (result && result.changes) inserted++;
    }
    res.json({ inserted, total: rows.length });
});

module.exports = router;
