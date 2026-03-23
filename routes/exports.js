const express = require('express');
const router = express.Router();
const axios = require('axios');
const { query } = require('../database');
const { N8N_WEBHOOK_URL, BUNNCOMM_API } = require('../config');

// ── Export to Google Sheets via n8n ───────────────────────────────────────────
router.post('/export/sheets', async (req, res) => {
    if (!N8N_WEBHOOK_URL) {
        return res.status(400).json({ error: 'N8N_WEBHOOK_URL is not set in config.js. Import n8n-lead-export.json into n8n, activate the workflow, then paste the webhook URL into config.js.' });
    }

    try {
        const rows = await query(
            `SELECT co.id, co.name as contact_name, co.title, co.email, co.email_status,
                    co.phone, co.source, co.contacted, co.created_at as date_added,
                    c.name as company, c.website, c.city, c.state, c.industry, c.rating
             FROM contacts co
             JOIN companies c ON c.id = co.company_id
             ORDER BY c.rating DESC, co.created_at DESC`,
            []
        );

        const leads = rows.map(r => ({
            id:           r.id,
            company:      r.company      || '',
            contact_name: r.contact_name || '',
            title:        r.title        || '',
            email:        r.email        || '',
            email_status: r.email_status || '',
            phone:        r.phone        || '',
            city:         r.city         || '',
            state:        r.state        || '',
            industry:     r.industry     || '',
            website:      r.website      || '',
            rating:       r.rating       || '',
            source:       r.source       || '',
            contacted:    r.contacted ? 'Yes' : 'No',
            date_added:   r.date_added   || '',
        }));

        await axios.post(N8N_WEBHOOK_URL, { leads }, { timeout: 30000 });
        res.json({ ok: true, count: leads.length });
    } catch (err) {
        res.status(500).json({ error: `Export failed: ${err.message}` });
    }
});

// ── Website Leads (from BunnComm savings calculator) ──
router.get('/website-leads', async (req, res) => {
    try {
        const response = await axios.get(`${BUNNCOMM_API}/api/leads`);
        res.json(response.data);
    } catch (err) {
        // If BunnComm server isn't reachable, return empty
        res.json([]);
    }
});

router.get('/website-leads/stats', async (req, res) => {
    try {
        const response = await axios.get(`${BUNNCOMM_API}/api/leads/stats`);
        res.json(response.data);
    } catch (err) {
        res.json({ total: 0, today: 0, uncontacted: 0, avgSavings: 0 });
    }
});

router.patch('/website-leads/:id', async (req, res) => {
    try {
        const response = await axios.patch(`${BUNNCOMM_API}/api/leads/${req.params.id}`, req.body);
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
