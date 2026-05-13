/**
 * Email Discovery — Find business emails for companies in the database.
 *
 * Methods (all free):
 * 1. Generic email testing — try info@, contact@, sales@ etc. with SMTP verification
 * 2. Pattern guessing — if we have a contact name + domain, guess the email format
 * 3. Website scraping — Firecrawl/Cheerio extract emails from company websites
 *
 * Uses SMTP RCPT TO verification to confirm emails actually exist.
 */

const dns = require('dns');
const net = require('net');
const { promisify } = require('util');
const resolveMx = promisify(dns.resolveMx);
const logger = require('./logger');

// Common generic email prefixes that businesses use
const GENERIC_PREFIXES = [
  'info', 'contact', 'hello', 'sales', 'office',
  'admin', 'support', 'service', 'billing', 'team',
  'general', 'inquiries', 'help', 'mail', 'business',
];

// Common email patterns for named contacts
const NAME_PATTERNS = [
  (first, last) => `${first}@`,                    // john@
  (first, last) => `${first}.${last}@`,             // john.smith@
  (first, last) => `${first[0]}${last}@`,           // jsmith@
  (first, last) => `${first[0]}.${last}@`,          // j.smith@
  (first, last) => `${first}${last[0]}@`,           // johns@
  (first, last) => `${first}${last}@`,              // johnsmith@
  (first, last) => `${last}.${first}@`,             // smith.john@
  (first, last) => `${last}@`,                      // smith@
  (first, last) => `${first}_${last}@`,             // john_smith@
];

/**
 * Check if a domain is a catch-all (accepts any address).
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
async function isCatchAll(domain) {
  const randomLocal = `xq7z9test${Date.now()}`;
  const result = await smtpVerify(`${randomLocal}@${domain}`, domain);
  return result.valid; // If random address is "valid", it's catch-all
}

/**
 * Verify an email exists via SMTP RCPT TO handshake.
 * @param {string} email
 * @param {string} domain
 * @returns {Promise<{valid: boolean, reason: string}>}
 */
async function smtpVerify(email, domain) {
  try {
    // Get MX records
    const mxRecords = await resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: 'No MX records' };
    }

    // Sort by priority (lowest = highest priority)
    mxRecords.sort((a, b) => a.priority - b.priority);
    const mxHost = mxRecords[0].exchange;

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let step = 0;
      let response = '';
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ valid: false, reason: 'Timeout' });
      }, 10000);

      socket.connect(25, mxHost, () => {
        // Wait for greeting
      });

      socket.on('data', (data) => {
        response = data.toString();
        const code = parseInt(response.substring(0, 3));

        switch (step) {
          case 0: // Greeting
            if (code === 220) {
              socket.write('EHLO verify.local\r\n');
              step = 1;
            } else {
              clearTimeout(timeout);
              socket.destroy();
              resolve({ valid: false, reason: `Greeting: ${code}` });
            }
            break;
          case 1: // EHLO response
            if (code === 250) {
              socket.write('MAIL FROM:<verify@verify.local>\r\n');
              step = 2;
            } else {
              clearTimeout(timeout);
              socket.destroy();
              resolve({ valid: false, reason: `EHLO: ${code}` });
            }
            break;
          case 2: // MAIL FROM response
            if (code === 250) {
              socket.write(`RCPT TO:<${email}>\r\n`);
              step = 3;
            } else {
              clearTimeout(timeout);
              socket.destroy();
              resolve({ valid: false, reason: `MAIL FROM: ${code}` });
            }
            break;
          case 3: // RCPT TO response — this tells us if the email exists
            clearTimeout(timeout);
            socket.write('QUIT\r\n');
            socket.destroy();
            if (code === 250) {
              resolve({ valid: true, reason: 'SMTP verified' });
            } else if (code === 550 || code === 551 || code === 553) {
              resolve({ valid: false, reason: 'Mailbox not found' });
            } else if (code === 452) {
              resolve({ valid: false, reason: 'Mailbox full' });
            } else {
              resolve({ valid: false, reason: `RCPT: ${code}` });
            }
            break;
        }
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve({ valid: false, reason: 'Connection failed' });
      });
    });
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/**
 * Discover generic emails for a domain (info@, contact@, etc.).
 * @param {string} domain
 * @returns {Promise<Array<{email: string, method: string}>>} Found emails with discovery method.
 *   method is 'verified-smtp' (SMTP RCPT confirmed) or 'inferred-catchall' (domain accepts everything,
 *   so existence is unverifiable).
 */
