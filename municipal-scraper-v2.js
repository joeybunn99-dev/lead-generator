/**
 * Municipal Scraper v2 — self-monitoring + AI-fix layer over the v1 Cheerio scraper.
 *
 * What's new vs municipal-scraper.js:
 *   1. Baseline tracking: first successful scrape sets municipalities.baseline_contacts.
 *   2. Drift detection: subsequent scrapes that return < 50% of baseline are "drift events".
 *   3. AI-fix: on drift, send page HTML to Claude API → get new extraction strategy →
 *      save to lib/municipal-sites/<slug>.json → retry with new strategy.
 *   4. Per-site overrides: any site can have a custom strategy file loaded at scrape time.
 *
 * Usage:
 *   node municipal-scraper-v2.js                 # scrape all unscraped + drift-flagged
 *   node municipal-scraper-v2.js --rescan all    # force rescan everything
 *   node municipal-scraper-v2.js --slug <slug>   # rescan one site
 *
 * Env vars (optional):
 *   ANTHROPIC_API_KEY — enables AI-fix on drift. Without it, drift = mark needs_review.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { initDb, query, queryOne, run } = require('./database');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const EMAIL_RE = /[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g;
const HIGH_TITLES = /(IT|information technology|technology|telecom|network|CIO|CTO|tech director|systems admin|MIS)/i;
const MED_TITLES = /(town manager|city manager|county manager|finance|purchasing|procurement|clerk|administrative|budget|operations)/i;

const DEFAULT_PATHS = [
  '/staff', '/directory', '/staff-directory', '/departments',
  '/contact', '/contact-us', '/government/departments',
  '/about/staff', '/administration',
];

const SITES_DIR = path.join(__dirname, 'lib', 'municipal-sites');
const ERROR_LOG = path.resolve(__dirname, 'errors.log');
const DRIFT_THRESHOLD = 0.5;       // <50% of baseline = drift
const AI_FIX_MIN_BASELINE = 5;     // only AI-fix sites where we used to get 5+ contacts

function logError(context, err) {
  const ts = new Date().toISOString();
  try { fs.appendFileSync(ERROR_LOG, `[${ts}] [muni-v2] ${context}: ${err.message || err}\n`); } catch {}
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// --- Per-site config (extraction strategy override) ---
function loadSiteConfig(muniName) {
  const slug = slugify(muniName);
  const file = path.join(SITES_DIR, `${slug}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveSiteConfig(muniName, config) {
  const slug = slugify(muniName);
  if (!fs.existsSync(SITES_DIR)) fs.mkdirSync(SITES_DIR, { recursive: true });
  const file = path.join(SITES_DIR, `${slug}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...config, updated_at: new Date().toISOString() }, null, 2));
  return file;
}

// --- HTTP fetch ---
async function fetchPage(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

// --- Extraction ---
function extractWithStrategy(html, strategy) {
  const $ = cheerio.load(html);
  const contacts = [];
  const seen = new Set();

  // Strategy: explicit selectors override
  if (strategy && Array.isArray(strategy.selectorsToTry) && strategy.selectorsToTry.length > 0) {
    for (const sel of strategy.selectorsToTry) {
      try {
        $(sel).each((_, el) => {
          const block = $(el).text();
          const emails = (block.match(EMAIL_RE) || []).map(e => e.toLowerCase());
          const phones = block.match(PHONE_RE) || [];
          for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            if (seen.has(email)) continue;
            seen.add(email);
            contacts.push(makeContact(email, block, phones[i]));
          }
        });
      } catch (e) { /* bad selector — skip */ }
    }
    if (contacts.length > 0) return contacts;
  }

  // Default: full-text regex + mailto enrichment (matches v1 behavior)
  const fullText = $.text();
  const allEmails = (fullText.match(EMAIL_RE) || []).map(e => e.toLowerCase().trim());
  const allPhones = fullText.match(PHONE_RE) || [];
  for (let i = 0; i < allEmails.length; i++) {
    const email = allEmails[i];
    if (seen.has(email) || /example|noreply|godaddy|wordpress|wix|squarespace/.test(email)) continue;
    if (/^\d/.test(email)) continue;
    seen.add(email);
    contacts.push(makeContact(email, '', allPhones[i]));
  }

  $("a[href^='mailto:']").each((_, el) => {
    const email = ($(el).attr('href') || '').replace('mailto:', '').split('?')[0].toLowerCase().trim();
    const parent = $(el).closest('tr, li, div, p');
    const ctx = parent.text().trim();
    const c = contacts.find(x => x.email === email);
    if (c && ctx) {
      const nameMatch = ctx.match(/^([A-Z][a-z]+ [A-Z][a-zA-Z'-]+)/);
      if (nameMatch) c.name = nameMatch[1];
      if (HIGH_TITLES.test(ctx)) { c.relevance = 'high'; c.title = ctx.slice(0, 100); }
      else if (MED_TITLES.test(ctx)) { c.relevance = 'medium'; c.title = ctx.slice(0, 100); }
      const phoneMatch = ctx.match(PHONE_RE);
      if (phoneMatch) c.phone = phoneMatch[0];
    }
  });

  return contacts;
}

function makeContact(email, ctx, phone) {
  let relevance = 'low';
  if (HIGH_TITLES.test(email) || /\bit[@.]|tech[@.]|network[@.]/.test(email)) relevance = 'high';
  else if (/manager[@.]|clerk[@.]|finance[@.]|admin[@.]|purchasing[@.]/.test(email)) relevance = 'medium';
  return { name: '', title: 'Staff', department: '', email, phone: phone || '', relevance };
}

// --- Scrape one municipality with current strategy ---
async function scrapeWithStrategy(muni, strategy) {
  const all = [];
  const paths = strategy?.additionalPaths
    ? [...DEFAULT_PATHS, ...strategy.additionalPaths]
    : DEFAULT_PATHS;

  const mainHtml = await fetchPage(muni.website);
  if (mainHtml) all.push(...extractWithStrategy(mainHtml, strategy));

  for (const sub of paths.slice(0, 8)) {
    const url = sub.startsWith('http') ? sub : muni.website.replace(/\/$/, '') + sub;
    await new Promise(r => setTimeout(r, 800));
    const html = await fetchPage(url);
    if (html) all.push(...extractWithStrategy(html, strategy));
  }

  // Dedupe
  const seen = new Set();
  return all.filter(c => {
    if (!c.email || seen.has(c.email)) return false;
    seen.add(c.email);
    return true;
  });
}

// --- Claude API call for fix proposal ---
async function callClaude(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) {
      logError('Claude API non-OK', { status: resp.status, body: await resp.text() });
      return null;
    }
    const data = await resp.json();
    return data?.content?.[0]?.text || null;
  } catch (e) {
    logError('Claude API call failed', e);
    return null;
  }
}

