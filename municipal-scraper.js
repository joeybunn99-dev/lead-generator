require("dotenv").config();
const { initDb, query, queryOne, run } = require("./database");
let cheerio;
try { cheerio = require("cheerio"); } catch { console.error("Need cheerio: npm install cheerio"); process.exit(1); }
const DELAY = 2500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const HIGH_TITLES = /(IT|information technology|technology|telecom|network|CIO|CTO|tech director|systems admin|MIS)/i;
const MED_TITLES = /(town manager|city manager|county manager|finance|purchasing|procurement|clerk|administrative|budget|operations)/i;
const EMAIL_RE = /[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g;
const fs = require("fs");
const path = require("path");

// Load expanded list from JSON if available
let extraMunis = [];
try {
  extraMunis = JSON.parse(fs.readFileSync(path.join(__dirname, "nc-municipalities.json"), "utf8"));
  console.log("Loaded " + extraMunis.length + " from nc-municipalities.json");
} catch { console.log("No nc-municipalities.json found, using hardcoded list only"); }

const HARDCODED = [
  {
    "name": "Town of Clayton",
    "type": "town",
    "county": "Johnston",
    "website": "https://www.townofclaytonnc.org",
    "pop": 26000
  },
  {
    "name": "Town of Smithfield",
    "type": "town",
    "county": "Johnston",
    "website": "https://www.smithfield-nc.com",
    "pop": 12500
  },
  {
    "name": "Johnston County",
    "type": "county",
    "county": "Johnston",
    "website": "https://www.johnstoncountync.org",
    "pop": 220000
  },
  {
    "name": "City of Raleigh",
    "type": "city",
    "county": "Wake",
    "website": "https://www.raleighnc.gov",
    "pop": 480000
  },
  {
    "name": "Town of Cary",
    "type": "town",
    "county": "Wake",
    "website": "https://www.carync.gov",
    "pop": 175000
  },
  {
    "name": "Town of Apex",
    "type": "town",
    "county": "Wake",
    "website": "https://www.apexnc.org",
    "pop": 68000
  },
  {
    "name": "Town of Holly Springs",
    "type": "town",
    "county": "Wake",
    "website": "https://www.hollyspringsnc.us",
    "pop": 45000
  },
  {
    "name": "Town of Fuquay-Varina",
    "type": "town",
    "county": "Wake",
    "website": "https://www.fuquay-varina.org",
    "pop": 35000
  },
  {
    "name": "Town of Wake Forest",
    "type": "town",
    "county": "Wake",
    "website": "https://www.wakeforestnc.gov",
    "pop": 50000
  },
  {
    "name": "Town of Garner",
    "type": "town",
    "county": "Wake",
    "website": "https://www.garnernc.gov",
    "pop": 33000
  },
  {
    "name": "Town of Knightdale",
    "type": "town",
    "county": "Wake",
    "website": "https://www.knightdalenc.gov",
    "pop": 20000
  },
  {
    "name": "Town of Morrisville",
    "type": "town",
    "county": "Wake",
    "website": "https://www.townofmorrisville.org",
    "pop": 30000
  },
  {
    "name": "Wake County",
    "type": "county",
    "county": "Wake",
    "website": "https://www.wake.gov",
    "pop": 1150000
  },
  {
    "name": "City of Durham",
    "type": "city",
    "county": "Durham",
    "website": "https://www.durhamnc.gov",
    "pop": 300000
  },
  {
    "name": "Durham County",
    "type": "county",
    "county": "Durham",
    "website": "https://www.dconc.gov",
    "pop": 330000
  },
  {
    "name": "City of Goldsboro",
    "type": "city",
    "county": "Wayne",
    "website": "https://www.goldsboronc.gov",
    "pop": 34000
  },
  {
    "name": "Wayne County",
    "type": "county",
    "county": "Wayne",
    "website": "https://www.waynegov.com",
    "pop": 125000
  },
  {
    "name": "City of Wilson",
    "type": "city",
    "county": "Wilson",
    "website": "https://www.wilsonnc.org",
    "pop": 50000
  },
  {
    "name": "City of Rocky Mount",
    "type": "city",
    "county": "Nash",
    "website": "https://www.rockymountnc.gov",
    "pop": 55000
  },
  {
    "name": "City of Greenville",
    "type": "city",
    "county": "Pitt",
    "website": "https://www.greenvillenc.gov",
    "pop": 95000
  },
  {
    "name": "Harnett County",
    "type": "county",
    "county": "Harnett",
    "website": "https://www.harnett.org",
    "pop": 135000
  },
  {
    "name": "City of Fayetteville",
    "type": "city",
    "county": "Cumberland",
    "website": "https://www.fayettevillenc.gov",
    "pop": 210000
  },
  {
    "name": "Town of Chapel Hill",
    "type": "town",
    "county": "Orange",
    "website": "https://www.townofchapelhill.org",
    "pop": 62000
  },
  {
    "name": "City of Charlotte",
    "type": "city",
    "county": "Mecklenburg",
    "website": "https://www.charlottenc.gov",
    "pop": 900000
  },
  {
    "name": "City of Greensboro",
    "type": "city",
    "county": "Guilford",
    "website": "https://www.greensboro-nc.gov",
    "pop": 300000
  },
  {
    "name": "City of High Point",
    "type": "city",
    "county": "Guilford",
    "website": "https://www.highpointnc.gov",
    "pop": 115000
  },
  {
    "name": "City of Winston-Salem",
    "type": "city",
    "county": "Forsyth",
    "website": "https://www.cityofws.org",
    "pop": 250000
  },
  {
    "name": "City of Wilmington",
    "type": "city",
    "county": "New Hanover",
    "website": "https://www.wilmingtonnc.gov",
    "pop": 125000
  },
  {
    "name": "City of Asheville",
    "type": "city",
    "county": "Buncombe",
    "website": "https://www.ashevillenc.gov",
    "pop": 95000
  },
  {
    "name": "City of Jacksonville",
    "type": "city",
    "county": "Onslow",
    "website": "https://www.jacksonvillenc.gov",
    "pop": 75000
  },
  {
    "name": "City of Lumberton",
    "type": "city",
    "county": "Robeson",
    "website": "https://www.ci.lumberton.nc.us",
    "pop": 20000
  },
  {
    "name": "Town of Southern Pines",
    "type": "town",
    "county": "Moore",
    "website": "https://www.southernpines.net",
    "pop": 16000
  },
  {
    "name": "Village of Pinehurst",
    "type": "town",
    "county": "Moore",
    "website": "https://www.vopnc.org",
    "pop": 17000
  },
  {
    "name": "City of Concord",
    "type": "city",
    "county": "Cabarrus",
    "website": "https://www.concordnc.gov",
    "pop": 105000
  },
  {
    "name": "City of Gastonia",
    "type": "city",
    "county": "Gaston",
    "website": "https://www.gastonianc.gov",
    "pop": 80000
  },
  {
    "name": "City of Sanford",
    "type": "city",
    "county": "Lee",
    "website": "https://www.sanfordnc.net",
    "pop": 30000
  },
  {
    "name": "Franklin County",
    "type": "county",
    "county": "Franklin",
    "website": "https://www.franklincountync.us",
    "pop": 70000
  },
  {
    "name": "City of Henderson",
    "type": "city",
    "county": "Vance",
    "website": "https://www.hendersonnc.org",
    "pop": 15000
  },
  {
    "name": "City of Kinston",
    "type": "city",
    "county": "Lenoir",
    "website": "https://www.kinstonnc.gov",
    "pop": 20000
  }
];

// Merge: hardcoded (with known-good websites) + JSON file entries (with guessed websites)
const seenNames = new Set(HARDCODED.map(m => m.name.toLowerCase()));
const MUNICIPALITIES = [...HARDCODED];
for (const m of extraMunis) {
  if (!seenNames.has(m.name.toLowerCase())) {
    seenNames.add(m.name.toLowerCase());
    MUNICIPALITIES.push(m);
  }
}
console.log("Total municipalities to process: " + MUNICIPALITIES.length);

async function fetchPage(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, { headers: {"User-Agent": UA}, signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

function extractContacts(html) {
  const $ = cheerio.load(html);
  const contacts = [], seen = new Set();
  const fullText = $.text();
  const allEmails = fullText.match(EMAIL_RE) || [];
  const allPhones = fullText.match(PHONE_RE) || [];
  allEmails.forEach((email, i) => {
    email = email.toLowerCase().trim();
    if (seen.has(email) || /example|noreply|godaddy|wordpress|wix|squarespace/.test(email)) return;
    if (/^\d/.test(email)) return;
    seen.add(email);
    let relevance = "low";
    if (HIGH_TITLES.test(email) || /\bit[@.]|tech[@.]|network[@.]/.test(email)) relevance = "high";
    else if (/manager[@.]|clerk[@.]|finance[@.]|admin[@.]|purchasing[@.]/.test(email)) relevance = "medium";
    contacts.push({ name: "", title: "Staff", department: "", email, phone: allPhones[i] || "", relevance });
  });
  $("a[href^='mailto:']").each((_, el) => {
    const email = ($(el).attr("href") || "").replace("mailto:", "").split("?")[0].toLowerCase().trim();
    const parent = $(el).closest("tr, li, div, p");
    const context = parent.text().trim();
    const c = contacts.find(x => x.email === email);
    if (c && context) {
      const nameMatch = context.match(/^([A-Z][a-z]+ [A-Z][a-zA-Z'-]+)/);
      if (nameMatch) c.name = nameMatch[1];
      if (HIGH_TITLES.test(context)) { c.relevance = "high"; c.title = context.slice(0, 100); }
      else if (MED_TITLES.test(context)) { c.relevance = "medium"; c.title = context.slice(0, 100); }
      const phoneMatch = context.match(PHONE_RE);
      if (phoneMatch) c.phone = phoneMatch[0];
    }
  });
  return contacts;
}

async function scrapeMuni(muni) {
  const subs = ["/staff", "/directory", "/staff-directory", "/departments", "/contact", "/contact-us",
    "/government/departments", "/about/staff", "/administration"];
  let all = [];
  const mainHtml = await fetchPage(muni.website);
  if (mainHtml) {
    all.push(...extractContacts(mainHtml));
    const $ = cheerio.load(mainHtml);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().toLowerCase();
      if (/staff|directory|department|contact|team|employee/.test(text)) {
        try { const u = new URL(href, muni.website).href; if (!subs.includes(u)) subs.push(u); } catch {}
      }
    });
  }
  for (const sub of subs.slice(0, 6)) {
    const url = sub.startsWith("http") ? sub : muni.website.replace(/\/$/, "") + sub;
    await new Promise(r => setTimeout(r, 800));
    const html = await fetchPage(url);
    if (html) all.push(...extractContacts(html));
  }
  const seen = new Set();
  return all.filter(c => { if (!c.email || seen.has(c.email)) return false; seen.add(c.email); return true; });
}

async function main() {
  await initDb();
  console.log("\n=== Municipal Contact Scraper ===\n");
  console.log("  Municipalities: " + MUNICIPALITIES.length);
  for (const m of MUNICIPALITIES) {
    const ex = await queryOne("SELECT id FROM municipalities WHERE name = ? AND county = ?", [m.name, m.county]);
    if (!ex) await run("INSERT INTO municipalities (name, type, county, website, population) VALUES (?, ?, ?, ?, ?)",
      [m.name, m.type, m.county, m.website, m.pop]);
  }
  const unscraped = await query("SELECT * FROM municipalities WHERE scraped = 0 ORDER BY population DESC");
  console.log("  Unscraped: " + unscraped.length + "\n");
  let totalContacts = 0;
  for (let i = 0; i < unscraped.length; i++) {
    const m = unscraped[i];
    process.stdout.write("  [" + (i + 1) + "/" + unscraped.length + "] " + m.name + "...");
    try {
      const contacts = await withRetry(
        () => scrapeMuni(m),
        `Scraping ${m.name} (${m.website})`
      );
      if (contacts.length) {
        for (const c of contacts) {
          await run("INSERT INTO municipal_contacts (municipality_id, name, title, department, email, phone, relevance, source) VALUES (?,?,?,?,?,?,?,?)",
            [m.id, c.name, c.title, c.department, c.email, c.phone, c.relevance, m.website]);
        }
        totalContacts += contacts.length;
        console.log(" " + contacts.length + " contacts");
      } else { console.log(" none"); }
    } catch (err) {
      logError(`Failed to scrape ${m.name}`, err);
      console.log(" error: " + err.message);
    }
    await run("UPDATE municipalities SET scraped = 1 WHERE id = ?", [m.id]);
    await new Promise(r => setTimeout(r, DELAY));
  }
  const stats = await queryOne("SELECT COUNT(*) as c FROM municipal_contacts");
  const high = await queryOne("SELECT COUNT(*) as c FROM municipal_contacts WHERE relevance = 'high'");
  const withPhone = await queryOne("SELECT COUNT(*) as c FROM municipal_contacts WHERE phone IS NOT NULL AND phone != ''");
  console.log("\n=== Done ===");
  console.log("  Total contacts: " + stats.c);
  console.log("  With phone: " + withPhone.c);
  console.log("  High relevance (IT/telecom): " + high.c);
}

// --- Error Logging ---
const ERROR_LOG = path.resolve(__dirname, 'errors.log');
function logError(context, err) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [municipal-scraper] ${context}: ${err.message || err}\n`;
  try { fs.appendFileSync(ERROR_LOG, line); } catch {}
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
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/*
 * ENRICHMENT INTEGRATION NOTES (March 2026 Research):
 *
 * Apify (apify.com):
 *   - Pre-built scrapers (Actors) for Google Maps, LinkedIn, Instagram
 *   - Could replace/supplement custom scrapers — connect Apify → n8n → our database
 *   - Google Maps Actor: scrape business data by location/category (NC municipalities)
 *
 * MarketBetter (marketbetter.ai):
 *   - Free, no signup, unlimited company lookups
 *   - Cross-reference municipal scraper data for tech stack, funding info
 *
 * Prospeo (prospeo.io):
 *   - 98% email accuracy, 75 free emails/month
 *   - Validate IT/telecom contact emails found by this scraper
 *
 * Self-healing n8n workflows (Nate Herk pattern):
 *   - Build error-handler workflow that triggers on ANY n8n failure
 *   - Connect to Claude Code via MCP server for auto-diagnosis and fix
 */

main().catch(err => {
  logError('Fatal error in main', err);
  console.error("Fatal:", err);
  process.exit(1);
});
