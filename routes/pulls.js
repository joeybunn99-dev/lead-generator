const express = require('express');
const router = express.Router();
const { run } = require('../database');
const { runPullJob, getPullState, cancelPullJob,
        runFoursquarePull, getFoursquareState, cancelFoursquarePull,
        runOsmPull, getOsmState, cancelOsmPull } = require('../puller');

// ── Google Places pull ──────────────────────────────────────────────────────
router.post('/pull', async (req, res) => {
    const state = getPullState();
    if (state.running) return res.json({ message: 'Pull already running', state });

    const { industries, radius = 300 } = req.body;
    const result = await run(
        "INSERT INTO pull_jobs (status) VALUES ('running')", []
    );
    const jobId = Number(result.lastInsertRowid);

    res.json({ message: 'Pull started', jobId, queriesTotal: 0 });

    // Run in background
    runPullJob(jobId, industries || null, Number(radius)).catch(err => {
        console.error('Pull job failed:', err.message);
    });
});

router.get('/pull/status', (req, res) => {
    const state = getPullState();
    const pct = state.queriesTotal
        ? Math.round((state.queriesDone / state.queriesTotal) * 100)
        : 0;
    res.json({ ...state, pct });
});

router.post('/pull/cancel', (_req, res) => {
    cancelPullJob();
    res.json({ ok: true });
});

// ── Foursquare pull ────────────────────────────────────────────────────────────
router.post('/pull/foursquare', async (req, res) => {
    const state = getFoursquareState();
    if (state.running) return res.json({ message: 'Foursquare pull already running', state });

    const { industries, radius = 300 } = req.body;
    res.json({ message: 'Foursquare pull started' });

    runFoursquarePull(industries || null, Number(radius)).catch(err => {
        console.error('Foursquare pull failed:', err.message);
    });
});

router.get('/pull/foursquare/status', (_req, res) => {
    const state = getFoursquareState();
    const pct = state.queriesTotal
        ? Math.round((state.queriesDone / state.queriesTotal) * 100)
        : 0;
    res.json({ ...state, pct });
});

router.post('/pull/foursquare/cancel', (_req, res) => {
    cancelFoursquarePull();
    res.json({ ok: true });
});

// ── OpenStreetMap pull ─────────────────────────────────────────────────────────
router.post('/pull/osm', async (req, res) => {
    const state = getOsmState();
    if (state.running) return res.json({ message: 'OSM pull already running', state });

    const { industries } = req.body;
    res.json({ message: 'OSM pull started' });

    runOsmPull(industries || null).catch(err => {
        console.error('OSM pull failed:', err.message);
    });
});

router.get('/pull/osm/status', (_req, res) => {
    const state = getOsmState();
    const pct = state.queriesTotal
        ? Math.round((state.queriesDone / state.queriesTotal) * 100)
        : 0;
    res.json({ ...state, pct });
});

router.post('/pull/osm/cancel', (_req, res) => {
    cancelOsmPull();
    res.json({ ok: true });
});

module.exports = router;