async function proposeFix(muni, baselineCount, currentCount) {
  // Fetch the homepage as the example for the AI to look at.
  const html = await fetchPage(muni.website);
  if (!html) return null;
  const excerpt = html.slice(0, 4000);

  const prompt = `You are debugging a web scraper for an NC municipal website.

Site: ${muni.name}
URL: ${muni.website}
Previous baseline: ${baselineCount} contact emails extracted on past runs.
Current run: only ${currentCount} contacts found.

The scraper uses Cheerio (server-rendered HTML) and looks for email addresses + phone numbers in page text + mailto: links across these default paths: ${DEFAULT_PATHS.join(', ')}.

Here is the first 4000 chars of the homepage HTML:
\`\`\`
${excerpt}
\`\`\`

Suggest a new extraction strategy. Respond with ONLY a JSON object (no prose, no markdown):
{
  "extractionStrategy": "mailto-only" | "regex-text" | "table-rows" | "card-divs" | "json-ld",
  "selectorsToTry": ["css selector 1", "css selector 2"],
  "additionalPaths": ["/extra/path1", "/extra/path2"],
  "reasoning": "one sentence why"
}

Use empty arrays if you have no specific suggestions.`;

  const text = await callClaude(prompt);
  if (!text) return null;

  // Pull the first JSON object from the response.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    logError(`Bad JSON from Claude for ${muni.name}`, e);
    return null;
  }
}

// --- Save scraped contacts to DB ---
async function saveContacts(muni, contacts) {
  for (const c of contacts) {
    await run(
      'INSERT INTO municipal_contacts (municipality_id, name, title, department, email, phone, relevance, source) VALUES (?,?,?,?,?,?,?,?)',
      [muni.id, c.name, c.title, c.department, c.email, c.phone, c.relevance, muni.website]
    );
  }
}

