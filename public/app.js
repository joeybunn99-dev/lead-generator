document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('dashboard-tab')) return;

    // ══════════════════════════════════════
    // LOGIN
    // ══════════════════════════════════════
    const loginOverlay = document.getElementById('login-overlay');

    if (sessionStorage.getItem('auth_token')) {
        if (loginOverlay) loginOverlay.style.display = 'none';
    }

    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        if (user === 'admin' && pass === 'password') {
            sessionStorage.setItem('auth_token', 'valid');
            if (loginOverlay) loginOverlay.style.display = 'none';
        } else {
            alert('Invalid credentials. Try admin / password');
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        sessionStorage.removeItem('auth_token');
        if (loginOverlay) loginOverlay.style.display = 'flex';
    });

    // ── Admin Settings Modal ──────────────────────────────
    const settingsModal = document.getElementById('settings-modal');

    function openSettings() {
        // Pre-fill Apollo key from localStorage
        const saved = localStorage.getItem('apollo_api_key') || '';
        const keyInput = document.getElementById('settings-apollo-key');
        if (keyInput) keyInput.value = saved;
        document.getElementById('logo-upload-status').textContent = '';
        settingsModal.style.display = 'flex';
    }
    function closeSettings() {
        settingsModal.style.display = 'none';
    }

    document.getElementById('admin-settings-btn')?.addEventListener('click', openSettings);
    document.getElementById('settings-close-btn')?.addEventListener('click', closeSettings);
    document.getElementById('settings-cancel-btn')?.addEventListener('click', closeSettings);

    // Close on backdrop click
    settingsModal?.addEventListener('click', e => {
        if (e.target === settingsModal) closeSettings();
    });

    // Logo upload via modal
    document.getElementById('settings-logo-btn')?.addEventListener('click', () => {
        document.getElementById('logo-upload').click();
    });

    document.getElementById('logo-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const statusEl = document.getElementById('logo-upload-status');
        statusEl.textContent = 'Uploading…';
        await fetch('/api/settings/logo', { method: 'POST', body: file });
        document.querySelectorAll('.brand-logo, .login-logo').forEach(img => {
            img.src = '/logo.webp?' + Date.now();
        });
        statusEl.textContent = 'Logo updated!';
    });

    // Save settings (Apollo key)
    document.getElementById('settings-save-btn')?.addEventListener('click', () => {
        const key = document.getElementById('settings-apollo-key').value.trim();
        if (key) {
            localStorage.setItem('apollo_api_key', key);
            // Also update the dashboard enrichment input if visible
            const dashInput = document.getElementById('apollo-key-input');
            if (dashInput) dashInput.value = key;
        }
        closeSettings();
    });

    // ══════════════════════════════════════
    // TAB SWITCHING
    // ══════════════════════════════════════
    const PAGE_META = {
        dashboard: ['Lead Generation Engine', 'Identify, verify, and close B2B prospects.'],
        generate:  ['Generate Leads', 'Find and qualify new B2B prospects for your pipeline.'],
    };

    window.switchTab = (tab) => {
        document.querySelectorAll('.tab-content').forEach(t => {
            t.classList.add('hidden');
            t.classList.remove('active');
        });
        document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.remove('active'));

        const activeTab = document.getElementById(`${tab}-tab`);
        if (activeTab) {
            activeTab.classList.remove('hidden');
            activeTab.classList.add('active');
        }

        const activeNav = document.querySelector(`.nav-item[data-tab="${tab}"]`);
        if (activeNav) activeNav.classList.add('active');

        if (PAGE_META[tab]) {
            document.getElementById('page-title').textContent = PAGE_META[tab][0];
            document.getElementById('page-subtitle').textContent = PAGE_META[tab][1];
        }

        if (tab === 'dashboard') fetchLeads();
        if (tab === 'generate') fetchSearchHistory();
    };

    // ══════════════════════════════════════
    // DASHBOARD
    // ══════════════════════════════════════
    const tableBody        = document.getElementById('leads-table-body');
    const exportBtn        = document.getElementById('export-btn');
    const cityFilter       = document.getElementById('city-filter');
    const scoreFilter      = document.getElementById('score-filter');
    const statusFilter     = document.getElementById('status-filter');
    const searchFilter     = document.getElementById('search-filter');
    const hideContacted    = document.getElementById('hide-contacted');
    const prevPageBtn      = document.getElementById('prev-page');
    const nextPageBtn      = document.getElementById('next-page');
    const pageInfo         = document.getElementById('page-info');
    const itemsPerPage     = document.getElementById('items-per-page');

    const dash = {
        leads: [],
        filtered: [],
        filters: { search: '', city: '', score: 60, status: '', hideContacted: false },
        page: 1,
        perPage: 10,
        sort: { field: 'score', dir: 'desc' }
    };

    fetchLeads();

    searchFilter.addEventListener('input',  e => { dash.filters.search = e.target.value.toLowerCase(); applyFilters(); });
    cityFilter.addEventListener('change',   e => { dash.filters.city = e.target.value; applyFilters(); });
    scoreFilter.addEventListener('change',  e => { dash.filters.score = parseInt(e.target.value); applyFilters(); });
    statusFilter.addEventListener('change', e => { dash.filters.status = e.target.value; applyFilters(); });
    hideContacted.addEventListener('change',e => { dash.filters.hideContacted = e.target.checked; applyFilters(); });
    prevPageBtn.addEventListener('click',   () => { if (dash.page > 1) { dash.page--; renderDash(); } });
    nextPageBtn.addEventListener('click',   () => {
        const max = Math.ceil(dash.filtered.length / dash.perPage);
        if (dash.page < max) { dash.page++; renderDash(); }
    });
    itemsPerPage.addEventListener('change', e => { dash.perPage = parseInt(e.target.value); dash.page = 1; renderDash(); });
    exportBtn.addEventListener('click', () => { window.location.href = '/api/export'; });

    window.sortBy = (field) => {
        dash.sort.dir = (dash.sort.field === field && dash.sort.dir === 'desc') ? 'asc' : 'desc';
        dash.sort.field = field;
        applyFilters();
    };

    window.toggleContacted = async (id, current) => {
        const newVal = !current;
        const lead = dash.leads.find(l => l.id === id);
        if (lead) lead.contacted = newVal;
        applyFilters();
        try {
            await fetch(`/api/${id}/contacted`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contacted: newVal })
            });
        } catch { fetchLeads(); }
    };

    async function fetchLeads() {
        try {
            const res = await fetch('/api/');
            dash.leads = await res.json();
            const cities = [...new Set(dash.leads.map(l => l.city).filter(Boolean))].sort();
            cityFilter.innerHTML = '<option value="">All Cities</option>' +
                cities.map(c => `<option value="${c}">${c}</option>`).join('');
            applyFilters();
        } catch (e) { console.error('fetchLeads:', e); }
    }

    function applyFilters() {
        const { search, city, score, status, hideContacted: hc } = dash.filters;
        dash.filtered = dash.leads.filter(l => {
            if (search && !`${l.business_name} ${l.city}`.toLowerCase().includes(search)) return false;
            if (city   && l.city !== city) return false;
            if ((l.lead_score || 0) < score) return false;
            if (status && l.verification_status !== status) return false;
            if (hc && l.contacted) return false;
            return true;
        });
        dash.filtered.sort((a, b) => {
            const va = dash.sort.field === 'score' ? (a.lead_score || 0) : a[dash.sort.field];
            const vb = dash.sort.field === 'score' ? (b.lead_score || 0) : b[dash.sort.field];
            if (va < vb) return dash.sort.dir === 'asc' ? -1 : 1;
            if (va > vb) return dash.sort.dir === 'asc' ?  1 : -1;
            return 0;
        });
        const max = Math.ceil(dash.filtered.length / dash.perPage) || 1;
        if (dash.page > max) dash.page = 1;
        updateStats();
        renderDash();
    }

    function updateStats() {
        document.getElementById('total-leads').textContent    = dash.leads.length;
        document.getElementById('verified-emails').textContent = dash.leads.filter(l => l.verified_email).length;
        document.getElementById('contacted-count').textContent = dash.leads.filter(l => l.contacted).length;
        exportBtn.disabled = dash.leads.length === 0;
    }

    function renderDash() {
        const start    = (dash.page - 1) * dash.perPage;
        const paginated = dash.filtered.slice(start, start + dash.perPage);
        const maxPage  = Math.ceil(dash.filtered.length / dash.perPage) || 1;

        pageInfo.textContent   = `Page ${dash.page} of ${maxPage}`;
        prevPageBtn.disabled   = dash.page === 1;
        nextPageBtn.disabled   = dash.page >= maxPage;

        if (dash.filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No leads match your filters.</td></tr>';
            return;
        }

        tableBody.innerHTML = paginated.map(lead => {
            const score = lead.lead_score || 0;
            const scoreColor = score >= 80 ? 'var(--success)' : score >= 60 ? '#d97706' : 'var(--danger)';
            let hostname = lead.website || '--';
            try { hostname = new URL(lead.website).hostname; } catch {}
            const contact = lead.contact_name || tryParseFirst(lead.people) || '--';
            const title   = lead.job_title || '--';
            const email   = lead.best_email || (lead.email ? lead.email.split(',')[0] : null);
            const vs      = lead.verification_status;
            const badge   = vs === 'Valid'  ? '<span class="badge-valid">VALID</span>'
                          : vs === 'Risky'  ? '<span class="badge-risky">RISKY</span>'
                          : '';
            return `
            <tr class="${lead.contacted ? 'contacted-row' : ''}">
                <td><strong style="color:${scoreColor}">${score}</strong></td>
                <td>
                    <strong>${lead.business_name}</strong><br>
                    <a href="${lead.website}" target="_blank" class="muted-link">${hostname}</a>
                </td>
                <td>${contact}</td>
                <td>${title}</td>
                <td>${email ? `<div>${email}<br>${badge}</div>` : '<span class="text-muted">--</span>'}</td>
                <td><span class="text-muted" style="font-size:0.82rem">${vs || 'Unverified'}</span></td>
                <td>${lead.city || '--'}</td>
                <td>
                    <button class="action-btn" onclick="window.toggleContacted(${lead.id}, ${!!lead.contacted})">
                        ${lead.contacted ? '↩ Undo' : '✓ Contact'}
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    function tryParseFirst(json) {
        try { return JSON.parse(json)?.[0] || null; } catch { return null; }
    }

    // ══════════════════════════════════════
    // BULK IMPORT
    // ══════════════════════════════════════
    let bulkPollTimer = null;

    document.getElementById('bulk-import-btn')?.addEventListener('click', async () => {
        if (!confirm('This will scan all 105 NC cities via Google Maps and may take 5–10 minutes. Start?')) return;
        await fetch('/api/bulk-import', { method: 'POST' });
        startBulkPoll();
    });

    function startBulkPoll() {
        document.getElementById('bulk-progress-wrap').classList.remove('hidden');
        document.getElementById('bulk-import-btn').disabled = true;
        document.getElementById('bulk-import-btn').textContent = '⏳ Importing…';
        bulkPollTimer = setInterval(async () => {
            try {
                const res  = await fetch('/api/bulk-import/status');
                const s    = await res.json();
                const pct  = s.total ? Math.round((s.done / s.total) * 100) : 0;
                document.getElementById('bulk-progress-bar').style.width = pct + '%';
                document.getElementById('bulk-status-text').textContent =
                    s.running ? `Scanning city ${s.done} of ${s.total}…` : `Complete — ${s.added} businesses added`;
                document.getElementById('bulk-counts').textContent =
                    `+${s.added} new · ${s.skipped} existing`;
                if (!s.running) {
                    clearInterval(bulkPollTimer);
                    document.getElementById('bulk-import-btn').disabled = false;
                    document.getElementById('bulk-import-btn').textContent = '⬇ Import All NC Cities';
                    fetchLeads();
                }
            } catch { clearInterval(bulkPollTimer); }
        }, 1500);
    }

    // Resume poll if import was running when page loaded
    (async () => {
        try {
            const res = await fetch('/api/bulk-import/status');
            const s   = await res.json();
            if (s.running) startBulkPoll();
        } catch {}
    })();

    // ══════════════════════════════════════
    // APOLLO ENRICHMENT
    // ══════════════════════════════════════
    let apolloPollTimer = null;

    // Restore saved API key from previous session
    const savedApolloKey = localStorage.getItem('apollo_api_key');
    if (savedApolloKey) {
        const inp = document.getElementById('apollo-key-input');
        if (inp) inp.value = savedApolloKey;
    }

    document.getElementById('apollo-enrich-btn')?.addEventListener('click', async () => {
        const key = document.getElementById('apollo-key-input').value.trim();
        if (!key) { alert('Please paste your Apollo.io API key first.'); return; }
        localStorage.setItem('apollo_api_key', key);

        if (!confirm('This will scan all leads that have a website but no contact name and look up decision makers via Apollo.io. Continue?')) return;

        const res  = await fetch('/api/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apolloKey: key })
        });
        const data = await res.json();
        if (data.error)   { alert('Error: ' + data.error); return; }
        if (data.message === 'No leads need enrichment') {
            alert('All leads with websites already have contact info!');
            return;
        }
        startApolloEnrichPoll();
    });

    function startApolloEnrichPoll() {
        document.getElementById('apollo-progress-wrap').classList.remove('hidden');
        document.getElementById('apollo-enrich-btn').disabled = true;
        document.getElementById('apollo-enrich-btn').textContent = '⏳ Enriching…';

        apolloPollTimer = setInterval(async () => {
            try {
                const res = await fetch('/api/enrich/status');
                const s   = await res.json();
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                document.getElementById('apollo-progress-bar').style.width = pct + '%';
                document.getElementById('apollo-status-text').textContent =
                    s.running
                        ? `Processing lead ${s.done} of ${s.total}…`
                        : `Complete — ${s.enriched} contacts found`;
                document.getElementById('apollo-counts').textContent =
                    `+${s.enriched} enriched · ${s.skipped} skipped`;
                if (!s.running) {
                    clearInterval(apolloPollTimer);
                    document.getElementById('apollo-enrich-btn').disabled = false;
                    document.getElementById('apollo-enrich-btn').textContent = '✨ Enrich Contacts';
                    fetchLeads();
                }
            } catch { clearInterval(apolloPollTimer); }
        }, 1500);
    }

    // Resume poll if enrichment was already running when page loaded
    (async () => {
        try {
            const res = await fetch('/api/enrich/status');
            const s   = await res.json();
            if (s.running) startApolloEnrichPoll();
        } catch {}
    })();

    // ══════════════════════════════════════
    // GENERATE LEADS
    // ══════════════════════════════════════
    const gl = {
        results: [],
        selected: new Set(),
        busy: false,
        mode: 'quick'
    };

    // Mode toggle
    document.getElementById('gl-mode-quick').addEventListener('click', () => setGLMode('quick'));
    document.getElementById('gl-mode-discovery').addEventListener('click', () => setGLMode('discovery'));

    function setGLMode(mode) {
        gl.mode = mode;
        document.getElementById('gl-mode-quick').classList.toggle('active', mode === 'quick');
        document.getElementById('gl-mode-discovery').classList.toggle('active', mode === 'discovery');
        document.getElementById('gl-quick-panel').classList.toggle('hidden', mode !== 'quick');
        document.getElementById('gl-discovery-panel').classList.toggle('hidden', mode !== 'discovery');
    }

    // Custom location toggle
    document.getElementById('gl-location-select')?.addEventListener('change', e => {
        const custom = document.getElementById('gl-location-custom');
        custom.classList.toggle('hidden', e.target.value !== 'custom');
        if (e.target.value === 'custom') custom.focus();
    });

    document.getElementById('gl-disc-mode')?.addEventListener('change', e => {
        const isLoc = e.target.value === 'location';
        document.getElementById('gl-disc-label').textContent = isLoc ? 'Location (City, State or ZIP)' : 'Category';
        const inp = document.getElementById('gl-disc-value');
        inp.placeholder = isLoc ? 'e.g. Clayton NC, 27520  (comma-separate for multiple)' : 'e.g. IT Services';
        inp.value = isLoc ? '' : 'IT Services';
    });

    // Quick Search
    document.getElementById('gl-search-btn').addEventListener('click', async () => {
        if (gl.busy) return;
        const categorySelect = document.getElementById('gl-category');
        const locationSelect = document.getElementById('gl-location-select');
        const keyword  = categorySelect.value;
        const location = locationSelect.value === 'custom'
            ? document.getElementById('gl-location-custom').value.trim()
            : locationSelect.value;
        if (!location) { alert('Please select or enter a location.'); return; }
        const verifyEmails = document.getElementById('gl-verify').checked;

        const isLocalDB = false; // updated after fetch
        setGLBusy(true, 'Searching…');
        try {
            const res  = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, location, verifyEmails })
            });
            const data = await res.json();
            gl.results = data.data || [];
            gl.searchMessage = data.message || '';
            gl.selected = new Set(gl.results.map((_, i) => i));
            renderGLResults();
        } catch (e) {
            console.error(e);
            alert('Search failed. Check the console for details.');
        } finally {
            setGLBusy(false, '', 'Search');
        }
    });

    // Deep Discovery
    document.getElementById('gl-disc-btn').addEventListener('click', async () => {
        if (gl.busy) return;
        const type  = document.getElementById('gl-disc-mode').value;
        const value = document.getElementById('gl-disc-value').value.trim();
        if (!value) { alert('Please enter a category or location.'); return; }

        setGLBusy(true, 'Deep Discovery running — scanning multiple sources, please wait…');
        try {
            const res  = await fetch('/api/discovery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, value })
            });
            const data = await res.json();
            gl.results = data.data || [];
            gl.selected = new Set(gl.results.map((_, i) => i));
            renderGLResults();
            fetchSearchHistory();
        } catch (e) {
            console.error(e);
            alert('Discovery failed. Check the console for details.');
        } finally {
            setGLBusy(false, '', 'Launch Discovery');
        }
    });

    function setGLBusy(busy, msg, resetLabel) {
        gl.busy = busy;
        document.getElementById('gl-status').classList.toggle('hidden', !busy);
        if (msg) document.getElementById('gl-status-text').textContent = msg;
        if (busy) document.getElementById('gl-results-section').classList.add('hidden');

        const sb = document.getElementById('gl-search-btn');
        const db = document.getElementById('gl-disc-btn');
        if (sb) { sb.disabled = busy; if (!busy && resetLabel) sb.querySelector('.btn-text').textContent = resetLabel; }
        if (db) { db.disabled = busy; if (!busy && resetLabel) db.querySelector('.btn-text').textContent = resetLabel; }
    }

    function renderGLResults() {
        const section   = document.getElementById('gl-results-section');
        const grid      = document.getElementById('gl-results-grid');
        const countEl   = document.getElementById('gl-results-count');

        const fromDB = gl.searchMessage && gl.searchMessage.includes('local database');
        const sourceLabel = fromDB ? ' (from local database)' : '';
        countEl.textContent = `${gl.results.length} lead${gl.results.length !== 1 ? 's' : ''} found${sourceLabel}`;
        section.classList.remove('hidden');

        if (gl.results.length === 0) {
            grid.innerHTML = '<p class="empty-note" style="padding:2rem;text-align:center">No leads found. Try a different keyword or location.</p>';
            updateGLExportBtns();
            return;
        }

        grid.innerHTML = gl.results.map((lead, idx) => {
            const score      = lead.lead_score || 0;
            const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'med' : 'low';
            const sel        = gl.selected.has(idx);
            let hostname     = lead.website || '';
            try { hostname = new URL(lead.website).hostname; } catch {}
            const email   = lead.best_email || (lead.email ? lead.email.split(',')[0] : null);
            const verified = lead.verified_email;
            const badge    = verified ? '<span class="badge-valid">VERIFIED</span>'
                           : email    ? '<span class="badge-unverified">UNVERIFIED</span>' : '';

            return `
            <div class="lead-card${sel ? ' selected' : ''}" data-idx="${idx}" onclick="window.toggleLeadSelect(${idx})">
                <div class="lead-card-top">
                    <label class="lead-checkbox-wrap" onclick="event.stopPropagation()">
                        <input type="checkbox" class="lead-checkbox" data-idx="${idx}" ${sel ? 'checked' : ''}
                            onchange="window.toggleLeadSelect(${idx})">
                    </label>
                    <div class="score-badge score-${scoreClass}">${score}</div>
                </div>
                <div class="lead-card-body">
                    <div class="lead-biz-name">${lead.business_name}</div>
                    ${hostname ? `<a href="${lead.website}" target="_blank" class="lead-website" onclick="event.stopPropagation()">${hostname}</a>` : ''}
                    <div class="lead-info-rows">
                        ${lead.contact_name ? `
                        <div class="lead-info-row">
                            <span class="info-icon">👤</span>
                            <span>${lead.contact_name}${lead.job_title ? ` · <em>${lead.job_title}</em>` : ''}</span>
                        </div>` : ''}
                        ${email ? `
                        <div class="lead-info-row">
                            <span class="info-icon">✉</span>
                            <span>${email} ${badge}</span>
                        </div>` : ''}
                        ${lead.phone ? `
                        <div class="lead-info-row">
                            <span class="info-icon">📞</span>
                            <span>${lead.phone}</span>
                        </div>` : ''}
                        ${lead.city ? `
                        <div class="lead-info-row">
                            <span class="info-icon">📍</span>
                            <span>${lead.city}</span>
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');

        updateGLExportBtns();
    }

    window.toggleLeadSelect = (idx) => {
        if (gl.selected.has(idx)) {
            gl.selected.delete(idx);
        } else {
            gl.selected.add(idx);
        }
        const card = document.querySelector(`.lead-card[data-idx="${idx}"]`);
        const cb   = document.querySelector(`.lead-checkbox[data-idx="${idx}"]`);
        if (card) card.classList.toggle('selected', gl.selected.has(idx));
        if (cb)   cb.checked = gl.selected.has(idx);
        updateGLExportBtns();
    };

    document.getElementById('gl-select-all').addEventListener('click', () => {
        gl.selected = new Set(gl.results.map((_, i) => i));
        document.querySelectorAll('.lead-card').forEach(c => c.classList.add('selected'));
        document.querySelectorAll('.lead-checkbox').forEach(cb => cb.checked = true);
        updateGLExportBtns();
    });

    document.getElementById('gl-deselect-all').addEventListener('click', () => {
        gl.selected.clear();
        document.querySelectorAll('.lead-card').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.lead-checkbox').forEach(cb => cb.checked = false);
        updateGLExportBtns();
    });

    function updateGLExportBtns() {
        const n = gl.selected.size;
        const label    = document.getElementById('gl-selected-count');
        const pdfBtn   = document.getElementById('gl-export-pdf');
        const csvBtn   = document.getElementById('gl-export-sheets');
        label.textContent   = n > 0 ? `${n} selected` : '';
        pdfBtn.disabled = csvBtn.disabled = n === 0;
    }

    document.getElementById('gl-export-pdf').addEventListener('click', () => {
        const leads = [...gl.selected].map(i => gl.results[i]);
        exportToPDF(leads);
    });

    document.getElementById('gl-export-sheets').addEventListener('click', () => {
        const leads = [...gl.selected].map(i => gl.results[i]);
        exportToCSV(leads);
    });

    // ── PDF Export ──────────────────────────────────────
    function exportToPDF(leads) {
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head>
            <title>Lead Export — Bunn Communications</title>
            <style>
                body{font-family:Arial,sans-serif;padding:28px;color:#172b4d}
                h1{color:#0a192f;font-size:1.3rem;margin-bottom:4px}
                .meta{color:#666;font-size:0.82rem;margin-bottom:22px}
                table{width:100%;border-collapse:collapse;font-size:0.82rem}
                th{background:#0a192f;color:#fff;padding:9px 10px;text-align:left;font-weight:600}
                td{padding:7px 10px;border-bottom:1px solid #e0e4ea;vertical-align:top}
                tr:nth-child(even) td{background:#f7f9fc}
                .score-high{color:#36b37e;font-weight:700}
                .score-med{color:#d97706;font-weight:700}
                .score-low{color:#ff5630;font-weight:700}
                small{color:#888}
                @media print{@page{margin:.75in}}
            </style>
        </head><body>
        <h1>Lead Export — Bunn Communications</h1>
        <p class="meta">Generated: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; ${leads.length} lead${leads.length !== 1 ? 's' : ''}</p>
        <table>
            <thead><tr>
                <th>Score</th><th>Business</th><th>Contact</th>
                <th>Email</th><th>Phone</th><th>City</th><th>Status</th>
            </tr></thead>
            <tbody>${leads.map(l => {
                const s = l.lead_score || 0;
                const cls = s >= 80 ? 'score-high' : s >= 60 ? 'score-med' : 'score-low';
                const email = l.best_email || (l.email ? l.email.split(',')[0] : '');
                return `<tr>
                    <td class="${cls}">${s}</td>
                    <td><strong>${l.business_name || ''}</strong><br><small>${l.website || ''}</small></td>
                    <td>${l.contact_name || ''}${l.job_title ? '<br><small>' + l.job_title + '</small>' : ''}</td>
                    <td>${email}</td>
                    <td>${l.phone || ''}</td>
                    <td>${l.city || ''}</td>
                    <td>${l.verification_status || ''}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>
        <script>setTimeout(()=>window.print(),400);<\/script>
        </body></html>`);
        win.document.close();
    }

    // ── CSV / Google Sheets Export ───────────────────────
    function exportToCSV(leads) {
        const headers = ['Score','Business Name','Contact','Job Title','Email','Phone','City','Website','Status'];
        const rows = leads.map(l => [
            l.lead_score || 0,
            l.business_name || '',
            l.contact_name  || '',
            l.job_title     || '',
            l.best_email || (l.email ? l.email.split(',')[0] : ''),
            l.phone         || '',
            l.city          || '',
            l.website       || '',
            l.verification_status || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

        const csv  = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `bunn-leads-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Search History ───────────────────────────────────
    async function fetchSearchHistory() {
        try {
            const res     = await fetch('/api/history');
            const history = await res.json();
            const el      = document.getElementById('gl-history-list');
            if (!el) return;
            if (!history.length) {
                el.innerHTML = '<p class="empty-note">No recent searches.</p>';
                return;
            }
            el.innerHTML = history.map(h => `
                <div class="history-item">
                    <span>${h.query_type === 'location' ? '📍' : '🏷️'} <strong>${h.query_value}</strong></span>
                    <span class="history-meta">${new Date(h.timestamp).toLocaleDateString()} · ${h.leads_found} leads</span>
                </div>`).join('');
        } catch (e) { console.error('fetchSearchHistory:', e); }
    }

});