async function discoverGenericEmails(domain) {
  const found = [];

  // First check if domain has MX records at all
  try {
    const mx = await resolveMx(domain);
    if (!mx || mx.length === 0) return found;
  } catch {
    return found;
  }

  // Check if catch-all
  const catchAll = await isCatchAll(domain);
  if (catchAll) {
    // Can't reliably verify individual addresses — just return info@ as likely
    logger.info({ domain }, 'Catch-all domain detected — returning info@');
    return [{ email: `info@${domain}`, method: 'inferred-catchall' }];
  }

  // Test each generic prefix
  for (const prefix of GENERIC_PREFIXES) {
    const email = `${prefix}@${domain}`;
    const result = await smtpVerify(email, domain);
    if (result.valid) {
      found.push({ email, method: 'verified-smtp' });
      logger.info({ email, domain }, 'Generic email found');
    }
    // Small delay to avoid being rate-limited
    await new Promise(r => setTimeout(r, 500));
  }

  return found;
}

/**
 * Guess emails for a named contact using common patterns.
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} domain
 * @returns {Promise<{email: string, method: string} | null>} First match with discovery method,
 *   or null. method is 'verified-smtp' or 'inferred-catchall'.
 */
async function guessContactEmail(firstName, lastName, domain) {
  if (!firstName || !lastName || !domain) return null;

  const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const last = lastName.toLowerCase().replace(/[^a-z]/g, '');
  if (!first || !last) return null;

  // Check catch-all first
  const catchAll = await isCatchAll(domain);

  for (const pattern of NAME_PATTERNS) {
    const local = pattern(first, last);
    const email = `${local}${domain}`;

    if (catchAll) {
      // Can't verify — return the most common pattern as inferred-catchall
      return { email: `${first}.${last}@${domain}`, method: 'inferred-catchall' };
    }

    const result = await smtpVerify(email, domain);
    if (result.valid) {
      logger.info({ email, firstName, lastName, domain }, 'Contact email discovered');
      return { email, method: 'verified-smtp' };
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return null;
}

/**
 * Batch discover emails for companies in the database.
 * @param {function} query - Database query function
 * @param {function} run - Database run function
 * @param {object} options
 * @returns {Promise<{found: number, tested: number}>}
 */
async function batchDiscoverEmails(query, run, options = {}) {
  const { limit = 100, city = null } = options;

  // Get companies with domains but no contacts with email
  let sql = `
    SELECT c.id, c.name, c.domain, c.website
    FROM companies c
    WHERE c.domain IS NOT NULL AND length(c.domain) > 0
    AND c.id NOT IN (
      SELECT DISTINCT company_id FROM contacts WHERE email IS NOT NULL AND length(email) > 0
    )
  `;
  const args = [];
  if (city) {
    sql += ' AND c.city LIKE ?';
    args.push(`%${city}%`);
  }
  sql += ` LIMIT ?`;
  args.push(limit);

  const companies = await query(sql, args);
  logger.info({ count: companies.length }, 'Starting email discovery batch');

  let found = 0;
  let tested = 0;

  for (const co of companies) {
    tested++;
    try {
      const emails = await discoverGenericEmails(co.domain);

      for (const item of emails) {
        // emails are now {email, method} objects — write both source and discovery_method.
        const email = item.email;
        const method = item.method;
        // email_status reflects SMTP outcome; verified-smtp -> 'valid', inferred-catchall -> 'unverified'
        const emailStatus = method === 'verified-smtp' ? 'valid' : 'unverified';
        await run(
          `INSERT INTO contacts (company_id, name, title, email, email_status, source, discovery_method)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [co.id, co.name, 'General Contact', email, emailStatus, 'email-discovery', method]
        );
        found++;
      }

      if (tested % 10 === 0) {
        logger.info({ tested, found, total: companies.length }, 'Email discovery progress');
      }
    } catch (err) {
      logger.warn({ company: co.name, error: err.message }, 'Email discovery error');
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  logger.info({ tested, found }, 'Email discovery batch complete');
  return { found, tested };
}

module.exports = {
  smtpVerify,
  isCatchAll,
  discoverGenericEmails,
  guessContactEmail,
  batchDiscoverEmails,
};
