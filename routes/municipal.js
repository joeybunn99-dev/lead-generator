const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database');

// Stats
router.get('/municipal/stats', async (req, res) => {
    try {
        const total = await queryOne('SELECT COUNT(*) as c FROM municipalities');
        const scraped = await queryOne('SELECT COUNT(*) as c FROM municipalities WHERE scraped = 1');
        const contacts = await queryOne('SELECT COUNT(*) as c FROM municipal_contacts');
        const withEmail = await queryOne("SELECT COUNT(*) as c FROM municipal_contacts WHERE email IS NOT NULL AND email != ''");
        const withPhone = await queryOne("SELECT COUNT(*) as c FROM municipal_contacts WHERE phone IS NOT NULL AND phone != ''");
        const high = await queryOne("SELECT COUNT(*) as c FROM municipal_contacts WHERE relevance = 'high'");
        const medium = await queryOne("SELECT COUNT(*) as c FROM municipal_contacts WHERE relevance = 'medium'");
        const low = await queryOne("SELECT COUNT(*) as c FROM municipal_contacts WHERE relevance = 'low'");
        const counties = await query('SELECT DISTINCT county FROM municipalities WHERE county IS NOT NULL ORDER BY county');
        res.json({
            municipalities: total.c,
            scraped: scraped.c,
            contacts: contacts.c,
            withEmail: withEmail.c,
            withPhone: withPhone.c,
            high: high.c,
            medium: medium.c,
            low: low.c,
            counties: counties.map(r => r.county)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List contacts with filters
router.get('/municipal/contacts', async (req, res) => {
    try {
        const { county, relevance, type, search, contacted, limit = 100, offset = 0 } = req.query;
        let where = [];
        let args = [];

        if (county) { where.push('m.county = ?'); args.push(county); }
        if (relevance) { where.push('mc.relevance = ?'); args.push(relevance); }
        if (type) { where.push('m.type = ?'); args.push(type); }
        if (contacted === '1') { where.push('mc.contacted = 1'); }
        if (contacted === '0') { where.push('mc.contacted = 0'); }
        if (search) {
            where.push("(mc.name LIKE ? OR mc.title LIKE ? OR mc.email LIKE ? OR m.name LIKE ? OR mc.department LIKE ?)");
            const s = '%' + search + '%';
            args.push(s, s, s, s, s);
        }

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const countSql = `SELECT COUNT(*) as c FROM municipal_contacts mc JOIN municipalities m ON mc.municipality_id = m.id ${whereClause}`;
        const total = await queryOne(countSql, args);

        const sql = `SELECT mc.*, m.name as municipality, m.type as muni_type, m.county, m.website as muni_website
            FROM municipal_contacts mc
            JOIN municipalities m ON mc.municipality_id = m.id
            ${whereClause}
            ORDER BY
                CASE mc.relevance WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                m.name
            LIMIT ? OFFSET ?`;
        args.push(Number(limit), Number(offset));
        const rows = await query(sql, args);

        res.json({ total: total.c, contacts: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List municipalities
router.get('/municipal/municipalities', async (req, res) => {
    try {
        const rows = await query(`SELECT m.*,
            (SELECT COUNT(*) FROM municipal_contacts WHERE municipality_id = m.id) as contact_count,
            (SELECT COUNT(*) FROM municipal_contacts WHERE municipality_id = m.id AND email IS NOT NULL AND email != '') as email_count
            FROM municipalities m ORDER BY m.name`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export CSV
router.get('/municipal/export', async (req, res) => {
    try {
        const { relevance } = req.query;
        let where = "WHERE mc.email IS NOT NULL AND mc.email != ''";
        let args = [];
        if (relevance) { where += ' AND mc.relevance = ?'; args.push(relevance); }

        const rows = await query(`SELECT m.name as municipality, m.type as muni_type, m.county,
            mc.name, mc.title, mc.department, mc.email, mc.phone, mc.relevance
            FROM municipal_contacts mc
            JOIN municipalities m ON mc.municipality_id = m.id
            ${where}
            ORDER BY m.county, m.name, mc.relevance`, args);

        const header = 'Municipality,Type,County,Contact Name,Title,Department,Email,Phone,Relevance\n';
        const csv = header + rows.map(r =>
            [r.municipality, r.muni_type, r.county, r.name, r.title, r.department, r.email, r.phone, r.relevance]
                .map(v => '"' + (v || '').replace(/"/g, '""') + '"').join(',')
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=municipal-contacts.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trigger scrape
router.post('/municipal/scrape', async (req, res) => {
    try {
        const { spawn } = require('child_process');
        const child = spawn('node', ['municipal-scraper.js'], {
            cwd: require('path').join(__dirname, '..'),
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
        res.json({ status: 'started', pid: child.pid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark contacted
router.post('/municipal/contacts/:id/contacted', async (req, res) => {
    try {
        await run('UPDATE municipal_contacts SET contacted = 1 WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
