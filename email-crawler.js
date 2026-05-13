/**
 * Email Crawler — Scrapes company websites to find contact emails
 *
 * Crawls each company's website (homepage + /contact, /about pages)
 * and extracts email addresses from mailto: links and text patterns.
 *
 * Usage:
 *   node email-crawler.js              # Crawl all companies with websites but no email
 *   node email-crawler.js --limit 100  # Crawl 100 companies
 *   node email-crawler.js --resume     # Resume from where it left off
 *   node email-crawler.js --test       # Test with 5 companies, don't save
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

// --- Config ---
const CONCURRENCY = 3;          // Simultaneous requests (be respectful)
const DELAY_MS = 1500;          // Delay between batches
const TIMEOUT_MS = 8000;        // Per-request timeout
const MAX_PAGES_PER_SITE = 4;   // Homepage + contact/about variants

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

// Common contact page paths to try
const CONTACT_PATHS = [
  '/contact', '/contact-us', '/contactus',
  '/about', '/about-us', '/aboutus',
  '/connect', '/get-in-touch',
];

// Email patterns to ignore (generic/spam traps)
const IGNORED_EMAILS = new Set([
  'noreply', 'no-reply', 'donotreply', 'mailer-daemon',
  'postmaster', 'webmaster', 'admin@wordpress',
  'email@example', 'your@email', 'name@domain',
  'test@test', 'user@example', 'info@example',
  'sentry', 'wix', 'squarespace', 'wordpress',
]);

// --- Database ---
let db;
async function initDb() {
  const url = process.env.TURSO_DATABASE_URL
    || `file:${path.resolve(__dirname, 'leads.db').replace(/\\/g, '/')}`;
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
  db = createClient(authToken ? { url, authToken } : { url });

  // Add email_crawled column if not exists
  try {
    await db.execute('ALTER TABLE companies ADD COLUMN email_crawled INTEGER DEFAULT 0');
    console.log('[db] Added email_crawled column');
  } catch (e) {
    // Column already exists
  }
}

// --- Email Quality Tiers ---
// A = personal (best), B = business general (good), C = generic (ok), D = junk (skip)
function getEmailTier(email) {
  if (!email || !email.includes('@')) return 'D';
  const parts = email.split('@');
  const local = (parts[0] || '').toLowerCase();
  const domain = (parts[1] || '').toLowerCase();

  // D-tier: junk — registrar abuse, webmaster, noreply, admin
  const junk = ['abuse', 'webmaster', 'postmaster', 'hostmaster', 'noreply',
    'no-reply', 'donotreply', 'mailer-daemon', 'root', 'admin',
    'administrator', 'dns', 'ftp', 'ssl', 'cpanel',
    'domain.operations', 'privacy', 'proxy', 'registrar',
    'devnull', 'null', 'nobody', 'spam', 'virus'];
  if (junk.some(j => local === j || local.startsWith(j + '.'))) return 'D';

  // D-tier: registrar/hosting/WHOIS privacy emails
  const junkDomains = ['godaddy.com', 'namecheap.com', 'squarespace.com',
    'registrar.eu', 'web.com', 'tucows.com', 'enom.com',
    'networksolutions.com', 'register.com', 'publicdomainregistry.com',
    'whoisguard.com', 'domainsbyproxy.com', 'contactprivacy.com',
    'withheldforprivacy.com', 'privacyprotect.org', 'identity-protect.org',
    'whoisprivacyprotect.com', 'privacyguardian.org', 'domainprivacygroup.com',
    'privacy.above.com', 'protecteddomainservices.com', 'perfectprivacy.com',
    'whoisprotectservice.com', 'privateemail.net', 'domains-by-proxy.com',
    'dnstinations.com', '1and1-private-registration.com', 'gandi.net',
    'proxieddomains.com', 'whoisproxy.org'];
  if (junkDomains.some(d => domain.endsWith(d))) return 'D';

  // B-tier: business general — someone reads these
  const bTier = ['info', 'contact', 'hello', 'office', 'sales', 'frontdesk',
    'reception', 'front', 'booking', 'appointments', 'reservations'];
  if (bTier.includes(local)) return 'B';

  // C-tier: generic/departmental — lower value
  const cTier = ['support', 'service', 'help', 'team', 'staff', 'hr',
    'careers', 'jobs', 'press', 'media', 'marketing',
    'general', 'mail', 'email', 'enquiries', 'inquiries',
    'main', 'billing', 'accounting', 'legal', 'operations',
    'dispatch', 'scheduling', 'maintenance', 'it', 'tech',
    'feedback', 'complaints', 'returns', 'orders', 'purchasing'];
  if (cTier.includes(local)) return 'C';

  // A-tier: clearly personal emails
  // Role words that disqualify dotted locals from being personal names
  const roleWords = new Set([...bTier, ...cTier, ...junk,
    'web', 'admin', 'dept', 'group', 'customer', 'company',
    'corporate', 'digital', 'online', 'system', 'systems']);

  // firstname.lastname@ or firstname_lastname@ (contains separator + all alpha segments)
  if (/^[a-z]+[._][a-z]+$/.test(local)) {
    const segments = local.split(/[._]/);
    const hasRoleWord = segments.some(s => roleWords.has(s));
    if (!hasRoleWord) return 'A';
    // Has a role word like web.admin or tech.support — treat as C
    return 'C';
  }
  // flastname@ pattern (single letter + name, e.g., jsmith@)
  if (/^[a-z][a-z]{2,}$/.test(local) && local.length >= 4 && local.length <= 15) return 'A';

  // Default B for anything else that doesn't match known patterns
  return 'B';
}

// --- Email Extraction ---
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(html, domain) {
  const $ = cheerio.load(html);
  const found = new Set();

  // Method 1: mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
    if (email && email.includes('@')) found.add(email);
  });

  // Method 2: Regex scan of visible text
  const bodyText = $('body').text();
  const matches = bodyText.match(EMAIL_REGEX) || [];
  matches.forEach(m => found.add(m.toLowerCase()));

  // Method 3: Regex scan of raw HTML (catches hidden/encoded emails)
  const rawMatches = html.match(EMAIL_REGEX) || [];
  rawMatches.forEach(m => found.add(m.toLowerCase()));

  // Filter out garbage
  const cleaned = [...found].filter(email => {
    // Must have valid TLD
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const domainPart = parts[1];

    // Skip image files, CSS, JS that match email pattern
    if (/\.(png|jpg|jpeg|gif|svg|css|js|woff|ico)$/i.test(email)) return false;

    // Skip ignored patterns
    for (const ignored of IGNORED_EMAILS) {
      if (email.includes(ignored)) return false;
    }

    // Skip very long emails (probably not real)
    if (email.length > 50) return false;

    // Skip emails that start with numbers (phone number mashups)
    if (/^[0-9]/.test(email)) return false;

    // Skip if local part has phone-like patterns
    if (/\d{3}.*\d{3}/.test(parts[0])) return false;

    // Skip placeholder emails
    const placeholders = ['user@domain', 'example@domain', 'your@email', 'you@your',
      'someone@', 'name@domain', 'email@example'];
    if (placeholders.some(p => email.includes(p))) return false;

    // Skip if local part ends with mashed words from scraping
    if (/(?:phone|bottom|comtol|homeour|legal|social|address|contact\d)$/.test(parts[0])) return false;

    // Skip emails from common third-party domains
    const skipDomains = ['sentry.io', 'wixpress.com', 'squarespace.com', 'googleapis.com',
      'google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com',
      'linkedin.com', 'apple.com', 'microsoft.com', 'amazon.com', 'cloudflare.com',
      'w3.org', 'schema.org', 'jquery.com', 'bootstrapcdn.com', 'fontawesome.com',
      'googletagmanager.com', 'doubleclick.net', 'gstatic.com', 'gravatar.com'];
    if (skipDomains.some(d => domainPart.endsWith(d))) return false;

    return true;
  });

  // Prioritize: emails matching the company's domain first
  if (domain) {
    const domainClean = domain.replace(/^www\./, '').toLowerCase();
    cleaned.sort((a, b) => {
      const aMatch = a.endsWith(domainClean) ? 0 : 1;
      const bMatch = b.endsWith(domainClean) ? 0 : 1;
      return aMatch - bMatch;
    });
  }

  return cleaned;
}

// --- Web Fetcher ---
async function fetchPage(url) {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  try {
    const resp = await axios.get(url, {
      timeout: TIMEOUT_MS,
      maxRedirects: 3,
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // Don't download huge files
      maxContentLength: 2 * 1024 * 1024, // 2MB max
    });
    return resp.data;
  } catch (e) {
    return null;
  }
}

function normalizeUrl(website) {
  let url = website.trim();
  if (!url.startsWith('http')) url = 'https://' + url;
  // Remove trailing slash
  url = url.replace(/\/+$/, '');
  return url;
}

// --- Google Search Scraping ---
async function googleSearchEmails(companyName, domain) {
  const emails = [];
  const query = encodeURIComponent(`"${companyName}" email @${domain}`);
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    const resp = await axios.get(`https://www.google.com/search?q=${query}&num=5`, {
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9' },
      maxRedirects: 3,
    });
    const matches = resp.data.match(EMAIL_REGEX) || [];
    matches.forEach(m => {
      const email = m.toLowerCase();
      if (email.endsWith(domain)) emails.push(email);
    });
  } catch (e) {
    // Google might block us — that's fine, just skip
  }
  return emails;
}

// --- WHOIS Lookup ---
async function whoisEmails(domain) {
  const emails = [];
  try {
    // Use a free WHOIS API
    const resp = await axios.get(`https://rdap.org/domain/${domain}`, {
      timeout: TIMEOUT_MS,
      headers: { 'Accept': 'application/json' },
    });
    const data = resp.data;

    // RDAP format has vcardArray with contact info
    if (data.entities) {
      for (const entity of data.entities) {
        const vcard = entity.vcardArray;
        if (!vcard || !Array.isArray(vcard[1])) continue;
        for (const field of vcard[1]) {
          if (field[0] === 'email' && field[3]) {
            emails.push(field[3].toLowerCase());
          }
        }
        // Check nested entities (tech contact, admin contact)
        if (entity.entities) {
          for (const sub of entity.entities) {
            const sv = sub.vcardArray;
            if (!sv || !Array.isArray(sv[1])) continue;
            for (const field of sv[1]) {
              if (field[0] === 'email' && field[3]) {
                emails.push(field[3].toLowerCase());
              }
            }
          }
        }
      }
    }
  } catch (e) {
    // WHOIS lookup failed — privacy protection or rate limited
  }
  return emails;
}

// --- Social Media Link Extraction ---
function extractSocialLinks(html) {
  const $ = cheerio.load(html);
  const links = { facebook: null, linkedin: null, twitter: null, instagram: null, yelp: null };

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase();
    if (href.includes('facebook.com/') && !href.includes('facebook.com/sharer')) {
      links.facebook = href;
    } else if (href.includes('linkedin.com/company/') || href.includes('linkedin.com/in/')) {
      links.linkedin = href;
    } else if (href.includes('twitter.com/') || href.includes('x.com/')) {
      links.twitter = href;
    } else if (href.includes('instagram.com/')) {
      links.instagram = href;
    } else if (href.includes('yelp.com/biz/')) {
      links.yelp = href;
    }
  });

  return links;
}

async function scrapeEmailFromFacebook(fbUrl) {
  if (!fbUrl) return [];
  try {
    // Facebook about pages sometimes show email
    const aboutUrl = fbUrl.replace(/\/$/, '') + '/about';
    const html = await fetchPage(aboutUrl);
    if (!html) return [];
    const matches = html.match(EMAIL_REGEX) || [];
    return matches.map(m => m.toLowerCase()).filter(e =>
      !e.includes('facebook.com') && !e.includes('fbcdn')
    );
  } catch (e) {
    return [];
  }
}

async function scrapeEmailFromYelp(yelpUrl) {
  if (!yelpUrl) return [];
  try {
    const html = await fetchPage(yelpUrl);
    if (!html) return [];
    const matches = html.match(EMAIL_REGEX) || [];
    return matches.map(m => m.toLowerCase()).filter(e =>
      !e.includes('yelp.com') && !e.includes('yelpcdn')
    );
  } catch (e) {
    return [];
  }
}

// --- Common Email Pattern Guessing ---
function guessCommonEmails(domain) {
  return [
    `info@${domain}`,
    `contact@${domain}`,
    `hello@${domain}`,
    `office@${domain}`,
    `sales@${domain}`,
  ];
}

// --- Crawl One Company ---
async function crawlCompany(company) {
  const baseUrl = normalizeUrl(company.website);
  const domain = company.domain || new URL(baseUrl).hostname.replace(/^www\./, '');
  // Map<email, discovery_method> — first method to find an email wins
  const emailMethods = new Map();
  const sources = { website: 0, google: 0, whois: 0, social: 0 };
  let socialLinks = {};

  const tag = (foundEmails, method) => {
    for (const e of foundEmails) {
      if (!emailMethods.has(e)) emailMethods.set(e, method);
    }
  };

  // === Method 1: Crawl homepage (extracted-html) ===
  const homepage = await fetchPage(baseUrl);
  if (homepage) {
    const found = extractEmails(homepage, domain);
    tag(found, 'extracted-html');
    sources.website += found.length;
    socialLinks = extractSocialLinks(homepage);
  }

  // === Method 2: Contact/about pages (extracted-html) ===
  if (emailMethods.size < 3) {
    for (const contactPath of CONTACT_PATHS) {
      if (emailMethods.size >= 5) break;
      const contactUrl = baseUrl + contactPath;
      const page = await fetchPage(contactUrl);
      if (page) {
        const found = extractEmails(page, domain);
        tag(found, 'extracted-html');
        sources.website += found.length;
        if (!socialLinks.facebook || !socialLinks.linkedin) {
          const moreSocial = extractSocialLinks(page);
          Object.keys(moreSocial).forEach(k => {
            if (moreSocial[k] && !socialLinks[k]) socialLinks[k] = moreSocial[k];
          });
        }
      }
      await sleep(500);
    }
  }

  // === Method 3: Google Search (extracted-search) ===
  if (emailMethods.size === 0) {
    const googleEmails = await googleSearchEmails(company.name, domain);
    tag(googleEmails, 'extracted-search');
    sources.google += googleEmails.length;
    await sleep(1000);
  }

  // === Method 4: WHOIS Lookup (extracted-whois) ===
  if (emailMethods.size === 0) {
    const whoisResults = await whoisEmails(domain);
    tag(whoisResults, 'extracted-whois');
    sources.whois += whoisResults.length;
  }

  // === Method 5: Social Media Scraping (extracted-social) ===
  if (emailMethods.size === 0) {
    const fbEmails = await scrapeEmailFromFacebook(socialLinks.facebook);
    tag(fbEmails, 'extracted-social');
    const yelpEmails = await scrapeEmailFromYelp(socialLinks.yelp);
    tag(yelpEmails, 'extracted-social');
    sources.social += fbEmails.length + yelpEmails.length;
  }

  // === Method 6: Pattern guesses as last resort (inferred-pattern) ===
  // These are unverified guesses — flagged so scoring can demote them.
  if (emailMethods.size === 0 && domain) {
    const guesses = guessCommonEmails(domain);
    tag(guesses, 'inferred-pattern');
  }

  // Return as array of {email, method} so saveEmails can write discovery_method.
  const emails = [...emailMethods.entries()].map(([email, method]) => ({ email, method }));
  return { emails, socialLinks, sources };
}

// --- Save Results ---
async function saveEmails(companyId, companyName, emails, socialLinks) {
  let saved = 0;
  let skipped = 0;

  for (const item of emails) {
    // Accept either a plain string (legacy) or {email, method}.
    const email = typeof item === 'string' ? item : item.email;
    const method = typeof item === 'string' ? 'extracted-html' : (item.method || 'extracted-html');
    const tier = getEmailTier(email);

    // Skip D-tier junk entirely
    if (tier === 'D') {
      skipped++;
      continue;
    }

    // Check if this email already exists for this company
    const existing = await db.execute({
      sql: 'SELECT id FROM contacts WHERE company_id = ? AND email = ?',
      args: [companyId, email],
    });

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO contacts (company_id, name, title, email, source, email_status, email_tier, discovery_method)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [companyId, companyName, 'Website Contact', email, 'email-crawler', 'unverified', tier, method],
      });
      saved++;
    }
  }

  // Save social links if we found any
  if (socialLinks && Object.values(socialLinks).some(v => v)) {
    const links = JSON.stringify(socialLinks);
    try {
      await db.execute({
        sql: 'UPDATE companies SET social_links = ? WHERE id = ?',
        args: [links, companyId],
      });
    } catch (e) {
      // social_links column might not exist yet
    }
  }

  // Mark company as crawled
  await db.execute({
    sql: 'UPDATE companies SET email_crawled = 1 WHERE id = ?',
    args: [companyId],
  });
}

// --- Utilities ---
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes('--test');
  const isResume = args.includes('--resume');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : (isTest ? 5 : null);

  await initDb();

  // Resume: skip already-processed companies from previous run
  let resumeOffset = 0;
  if (isResume) {
    const state = loadResumeState();
    if (state && state.lastProcessedIdx > 0) {
      resumeOffset = state.lastProcessedIdx + CONCURRENCY;
      console.log(`[resume] Resuming from index ${resumeOffset} (prev: ${state.found || 0} found, ${state.failed || 0} failed)`);
    } else {
      console.log('[resume] No resume state found, starting from beginning');
    }
  }

  // Get companies with websites but haven't been email-crawled yet
  // Sort by proximity to Bunn, NC (35.4625, -78.2597) — closest first
  let query = `SELECT id, name, website, domain, lat, lng,
               CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
                 THEN ((lat - 35.4625) * (lat - 35.4625)) + ((lng - (-78.2597)) * (lng - (-78.2597)))
                 ELSE 999999 END as dist
               FROM companies
               WHERE website IS NOT NULL AND website != ''
               AND email_crawled = 0
               ORDER BY dist ASC`;
  if (limit) query += ` LIMIT ${limit}`;

  const { rows: companies } = await db.execute(query);

  // Stats
  const totalWithWebsite = (await db.execute(
    "SELECT COUNT(*) as c FROM companies WHERE website IS NOT NULL AND website != ''"
  )).rows[0].c;
  const alreadyCrawled = (await db.execute(
    "SELECT COUNT(*) as c FROM companies WHERE email_crawled = 1"
  )).rows[0].c;
  const existingEmails = (await db.execute(
    "SELECT COUNT(*) as c FROM contacts WHERE email IS NOT NULL AND email != ''"
  )).rows[0].c;

  console.log('\n=== Email Crawler ===\n');
  console.log(`  Companies with websites: ${totalWithWebsite}`);
  console.log(`  Already crawled:         ${alreadyCrawled}`);
  console.log(`  Remaining:               ${companies.length}`);
  console.log(`  Existing emails:         ${existingEmails}`);
  console.log(`  Mode:                    ${isTest ? 'TEST (no save)' : 'LIVE'}`);
  console.log(`  Concurrency:             ${CONCURRENCY}`);
  console.log('');

  if (companies.length === 0) {
    console.log('Nothing to crawl! All companies have been processed.');
    return;
  }

  // Add social_links column if not exists
  try {
    await db.execute('ALTER TABLE companies ADD COLUMN social_links TEXT');
    console.log('[db] Added social_links column');
  } catch (e) {}

  let found = 0;
  let failed = 0;
  let noEmail = 0;
  let socialOnly = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < companies.length; i += CONCURRENCY) {
    const batch = companies.slice(i, i + CONCURRENCY);

    const results = await Promise.all(batch.map(async (company) => {
      try {
        const result = await withRetry(
          () => crawlCompany(company),
          `Crawling ${company.name} (${company.website})`
        );
        return { company, ...result, error: null };
      } catch (e) {
        return { company, emails: [], socialLinks: {}, sources: {}, error: e.message };
      }
    }));

    for (const { company, emails, socialLinks, sources, error } of results) {
      if (error) {
        failed++;
        continue;
      }

      const idx = i + results.indexOf(results.find(r => r.company === company)) + 1;

      if (emails.length > 0) {
        found++;
        // emails are now {email, method} objects; flatten for display.
        const emailStrs = emails.map(e => typeof e === 'string' ? e : e.email);
        const display = emailStrs.slice(0, 3).join(', ');
        const extra = emails.length > 3 ? ` +${emails.length - 3} more` : '';
        const src = Object.entries(sources).filter(([k,v]) => v > 0).map(([k]) => k).join('+') || 'website';
        const social = Object.values(socialLinks).filter(Boolean).length;
        const socialTag = social > 0 ? ` [${social} social]` : '';
        console.log(`  [${idx}/${companies.length}] ${company.name} -> ${display}${extra} (${src})${socialTag}`);

        if (!isTest) {
          await saveEmails(company.id, company.name, emails, socialLinks);
        }
      } else {
        noEmail++;
        const social = Object.values(socialLinks).filter(Boolean).length;
        if (social > 0) {
          socialOnly++;
          if (!isTest && socialLinks) {
            try {
              await db.execute({
                sql: 'UPDATE companies SET social_links = ? WHERE id = ?',
                args: [JSON.stringify(socialLinks), company.id],
              });
            } catch (e) {}
          }
        }
        if (!isTest) {
          await db.execute({
            sql: 'UPDATE companies SET email_crawled = 1 WHERE id = ?',
            args: [company.id],
          });
        }
      }
    }

    // Progress update every 30 companies + save resume state
    const processed = Math.min(i + CONCURRENCY, companies.length);
    saveResumeState(i, { found, failed, noEmail, socialOnly, total: companies.length });
    if (processed % 30 === 0 || processed === companies.length) {
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      const remaining = (companies.length - processed) / rate;
      console.log(`\n  --- Progress: ${processed}/${companies.length} | Found: ${found} | Empty: ${noEmail} | Failed: ${failed} | ETA: ${formatTime(remaining * 1000)} ---\n`);
    }

    // Rate limit delay
    if (i + CONCURRENCY < companies.length) {
      await sleep(DELAY_MS);
    }
  }

  // Final stats
  const elapsed = Date.now() - startTime;
  const newEmails = isTest ? found : (await db.execute(
    "SELECT COUNT(*) as c FROM contacts WHERE email IS NOT NULL AND email != ''"
  )).rows[0].c - existingEmails;

  console.log('\n=== Done! ===\n');
  console.log(`  Time:           ${formatTime(elapsed)}`);
  console.log(`  Crawled:        ${companies.length} websites`);
  console.log(`  Found emails:   ${found} companies (${(found / companies.length * 100).toFixed(1)}% hit rate)`);
  console.log(`  Social only:    ${socialOnly} companies (no email but found social links)`);
  console.log(`  No email:       ${noEmail} companies`);
  console.log(`  Failed:         ${failed} companies`);
  console.log(`  New emails:     ${newEmails}`);
  console.log(`  Total emails:   ${existingEmails + newEmails}`);
  console.log('');
}

// --- Error Logging ---
const ERROR_LOG = path.resolve(__dirname, 'errors.log');
function logError(context, err) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [email-crawler] ${context}: ${err.message || err}\n`;
  try { fs.appendFileSync(ERROR_LOG, line); } catch {}
  console.error(`  [ERROR] ${context}: ${err.message || err}`);
}

// --- Resume State ---
const RESUME_FILE = path.resolve(__dirname, '.email-crawler-resume.json');
function saveResumeState(lastProcessedIdx, stats) {
  try {
    fs.writeFileSync(RESUME_FILE, JSON.stringify({ lastProcessedIdx, ...stats, savedAt: new Date().toISOString() }));
  } catch {}
}
function loadResumeState() {
  try {
    if (fs.existsSync(RESUME_FILE)) return JSON.parse(fs.readFileSync(RESUME_FILE, 'utf8'));
  } catch {}
  return null;
}

// --- Retry with Exponential Backoff ---
async function withRetry(fn, context, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) {
        logError(`${context} (attempt ${attempt}/${maxRetries} — giving up)`, err);
        throw err;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
      logError(`${context} (attempt ${attempt}/${maxRetries} — retrying in ${(delay/1000).toFixed(1)}s)`, err);
      await sleep(delay);
    }
  }
}

/*
 * ENRICHMENT INTEGRATION NOTES (March 2026 Research):
 *
 * MarketBetter (marketbetter.ai):
 *   - FREE, no signup, unlimited individual company lookups
 *   - Use to verify/enrich scraped company data (revenue, employee count, tech stack)
 *   - Could add a --enrich flag to cross-reference with MarketBetter API
 *
 * Prospeo (prospeo.io):
 *   - 75 free emails/month at 98% accuracy
 *   - Use to VALIDATE emails this crawler finds before sending campaigns
 *   - Add email_verified column + Prospeo validation pass
 *   - API: POST https://api.prospeo.io/email-verifier with { email }
 *
 * Apollo.io:
 *   - 275M+ contacts, forever free tier (100 credits/month, 65+ filters)
 *   - Cross-reference our NC data to fill gaps (phone numbers, titles)
 *
 * Clay ($134/mo for 24K credits):
 *   - Multi-source enrichment waterfall — verified emails, phone, tech stack, funding
 *   - $0.14-$0.67 per enriched lead, but 20-30% miss rate charges credits too
 *
 * Leadfeeder (free Lite plan):
 *   - Identifies companies visiting bunncom.com — inbound intent signals for free
 *
 * 2026 Trend: Industry shifted from "send more messages" to "decide WHO to contact
 * and WHEN." Add lead scoring based on signals (job changes, funding, website activity).
 */

main().catch(err => {
  logError('Fatal error in main', err);
  process.exit(1);
});
