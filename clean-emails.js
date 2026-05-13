/**
 * Clean bad emails from the database
 *
 * DRY RUN by default -- shows what would be deleted without touching the DB.
 * Run with --execute to actually delete.
 *
 * Usage:
 *   node clean-emails.js              # Dry run — report only
 *   node clean-emails.js --execute    # Actually delete bad emails
 */
const { createClient } = require('@libsql/client');
const path = require('path');

const EXECUTE = process.argv.includes('--execute');

// Known junk emails to remove outright
const JUNK_EMAILS = new Set([
  'abuse@godaddy.com',
  'domain.operations@web.com',
  'sample@sample.com',
  'test@test.com',
  'example@example.com',
  'noreply@godaddy.com',
  'noreply@namecheap.com',
]);

// WHOIS privacy proxy domains — emails from these are useless
const PRIVACY_DOMAINS = [
  'domainsbyproxy.com', 'domains-by-proxy.com', 'whoisguard.com',
  'contactprivacy.com', 'withheldforprivacy.com', 'privacyprotect.org',
  'identity-protect.org', 'whoisprivacyprotect.com', 'privacyguardian.org',
  'domainprivacygroup.com', 'privacy.above.com', 'protecteddomainservices.com',
  'perfectprivacy.com', 'whoisprotectservice.com', 'privateemail.net',
  'dnstinations.com', '1and1-private-registration.com', 'proxieddomains.com',
  'whoisproxy.org',
];

function isBadEmail(email) {
  if (!email || !email.includes('@')) return 'no @ sign';
  const parts = email.split('@');
  if (parts.length !== 2) return 'multiple @ signs';

  const local = parts[0];
  const domain = parts[1].toLowerCase();

  // Known junk
  if (JUNK_EMAILS.has(email.toLowerCase())) return 'known junk email';

  // Privacy proxy domains
  for (const pd of PRIVACY_DOMAINS) {
    if (domain.endsWith(pd)) return `privacy proxy (${pd})`;
  }

  // Too long
  if (email.length > 50) return `too long (${email.length} chars)`;

  // Starts with number (phone number mashup)
  if (/^[0-9]/.test(local)) return 'starts with number';

  // Phone number mashed into local part (e.g., 252-237-1156abco@)
  if (/\d{3}[.\-]?\d{3}[.\-]?\d{4}/.test(local)) return 'phone number in local part';
  if (/\d{3}.*\d{3}/.test(local)) return 'phone-like digits in local part';

  // Placeholder emails
  const placeholders = ['user@domain', 'example@domain', 'your@email', 'you@your',
    'someone@', 'name@domain', 'email@example', 'test@test'];
  for (const p of placeholders) {
    if (email.toLowerCase().includes(p)) return `placeholder (${p})`;
  }

  // Mashed words from page scraping
  if (/(?:phone|bottom|comtol|homeour|legal|social|address|contact\d)$/.test(local)) {
    return 'mashed word from scrape';
  }

  // No valid TLD
  if (!/\.[a-z]{2,}$/.test(email)) return 'no valid TLD';

  return null; // email is fine
}

async function main() {
  const url = `file:${path.resolve(__dirname, 'leads.db').replace(/\\/g, '/')}`;
  const db = createClient({ url });

  console.log(`\n=== Email Cleanup ${EXECUTE ? '(LIVE — will delete)' : '(DRY RUN — preview only)'} ===\n`);

  // --- Phase 1: Bad emails ---
  const { rows: allContacts } = await db.execute(
    "SELECT id, email, company_id FROM contacts WHERE email IS NOT NULL AND email != ''"
  );
  console.log(`Total emails to check: ${allContacts.length}\n`);

  const badEmails = [];
  for (const r of allContacts) {
    const reason = isBadEmail(r.email);
    if (reason) {
      badEmails.push({ id: r.id, email: r.email, reason });
    }
  }

  if (badEmails.length > 0) {
    console.log(`--- Bad Emails (${badEmails.length}) ---`);
    for (const b of badEmails) {
      console.log(`  ${b.email} — ${b.reason}`);
    }
    console.log('');
  }

  // --- Phase 2: Duplicate emails (same email, different contacts) ---
  const { rows: dupes } = await db.execute(`
    SELECT email, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
    FROM contacts
    WHERE email IS NOT NULL AND email != ''
    GROUP BY email
    HAVING cnt > 1
    ORDER BY cnt DESC
  `);

  const dupeIds = [];
  if (dupes.length > 0) {
    console.log(`--- Duplicate Emails (${dupes.length} emails with copies) ---`);
    for (const d of dupes) {
      const ids = d.ids.split(',').map(Number);
      // Keep the first (oldest by ID), remove the rest
      const keep = Math.min(...ids);
      const remove = ids.filter(id => id !== keep);
      dupeIds.push(...remove);
      console.log(`  ${d.email} — ${d.cnt} copies (keep id=${keep}, remove ids=${remove.join(',')})`);
    }
    console.log('');
  }

  // --- Summary ---
  const totalToRemove = badEmails.length + dupeIds.length;
  console.log('=== Summary ===');
  console.log(`  Bad emails:       ${badEmails.length}`);
  console.log(`  Duplicate copies: ${dupeIds.length}`);
  console.log(`  Total to remove:  ${totalToRemove}`);
  console.log('');

  if (!EXECUTE) {
    console.log('This was a DRY RUN. To actually delete, run:');
    console.log('  node clean-emails.js --execute\n');
    return;
  }

  // --- Execute deletions ---
  let deleted = 0;

  for (const b of badEmails) {
    await db.execute({ sql: 'DELETE FROM contacts WHERE id = ?', args: [b.id] });
    deleted++;
  }

  for (const id of dupeIds) {
    await db.execute({ sql: 'DELETE FROM contacts WHERE id = ?', args: [id] });
    deleted++;
  }

  const { rows: remaining } = await db.execute(
    "SELECT COUNT(*) as c FROM contacts WHERE email IS NOT NULL AND email != ''"
  );
  console.log(`Deleted: ${deleted}`);
  console.log(`Remaining good emails: ${remaining[0].c}\n`);
}

main().catch(console.error);
