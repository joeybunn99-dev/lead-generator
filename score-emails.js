/**
 * One-time script to score all existing emails with quality tiers
 * Run: node score-emails.js
 */

const { createClient } = require('@libsql/client');
const path = require('path');

// Methods that aren't observed evidence — pure guesses or catch-all noise.
// Emails with these methods are capped at tier C even if their local part looks like a name.
const INFERRED_METHODS = new Set(['inferred-pattern', 'inferred-catchall']);

function capInferredAtC(tier, discoveryMethod) {
  if (!discoveryMethod) return tier;
  if (INFERRED_METHODS.has(discoveryMethod) && (tier === 'A' || tier === 'B')) return 'C';
  return tier;
}

function getEmailTier(email, discoveryMethod) {
  if (!email || !email.includes('@')) return 'D';
  const local = email.split('@')[0].toLowerCase();
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!domain) return 'D';

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

async function main() {
  const url = `file:${path.resolve(__dirname, 'leads.db').replace(/\\/g, '/')}`;
  const db = createClient({ url });

  // Add column if needed
  try { await db.execute('ALTER TABLE contacts ADD COLUMN email_tier TEXT DEFAULT "unknown"'); } catch (e) {}

  const { rows } = await db.execute("SELECT id, email, discovery_method FROM contacts WHERE email IS NOT NULL AND email != ''");
  console.log(`Scoring ${rows.length} emails...\n`);

  const tiers = { A: 0, B: 0, C: 0, D: 0 };
  let capped = 0;

  for (const row of rows) {
    const rawTier = getEmailTier(row.email);
    const tier = capInferredAtC(rawTier, row.discovery_method);
    if (tier !== rawTier) capped++;
    tiers[tier]++;
    await db.execute({ sql: 'UPDATE contacts SET email_tier = ? WHERE id = ?', args: [tier, row.id] });
  }
  if (capped > 0) console.log(`  ${capped} emails demoted to C (inferred-pattern or inferred-catchall, no observed evidence)\n`);

  console.log('Results:');
  console.log(`  A (personal):  ${tiers.A} — best, goes to a real person`);
  console.log(`  B (business):  ${tiers.B} — good, info@/sales@/contact@`);
  console.log(`  C (generic):   ${tiers.C} — ok, support@/marketing@/team@`);
  console.log(`  D (junk):      ${tiers.D} — skip, registrar/abuse emails`);
  console.log(`\nTotal: ${rows.length}`);
}

main().catch(console.error);