// --- Main scrape entry ---
async function scrapeOne(muni) {
  const config = loadSiteConfig(muni.name);
  let contacts = await scrapeWithStrategy(muni, config?.strategy);

  const baseline = muni.baseline_contacts;
  const isFirstScrape = baseline === null || baseline === 0 || baseline === undefined;

  // Drift detection (only if we have a meaningful baseline)
  if (!isFirstScrape && baseline >= AI_FIX_MIN_BASELINE) {
    const ratio = contacts.length / baseline;
    if (ratio < DRIFT_THRESHOLD) {
      console.log(`    drift: ${contacts.length}/${baseline} = ${(ratio * 100).toFixed(0)}% of baseline`);
      const fix = await proposeFix(muni, baseline, contacts.length);
      if (fix) {
        const file = saveSiteConfig(muni.name, { strategy: fix, drift_event: { baseline, current: contacts.length, at: new Date().toISOString() } });
        console.log(`    AI fix saved -> ${file}`);
        const retry = await scrapeWithStrategy(muni, fix);
        if (retry.length > contacts.length) {
          console.log(`    retry: ${retry.length} contacts (was ${contacts.length})`);
          contacts = retry;
        } else {
          console.log(`    retry didn't help (${retry.length}); flagging for review`);
          await run('UPDATE municipalities SET needs_review = 1 WHERE id = ?', [muni.id]);
        }
      } else {
        console.log('    no AI fix available (no API key, or API call failed); flagging for review');
        await run('UPDATE municipalities SET needs_review = 1 WHERE id = ?', [muni.id]);
      }
    }
  }

  await saveContacts(muni, contacts);

  // Update baseline + last-scrape stats
  const updates = [
    'last_scrape_contacts = ?',
    'last_scrape_at = CURRENT_TIMESTAMP',
    'scraped = 1',
  ];
  const args = [contacts.length];
  if (isFirstScrape && contacts.length >= 1) {
    updates.push('baseline_contacts = ?');
    args.push(contacts.length);
  }
  args.push(muni.id);
  await run(`UPDATE municipalities SET ${updates.join(', ')} WHERE id = ?`, args);

  return contacts;
}

// --- CLI ---
async function main() {
  await initDb();
  const args = process.argv.slice(2);
  const slugIdx = args.indexOf('--slug');
  const rescanIdx = args.indexOf('--rescan');

  let munis;
  if (slugIdx !== -1 && args[slugIdx + 1]) {
    const target = args[slugIdx + 1];
    munis = await query("SELECT * FROM municipalities WHERE LOWER(REPLACE(REPLACE(name, ' ', '-'), ',', '')) LIKE ?", [`%${target.toLowerCase()}%`]);
  } else if (rescanIdx !== -1 && args[rescanIdx + 1] === 'all') {
    munis = await query('SELECT * FROM municipalities ORDER BY population DESC');
  } else {
    // Default: unscraped + flagged-for-review
    munis = await query('SELECT * FROM municipalities WHERE scraped = 0 OR needs_review = 1 ORDER BY population DESC');
  }

  console.log(`\n=== Municipal Scraper v2 ===`);
  console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set (AI fix available)' : 'not set (drift -> mark for review only)'}`);
  console.log(`  Targets: ${munis.length}\n`);

  if (munis.length === 0) {
    console.log('  Nothing to do.');
    return;
  }

  let total = 0;
  for (let i = 0; i < munis.length; i++) {
    const m = munis[i];
    process.stdout.write(`  [${i + 1}/${munis.length}] ${m.name}...`);
    try {
      const contacts = await scrapeOne(m);
      console.log(` ${contacts.length} contacts${m.baseline_contacts ? ` (baseline ${m.baseline_contacts})` : ' (new baseline)'}`);
      total += contacts.length;
    } catch (err) {
      logError(`Scrape failed for ${m.name}`, err);
      console.log(` error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2500));
  }

  console.log(`\n=== Done: ${total} contacts saved ===`);
  const review = await queryOne('SELECT COUNT(*) as c FROM municipalities WHERE needs_review = 1');
  if (review.c > 0) console.log(`  Review queue: ${review.c} sites need attention`);
}

if (require.main === module) {
  main().catch(err => {
    logError('Fatal', err);
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { scrapeOne, proposeFix, loadSiteConfig, saveSiteConfig };
