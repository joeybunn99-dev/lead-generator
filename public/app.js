document.addEventListener('DOMContentLoaded', () => {

    // ── Utilities ──────────────────────────────────────────────────────────────
    function escHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function api(url, opts = {}) {
        return fetch(url, { credentials: 'include', ...opts });
    }

    function apiJson(url, opts = {}) {
        return api(url, {
            headers: { 'Content-Type': 'application/json', ...opts.headers },
            ...opts,
        }).then(r => r.json());
    }

    // ── Auth ────────────────────────────────────────────────────────────────────
    const loginOverlay = document.getElementById('login-overlay');

    async function checkAuth() {
        try {
            const res = await api('/api/stats');
            if (res.status === 401) {
                loginOverlay.style.display = 'flex';
                return false;
            }
            loginOverlay.style.display = 'none';
            return true;
        } catch {
            loginOverlay.style.display = 'flex';
            return false;
        }
    }

    async function doLogin() {
        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value;
        const errEl = document.getElementById('login-error');
        errEl.classList.add('hidden');

        try {
            const res = await api('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p }),
            });
            if (res.ok) {
                loginOverlay.style.display = 'none';
                initApp();
            } else {
                errEl.classList.remove('hidden');
            }
        } catch {
            errEl.textContent = 'Connection error.';
            errEl.classList.remove('hidden');
        }
    }

    document.getElementById('login-btn').addEventListener('click', doLogin);
    document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    document.getElementById('login-user').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await api('/api/logout', { method: 'POST' });
        loginOverlay.style.display = 'flex';
    });

    // ── Tab switching ───────────────────────────────────────────────────────────
    const TABS = {
        leads: { title: 'Leads', subtitle: 'Decision-maker contacts \u00b7 North Carolina statewide' },
        companies: { title: 'Companies', subtitle: 'All companies found across North Carolina' },
        import: { title: 'Import', subtitle: 'Pull companies and enrich contacts' },
        'website-leads': { title: 'Website Leads', subtitle: 'Inbound leads from bunncom.com savings calculator' },
    };

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });

    function switchTab(tab) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === `${tab}-tab`));
        const info = TABS[tab] || { title: tab, subtitle: '' };
        document.getElementById('page-title').textContent = info.title;
        document.getElementById('page-subtitle').textContent = info.subtitle;
        if (tab === 'leads') loadLeads();
        if (tab === 'companies') loadCompanies();
        if (tab === 'website-leads') loadWebsiteLeads();
    }

    // ── Industry helpers ────────────────────────────────────────────────────────
    const INDUSTRY_COLORS = {
        'Technology/IT': '#6366f1', 'Construction': '#f59e0b',
        'Manufacturing': '#10b981', 'Legal': '#3b82f6',
        'Accounting': '#8b5cf6', 'Consulting': '#ec4899',
        'Engineering': '#14b8a6', 'Marketing': '#f97316',
        'Automotive': '#ef4444', 'Real Estate': '#06b6d4',
    };

    function industryDot(industry) {
        const color = INDUSTRY_COLORS[industry] || '#64748b';
        return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle"></span>`;
    }

    function ratingBadge(rating) {
        if (!rating) return '<span class="text-gray-600">\u2014</span>';
        const val = Number(rating).toFixed(1);
        if (rating >= 4.5) return `<span class="score-badge bg-emerald-500/20 text-emerald-400">\u2605 ${val}</span>`;
        if (rating >= 4.0) return `<span class="score-badge bg-yellow-500/20 text-yellow-400">\u2605 ${val}</span>`;
        return `<span class="score-badge bg-gray-500/20 text-gray-400">\u2605 ${val}</span>`;
    }

    function scoreBadge(score) {
        if (score == null || score === '') return '<span class="text-gray-600">\u2014</span>';
        const s = Number(score);
        if (s >= 80) return `<span class="score-badge bg-emerald-500/20 text-emerald-400">${s}</span>`;
        if (s >= 50) return `<span class="score-badge bg-yellow-500/20 text-yellow-400">${s}</span>`;
        return `<span class="score-badge bg-gray-500/20 text-gray-500">${s}</span>`;
    }

    function emailStatusDot(status) {
        if (!status || status === 'unverified') return '<span class="email-dot" style="background:#64748b"></span>';
        if (status === 'valid') return '<span class="email-dot" style="background:#22c55e"></span>';
        if (status === 'risky') return '<span class="email-dot" style="background:#eab308"></span>';
        if (status === 'invalid') return '<span class="email-dot" style="background:#ef4444"></span>';
        return '<span class="email-dot" style="background:#64748b"></span>';
    }

    // ── Load industry + city options ────────────────────────────────────────────
    async function loadIndustryOptions() {
        try {
            const industries = await apiJson('/api/industries');
            ['leads-industry', 'co-industry'].forEach(id => {
                const sel = document.getElementById(id);
                // Keep first option, remove rest
                while (sel.options.length > 1) sel.remove(1);
                industries.forEach(ind => {
                    const opt = document.createElement('option');
                    opt.value = ind; opt.textContent = ind;
                    sel.appendChild(opt);
                });
            });
        } catch { /* ignore */ }
    }

    async function loadCityOptions() {
        try {
            const cities = await apiJson('/api/cities');
            ['leads-city', 'co-city'].forEach(id => {
                const sel = document.getElementById(id);
                while (sel.options.length > 1) sel.remove(1);
                cities.forEach(city => {
                    const opt = document.createElement('option');
                    opt.value = city; opt.textContent = city;
                    sel.appendChild(opt);
                });
            });
        } catch { /* ignore */ }
    }

    // ── Stats ───────────────────────────────────────────────────────────────────
    async function loadStats() {
        try {
            const s = await apiJson('/api/stats');
            document.getElementById('stat-contacts').textContent = s.totalContacts?.toLocaleString() ?? '0';
            document.getElementById('stat-email').textContent = s.contactsWithEmail?.toLocaleString() ?? '0';
            document.getElementById('stat-phone').textContent = s.contactsWithPhone?.toLocaleString() ?? '0';
            document.getElementById('stat-companies').textContent = s.totalCompanies?.toLocaleString() ?? '0';
            const el = (id) => document.getElementById(id);
            if (el('stat-co-phone')) el('stat-co-phone').textContent = s.companiesWithPhone?.toLocaleString() ?? '0';
            if (el('stat-co-website')) el('stat-co-website').textContent = s.companiesWithWebsite?.toLocaleString() ?? '0';
            if (el('stat-verified')) el('stat-verified').textContent = s.verifiedEmails?.toLocaleString() ?? '0';
            if (el('stat-avg-score')) el('stat-avg-score').textContent = s.avgLeadScore ?? '0';
        } catch { /* ignore */ }
    }

    // ── LEADS TAB ───────────────────────────────────────────────────────────────
    let leadsPage = 1;
    let extraFilters = {}; // for stat card click filters

    function getLeadsParams() {
        const params = new URLSearchParams();
        const search = document.getElementById('leads-search').value.trim();
        const industry = document.getElementById('leads-industry').value;
        const city = document.getElementById('leads-city').value;
        if (search)   params.set('search', search);
        if (industry) params.set('industry', industry);
        if (city)     params.set('city', city);
        if (document.getElementById('leads-has-email').checked)      params.set('hasEmail', 'true');
        if (document.getElementById('leads-has-phone').checked)      params.set('hasPhone', 'true');
        if (document.getElementById('leads-not-contacted').checked)  params.set('notContacted', 'true');
        // Extra filters from stat card clicks
        if (extraFilters.hasVerified) params.set('hasVerified', 'true');
        if (extraFilters.sortBy)     params.set('sortBy', extraFilters.sortBy);
        params.set('page', leadsPage);
        params.set('limit', document.getElementById('leads-limit').value);
        return params;
    }

    // ── Clickable stat cards ──
    function clearFilters() {
        document.getElementById('leads-search').value = '';
        document.getElementById('leads-industry').value = '';
        document.getElementById('leads-city').value = '';
        document.getElementById('leads-has-email').checked = false;
        document.getElementById('leads-has-phone').checked = false;
        document.getElementById('leads-not-contacted').checked = false;
        extraFilters = {};
        leadsPage = 1;
        // Remove active highlight from all stat cards
        document.querySelectorAll('[data-filter]').forEach(c => c.classList.remove('ring-1', 'ring-brand-500'));
    }

    document.querySelectorAll('[data-filter]').forEach(card => {
        card.addEventListener('click', () => {
            clearFilters();
            card.classList.add('ring-1', 'ring-brand-500');
            const filter = card.dataset.filter;
            switch (filter) {
                case 'companies':
                    // Switch to companies tab
                    document.querySelector('[data-tab="companies"]').click();
                    return;
                case 'co-phone':
                    document.querySelector('[data-tab="companies"]').click();
                    return;
                case 'co-website':
                    document.querySelector('[data-tab="companies"]').click();
                    return;
                case 'contacts':
                    // Show all contacts — no filter needed
                    break;
                case 'has-email':
                    document.getElementById('leads-has-email').checked = true;
                    break;
                case 'verified':
                    extraFilters.hasVerified = true;
                    break;
                case 'has-phone':
                    document.getElementById('leads-has-phone').checked = true;
                    break;
                case 'avg-score':
                    extraFilters.sortBy = 'score';
                    break;
            }
            loadLeads();
        });
    });

    async function loadLeads() {
        const tbody = document.getElementById('leads-tbody');
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-gray-600">Loading\u2026</td></tr>';
        try {
            const res = await api('/api/contacts?' + getLeadsParams());
            if (res.status === 401) { loginOverlay.style.display = 'flex'; return; }
            const { data, total, page, limit } = await res.json();

            document.getElementById('leads-count').textContent = `${total.toLocaleString()} contact${total !== 1 ? 's' : ''}`;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            document.getElementById('leads-page-info').textContent = `Page ${page} of ${totalPages}`;
            document.getElementById('leads-prev').disabled = page <= 1;
            document.getElementById('leads-next').disabled = page >= totalPages;

            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-gray-600">No contacts match your filters.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(c => {
                const emailHtml = c.email
                    ? `${emailStatusDot(c.email_status)}<a href="mailto:${escHtml(c.email)}" class="text-brand-400 hover:text-brand-500 no-underline">${escHtml(c.email)}</a>`
                    : '<span class="text-gray-600">\u2014</span>';

                const contactedBtn = c.contacted
                    ? `<button type="button" class="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/30" onclick="toggleContacted(${c.id}, false)">\u2713 Done</button>`
                    : `<button type="button" class="px-2 py-1 rounded text-xs font-medium text-gray-400 border border-white/10 hover:bg-white/5 cursor-pointer" onclick="toggleContacted(${c.id}, true)">Mark Done</button>`;

                return `<tr class="table-row border-b border-white/[0.04]">
                    <td class="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                        <span class="font-semibold text-gray-200">${escHtml(c.company_name)}</span>
                    </td>
                    <td class="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-gray-300">${escHtml(c.name)}</td>
                    <td class="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-gray-500 text-xs">${escHtml(c.title)}</td>
                    <td class="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-xs">${emailHtml}</td>
                    <td class="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-xs text-gray-400">${c.phone ? escHtml(c.phone) : '<span class="text-gray-600">\u2014</span>'}</td>
                    <td class="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-xs text-gray-500">${escHtml(c.city || '')}</td>
                    <td class="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-xs">${industryDot(c.industry)}${escHtml(c.industry || '')}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-center">${scoreBadge(c.lead_score)}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-center">${ratingBadge(c.rating)}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${contactedBtn}</td>
                </tr>`;
            }).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-red-400">Error loading contacts: ${escHtml(err.message)}</td></tr>`;
        }
    }

    window.toggleContacted = async (id, contacted) => {
        await api(`/api/contacts/${id}/contacted`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacted }),
        });
        loadLeads();
        loadStats();
    };

    // Filter listeners
    let leadsDebounce;
    document.getElementById('leads-search').addEventListener('input', () => {
        clearTimeout(leadsDebounce);
        leadsDebounce = setTimeout(() => { leadsPage = 1; loadLeads(); }, 350);
    });
    ['leads-industry', 'leads-city', 'leads-limit'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => { leadsPage = 1; loadLeads(); });
    });
    ['leads-has-email', 'leads-has-phone', 'leads-not-contacted'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => { leadsPage = 1; loadLeads(); });
    });

    document.getElementById('leads-prev').addEventListener('click', () => { leadsPage--; loadLeads(); });
    document.getElementById('leads-next').addEventListener('click', () => { leadsPage++; loadLeads(); });

    document.getElementById('leads-export-btn').addEventListener('click', () => {
        const params = getLeadsParams();
        window.open('/api/contacts/export?' + params, '_blank');
    });

    // ── COMPANIES TAB ───────────────────────────────────────────────────────────
    let coPage = 1;
    const expandedRows = new Set();

    async function loadCompanies() {
        const tbody = document.getElementById('companies-tbody');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-600">Loading\u2026</td></tr>';
        try {
            const params = new URLSearchParams();
            const industry = document.getElementById('co-industry').value;
            const city = document.getElementById('co-city').value.trim();
            if (industry) params.set('industry', industry);
            if (city)     params.set('city', city);
            params.set('page', coPage);
            params.set('limit', 50);

            const res = await api('/api/companies?' + params);
            const { data, total } = await res.json();

            document.getElementById('co-count').textContent = `${total.toLocaleString()} companies`;
            const totalPages = Math.max(1, Math.ceil(total / 50));
            document.getElementById('co-page-info').textContent = `Page ${coPage} of ${totalPages}`;
            document.getElementById('co-prev').disabled = coPage <= 1;
            document.getElementById('co-next').disabled = coPage >= totalPages;

            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-600">No companies found.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(c => {
                let websiteHtml;
                try {
                    websiteHtml = c.website
                        ? `<a href="${escHtml(c.website)}" target="_blank" class="text-brand-400 hover:text-brand-500 text-xs no-underline">${escHtml(new URL(c.website).hostname)}</a>`
                        : '<span class="text-gray-600 text-xs">\u2014</span>';
                } catch {
                    websiteHtml = c.website
                        ? `<a href="${escHtml(c.website)}" target="_blank" class="text-brand-400 hover:text-brand-500 text-xs no-underline">${escHtml(c.website)}</a>`
                        : '<span class="text-gray-600 text-xs">\u2014</span>';
                }

                const hasContacts = c.contact_count > 0;
                const contactBadge = hasContacts
                    ? `<span class="score-badge bg-emerald-500/20 text-emerald-400">${c.contact_count}</span>`
                    : `<span class="score-badge bg-gray-500/20 text-gray-600">${c.contact_count}</span>`;

                return `<tr class="table-row border-b border-white/[0.04]">
                    <td class="px-3 py-2" style="width:36px">
                        ${hasContacts ? `<button type="button" class="px-1.5 py-0.5 rounded text-xs text-gray-500 border border-white/10 hover:bg-white/5 cursor-pointer" onclick="toggleExpand(${c.id}, this)">\u25b6</button>` : ''}
                    </td>
                    <td class="px-3 py-2 font-semibold text-gray-200">${escHtml(c.name)}</td>
                    <td class="px-3 py-2 text-xs">${industryDot(c.industry)}${escHtml(c.industry || '')}</td>
                    <td class="px-3 py-2 text-xs text-gray-500">${escHtml(c.city || '')}</td>
                    <td class="px-3 py-2">${ratingBadge(c.rating)}</td>
                    <td class="px-3 py-2">${contactBadge}</td>
                    <td class="px-3 py-2">${websiteHtml}</td>
                    <td class="px-3 py-2">
                        <button type="button" class="px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 cursor-pointer" onclick="deleteCompany(${c.id})">Delete</button>
                    </td>
                </tr>
                <tr id="expand-${c.id}" style="display:none">
                    <td colspan="8" class="px-6 py-3" style="background:rgba(255,255,255,0.02)">
                        <em class="text-xs text-gray-600">Loading contacts\u2026</em>
                    </td>
                </tr>`;
            }).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-red-400">Error: ${escHtml(err.message)}</td></tr>`;
        }
    }

    window.toggleExpand = async (id, btn) => {
        const row = document.getElementById(`expand-${id}`);
        if (expandedRows.has(id)) {
            row.style.display = 'none';
            btn.textContent = '\u25b6';
            expandedRows.delete(id);
            return;
        }
        expandedRows.add(id);
        btn.textContent = '\u25bc';
        row.style.display = '';

        const contacts = await apiJson(`/api/companies/${id}/contacts`);
        const td = row.querySelector('td');

        if (!contacts.length) {
            td.innerHTML = '<em class="text-xs text-gray-600">No contacts found for this company.</em>';
            return;
        }
        td.innerHTML = contacts.map(c =>
            `<span class="inline-block border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs m-0.5" style="background:rgba(255,255,255,0.03)">
                <strong class="text-gray-300">${escHtml(c.name)}</strong>
                <span class="text-gray-600">\u00b7</span> ${escHtml(c.title)}
                ${c.email ? ` <span class="text-gray-600">\u00b7</span> <a href="mailto:${escHtml(c.email)}" class="text-brand-400">${escHtml(c.email)}</a>` : ''}
                ${c.phone ? ` <span class="text-gray-600">\u00b7</span> ${escHtml(c.phone)}` : ''}
            </span>`
        ).join('');
    };

    window.deleteCompany = async (id) => {
        if (!confirm('Delete this company and all its contacts?')) return;
        await api(`/api/companies/${id}`, { method: 'DELETE' });
        loadCompanies();
        loadStats();
    };

    document.getElementById('co-industry').addEventListener('change', () => { coPage = 1; loadCompanies(); });
    document.getElementById('co-city').addEventListener('change', () => { coPage = 1; loadCompanies(); });
    document.getElementById('co-prev').addEventListener('click', () => { coPage--; loadCompanies(); });
    document.getElementById('co-next').addEventListener('click', () => { coPage++; loadCompanies(); });

    // ── IMPORT TAB ──────────────────────────────────────────────────────────────
    let pullTimer = null, scrapeTimer = null, apolloTimer = null;
    let currentPullSource = null;

    // URL-to-Leads
    document.getElementById('url-scrape-btn').addEventListener('click', async () => {
        const url = document.getElementById('url-scrape-input').value.trim();
        const resultEl = document.getElementById('url-scrape-result');
        if (!url) { resultEl.textContent = 'Enter a URL first.'; resultEl.classList.remove('hidden'); return; }

        const btn = document.getElementById('url-scrape-btn');
        btn.disabled = true;
        btn.textContent = 'Scraping\u2026';
        resultEl.textContent = 'AI is analyzing the page\u2026';
        resultEl.classList.remove('hidden');

        try {
            const res = await api('/api/enrich/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            resultEl.textContent = `Done! Found ${data.found || 0} contacts.`;
            resultEl.className = 'text-xs text-emerald-400 mt-2';
            loadStats();
        } catch (err) {
            resultEl.textContent = `Error: ${err.message}`;
            resultEl.className = 'text-xs text-red-400 mt-2';
        }
        btn.disabled = false;
        btn.textContent = 'Scrape with AI';
    });

    // Pull Companies
    document.getElementById('pull-btn').addEventListener('click', async () => {
        const checked = [...document.querySelectorAll('#industry-checks input:checked')].map(i => i.value);
        if (!checked.length) { alert('Select at least one industry.'); return; }
        const radius = parseInt(document.getElementById('pull-radius').value, 10);

        document.getElementById('pull-btn').disabled = true;
        document.getElementById('pull-cancel-btn').classList.remove('hidden');
        document.getElementById('pull-cancel-btn').disabled = false;
        document.getElementById('pull-cancel-btn').textContent = 'Stop';
        document.getElementById('pull-progress').classList.remove('hidden');

        runCombinedPull(checked, radius);
    });

    document.getElementById('pull-cancel-btn').addEventListener('click', async () => {
        document.getElementById('pull-cancel-btn').disabled = true;
        document.getElementById('pull-cancel-btn').textContent = 'Stopping\u2026';
        if (currentPullSource === 'google')     await api('/api/pull/cancel', { method: 'POST' });
        if (currentPullSource === 'foursquare') await api('/api/pull/foursquare/cancel', { method: 'POST' });
        if (currentPullSource === 'osm')        await api('/api/pull/osm/cancel', { method: 'POST' });
    });

    async function runCombinedPull(industries, radius) {
        let totalFound = 0;

        // Phase 1 - Google Places (0-33%)
        currentPullSource = 'google';
        document.getElementById('pull-status-text').textContent = 'Google Places \u2014 Starting\u2026';
        try {
            await api('/api/pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ industries, radius }),
            });
        } catch { finishCombinedPull(totalFound, true); return; }
        const googleResult = await pollSource('/api/pull/status', 'Google Places', 0, 33);
        const gs = await apiJson('/api/pull/status');
        totalFound += gs.companiesFound || 0;
        if (googleResult === 'cancelled') { finishCombinedPull(totalFound, true); return; }

        // Phase 2 - Foursquare (33-66%)
        currentPullSource = 'foursquare';
        document.getElementById('pull-status-text').textContent = 'Foursquare \u2014 Starting\u2026';
        try {
            await api('/api/pull/foursquare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ industries, radius }),
            });
        } catch { finishCombinedPull(totalFound, true); return; }
        const fsqResult = await pollSource('/api/pull/foursquare/status', 'Foursquare', 33, 66);
        const fs = await apiJson('/api/pull/foursquare/status');
        totalFound += fs.companiesFound || 0;
        if (fsqResult === 'cancelled') { finishCombinedPull(totalFound, true); return; }

        // Phase 3 - OpenStreetMap (66-100%)
        currentPullSource = 'osm';
        document.getElementById('pull-status-text').textContent = 'OpenStreetMap \u2014 Starting\u2026';
        try {
            await api('/api/pull/osm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ industries }),
            });
        } catch { finishCombinedPull(totalFound, true); return; }
        const osmResult = await pollSource('/api/pull/osm/status', 'OpenStreetMap', 66, 100);
        const os = await apiJson('/api/pull/osm/status');
        totalFound += os.companiesFound || 0;

        finishCombinedPull(totalFound, osmResult === 'cancelled');
    }

    function pollSource(statusUrl, label, pctStart, pctEnd) {
        return new Promise(resolve => {
            clearInterval(pullTimer);
            setTimeout(() => {
                pullTimer = setInterval(async () => {
                    try {
                        const s = await apiJson(statusUrl);
                        const scaledPct = Math.round(pctStart + ((s.pct || 0) / 100) * (pctEnd - pctStart));
                        document.getElementById('pull-bar').style.width = scaledPct + '%';
                        document.getElementById('pull-pct').textContent = scaledPct + '%';
                        document.getElementById('pull-stats').textContent = `${s.companiesFound || 0} companies found`;
                        if (s.running) {
                            document.getElementById('pull-status-text').textContent = s.cancelled
                                ? `${label} \u2014 Stopping\u2026`
                                : `${label} \u2014 Query ${s.queriesDone || 0} of ${s.queriesTotal || 0}\u2026`;
                        } else {
                            clearInterval(pullTimer);
                            resolve(s.cancelled ? 'cancelled' : 'done');
                        }
                    } catch { clearInterval(pullTimer); resolve('error'); }
                }, 1500);
            }, 600);
        });
    }

    function finishCombinedPull(totalFound, cancelled) {
        currentPullSource = null;
        clearInterval(pullTimer);
        document.getElementById('pull-btn').disabled = false;
        document.getElementById('pull-cancel-btn').classList.add('hidden');
        document.getElementById('pull-cancel-btn').disabled = false;
        document.getElementById('pull-cancel-btn').textContent = 'Stop';
        if (!cancelled) {
            document.getElementById('pull-bar').style.width = '100%';
            document.getElementById('pull-pct').textContent = '100%';
        }
        document.getElementById('pull-status-text').textContent = cancelled ? 'Stopped.' : 'Complete!';
        document.getElementById('pull-stats').textContent = `${totalFound} companies found`;
        loadStats();
        loadCityOptions();
    }

    // Dedupe
    document.getElementById('dedupe-btn').addEventListener('click', async () => {
        const btn = document.getElementById('dedupe-btn');
        const result = document.getElementById('dedupe-result');
        btn.disabled = true;
        result.textContent = 'Running\u2026';
        try {
            const data = await apiJson('/api/cleanup/dedupe', { method: 'POST' });
            if (data.error) throw new Error(data.error);
            result.textContent = data.removed > 0
                ? `Removed ${data.removed} duplicate/empty contact${data.removed !== 1 ? 's' : ''}.`
                : 'No duplicates found.';
            result.className = 'text-xs text-emerald-400';
            loadStats();
            loadLeads();
        } catch (err) {
            result.textContent = `Error: ${err.message}`;
            result.className = 'text-xs text-red-400';
        }
        btn.disabled = false;
    });

    // Backfill
    document.getElementById('backfill-btn').addEventListener('click', async () => {
        const btn = document.getElementById('backfill-btn');
        const result = document.getElementById('dedupe-result');
        btn.disabled = true;
        result.textContent = 'Backfilling\u2026';
        try {
            const data = await apiJson('/api/admin/backfill', { method: 'POST' });
            if (data.error) throw new Error(data.error);
            result.textContent = `Backfill complete. Updated ${data.updated || 0} records.`;
            result.className = 'text-xs text-emerald-400';
            loadStats();
            loadLeads();
        } catch (err) {
            result.textContent = `Error: ${err.message}`;
            result.className = 'text-xs text-red-400';
        }
        btn.disabled = false;
    });

    // Email Discovery
    document.getElementById('discover-btn').addEventListener('click', async () => {
        const limit = document.getElementById('discovery-limit').value;
        await api('/api/enrich/discover-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: parseInt(limit) })
        });
        document.getElementById('discover-btn').classList.add('hidden');
        document.getElementById('discover-cancel-btn').classList.remove('hidden');
        document.getElementById('discover-progress').classList.remove('hidden');

        const poll = setInterval(async () => {
            try {
                const s = await apiJson('/api/enrich/discover-emails/status');
                const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                document.getElementById('discover-pct').textContent = pct + '%';
                document.getElementById('discover-bar').style.width = pct + '%';
                document.getElementById('discover-status-text').textContent = s.running ? 'Discovering...' : 'Complete';
                document.getElementById('discover-stats').textContent = `${s.done} tested · ${s.found} emails found`;
                if (!s.running) {
                    clearInterval(poll);
                    document.getElementById('discover-btn').classList.remove('hidden');
                    document.getElementById('discover-cancel-btn').classList.add('hidden');
                    loadStats();
                }
            } catch { clearInterval(poll); }
        }, 2000);
    });

    document.getElementById('discover-cancel-btn').addEventListener('click', async () => {
        await api('/api/enrich/discover-emails/cancel', { method: 'POST' });
    });

    // Scrape Websites
    document.getElementById('scrape-btn').addEventListener('click', async () => {
        document.getElementById('scrape-btn').disabled = true;
        document.getElementById('scrape-cancel-btn').classList.remove('hidden');
        document.getElementById('scrape-cancel-btn').disabled = false;
        document.getElementById('scrape-cancel-btn').textContent = 'Stop';
        document.getElementById('scrape-progress').classList.remove('hidden');
        await api('/api/enrich/scrape', { method: 'POST' });
        startScrapePoll();
    });

    document.getElementById('scrape-cancel-btn').addEventListener('click', async () => {
        document.getElementById('scrape-cancel-btn').disabled = true;
        document.getElementById('scrape-cancel-btn').textContent = 'Stopping\u2026';
        await api('/api/enrich/scrape/cancel', { method: 'POST' });
    });

    function startScrapePoll() {
        clearInterval(scrapeTimer);
        scrapeTimer = setInterval(async () => {
            try {
                const s = await apiJson('/api/enrich/scrape/status');
                const pct = s.pct || 0;
                document.getElementById('scrape-bar').style.width = pct + '%';
                document.getElementById('scrape-pct').textContent = pct + '%';
                document.getElementById('scrape-status-text').textContent =
                    s.running ? `Scraping ${s.done} of ${s.total}\u2026` : 'Complete!';
                document.getElementById('scrape-stats').textContent = `${s.found} contacts found`;

                if (!s.running) {
                    clearInterval(scrapeTimer);
                    document.getElementById('scrape-btn').disabled = false;
                    document.getElementById('scrape-cancel-btn').classList.add('hidden');
                    loadStats();
                }
            } catch { clearInterval(scrapeTimer); }
        }, 1500);
    }

    // Apollo Lookup
    document.getElementById('apollo-btn').addEventListener('click', async () => {
        document.getElementById('apollo-btn').disabled = true;
        document.getElementById('apollo-cancel-btn').classList.remove('hidden');
        document.getElementById('apollo-cancel-btn').disabled = false;
        document.getElementById('apollo-cancel-btn').textContent = 'Stop';
        document.getElementById('apollo-progress').classList.remove('hidden');
        await api('/api/enrich/apollo', { method: 'POST' });
        startApolloPoll();
    });

    document.getElementById('apollo-cancel-btn').addEventListener('click', async () => {
        document.getElementById('apollo-cancel-btn').disabled = true;
        document.getElementById('apollo-cancel-btn').textContent = 'Stopping\u2026';
        await api('/api/enrich/apollo/cancel', { method: 'POST' });
    });

    function startApolloPoll() {
        clearInterval(apolloTimer);
        apolloTimer = setInterval(async () => {
            try {
                const s = await apiJson('/api/enrich/apollo/status');
                const pct = s.pct || 0;
                document.getElementById('apollo-bar').style.width = pct + '%';
                document.getElementById('apollo-pct').textContent = pct + '%';
                document.getElementById('apollo-status-text').textContent =
                    s.running ? `Enriching ${s.done} of ${s.total}\u2026` : 'Complete!';
                document.getElementById('apollo-stats').textContent = `${s.found} contacts found`;

                if (!s.running) {
                    clearInterval(apolloTimer);
                    document.getElementById('apollo-btn').disabled = false;
                    document.getElementById('apollo-cancel-btn').classList.add('hidden');
                    loadStats();
                }
            } catch { clearInterval(apolloTimer); }
        }, 1500);
    }

    // ── CSV Import ──────────────────────────────────────────────────────────────
    document.getElementById('csv-import-btn').addEventListener('click', async () => {
        const file = document.getElementById('csv-file').files[0];
        const result = document.getElementById('csv-result');
        if (!file) { result.textContent = 'Select a CSV file first.'; return; }

        const btn = document.getElementById('csv-import-btn');
        btn.disabled = true;
        result.textContent = 'Parsing\u2026';

        try {
            const text = await file.text();
            const rows = parseCSV(text);
            if (!rows.length) { result.textContent = 'No valid rows found in file.'; btn.disabled = false; return; }
            result.textContent = `Importing ${rows.length} rows\u2026`;

            const data = await apiJson('/api/companies/import', {
                method: 'POST',
                body: JSON.stringify(rows),
            });
            if (data.error) throw new Error(data.error);
            result.textContent = `Imported ${data.inserted} new companies (${data.total} rows in file).`;
            result.className = 'text-xs text-emerald-400';
            loadStats();
            loadCityOptions();
        } catch (err) {
            result.textContent = `Error: ${err.message}`;
            result.className = 'text-xs text-red-400';
        }
        btn.disabled = false;
    });

    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        return lines.slice(1).map(line => {
            const vals = [];
            let cur = '', inQ = false;
            for (const ch of line) {
                if (ch === '"') { inQ = !inQ; }
                else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
                else { cur += ch; }
            }
            vals.push(cur.trim());
            const row = {};
            headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"|"$/g, ''); });
            return row;
        }).filter(r => r.name && r.name.length > 1);
    }

    // ── Export to Google Sheets ──────────────────────────────────────────────────
    document.getElementById('sheets-export-btn').addEventListener('click', async () => {
        const btn = document.getElementById('sheets-export-btn');
        const result = document.getElementById('sheets-export-result');
        btn.disabled = true;
        result.textContent = 'Pushing to Google Sheets\u2026';
        try {
            const data = await apiJson('/api/export/sheets', { method: 'POST' });
            if (data.error) throw new Error(data.error);
            result.textContent = `Pushed ${data.count} contacts to Google Sheets.`;
            result.className = 'text-xs text-emerald-400';
        } catch (err) {
            result.textContent = `Error: ${err.message}`;
            result.className = 'text-xs text-red-400';
        }
        btn.disabled = false;
    });

    // ── Website Leads ───────────────────────────────────────────────────────────
    async function loadWebsiteLeads() {
        try {
            const [leads, stats] = await Promise.all([
                apiJson('/api/website-leads'),
                apiJson('/api/website-leads/stats'),
            ]);

            // Stats
            document.getElementById('webLeadStats').innerHTML =
                `<div class="flex items-center gap-4 text-sm">
                    <span><strong class="text-white">${stats.total}</strong> <span class="text-gray-500">total leads</span></span>
                    <span class="text-gray-700">\u00b7</span>
                    <span><strong class="text-emerald-400">${stats.uncontacted}</strong> <span class="text-gray-500">uncontacted</span></span>
                    <span class="text-gray-700">\u00b7</span>
                    <span><strong class="text-white">${stats.today}</strong> <span class="text-gray-500">today</span></span>
                    <span class="text-gray-700">\u00b7</span>
                    <span><span class="text-gray-500">Avg savings:</span> <strong class="text-emerald-400">$${stats.avgSavings}/mo</strong></span>
                </div>`;

            // Table
            const tbody = document.getElementById('webLeadRows');
            const empty = document.getElementById('webLeadEmpty');

            if (leads.length === 0) {
                tbody.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }

            empty.classList.add('hidden');
            tbody.innerHTML = leads.map(l => {
                const date = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const isNew = !l.contacted;
                const statusBadge = isNew
                    ? `<span class="score-badge bg-yellow-500/20 text-yellow-400">New</span>`
                    : `<span class="score-badge bg-emerald-500/20 text-emerald-400">Contacted</span>`;
                const markBtn = isNew
                    ? ` <button type="button" onclick="markWebLeadContacted(${l.id})" class="ml-1 px-1.5 py-0.5 rounded text-[0.65rem] text-gray-500 border border-white/10 hover:bg-white/5 cursor-pointer">Mark</button>`
                    : '';

                return `<tr class="table-row border-b border-white/[0.04]">
                    <td class="px-4 py-2.5 font-medium text-gray-200">${escHtml(l.email || '')}</td>
                    <td class="px-3 py-2.5 text-center text-gray-400">${l.phone_lines || '-'}</td>
                    <td class="px-3 py-2.5 text-center text-gray-300">$${l.current_bill || 0}</td>
                    <td class="px-3 py-2.5 text-center text-gray-400 capitalize">${escHtml(l.current_provider || '-')}</td>
                    <td class="px-3 py-2.5 text-center text-emerald-400 font-semibold">$${l.monthly_savings || 0}</td>
                    <td class="px-3 py-2.5 text-center text-xs text-gray-500">${escHtml(l.features || '-')}</td>
                    <td class="px-3 py-2.5 text-center text-xs text-gray-500">${date}</td>
                    <td class="px-3 py-2.5 text-center">${statusBadge}${markBtn}</td>
                </tr>`;
            }).join('');
        } catch {
            document.getElementById('webLeadStats').innerHTML =
                '<span class="text-sm text-red-400">Could not load website leads \u2014 is BunnComm server running?</span>';
        }
    }

    window.markWebLeadContacted = async (id) => {
        await api('/api/website-leads/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacted: true }),
        });
        loadWebsiteLeads();
    };

    // ── Init ────────────────────────────────────────────────────────────────────
    async function initApp() {
        loadIndustryOptions();
        loadCityOptions();
        loadStats();
        loadLeads();
    }

    // On page load, check auth via /api/stats
    checkAuth().then(authed => {
        if (authed) initApp();
    });

});
