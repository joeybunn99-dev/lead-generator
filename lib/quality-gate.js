// ── Contact quality gate ─────────────────────────────────────────────────────
const DECISION_MAKER_TOKENS = [
    'ceo', 'chief executive', 'cfo', 'chief financial', 'coo', 'chief operating',
    'cto', 'chief technology', 'president', 'owner', 'co-owner', 'founder',
    'co-founder', 'director', 'managing director', 'vp ', 'vice president',
    'operations manager', 'purchasing manager', 'general manager',
    'partner', 'managing partner', 'principal',
];

const BLOCKED_EMAIL_PREFIXES = new Set([
    'info', 'contact', 'support', 'admin', 'hello', 'sales', 'office',
    'noreply', 'no-reply', 'billing', 'help', 'team', 'hr', 'jobs',
    'careers', 'feedback', 'mail', 'email',
]);

// Platform/system domains that generate automated addresses (never personal)
const BLOCKED_EMAIL_DOMAINS = new Set([
    'wixpress.com', 'sentry.io', 'sentry-next.wixpress.com',
    'squarespace.com', 'godaddy.com', 'wordpress.com', 'wordpress.org',
    'shopify.com', 'weebly.com', 'jimdo.com', 'webflow.io',
    'mailchimp.com', 'constantcontact.com', 'hubspot.com', 'klaviyo.com',
    'zendesk.com', 'intercom.io', 'freshdesk.com', 'salesforce.com',
    'amazonaws.com', 'googlemail.com', 'example.com', 'test.com',
    'bounces.amazon.com', 'email.amazonses.com',
]);

function isDecisionMaker(title) {
    if (!title) return false;
    const t = title.toLowerCase();
    return DECISION_MAKER_TOKENS.some(tok => t.includes(tok));
}

function isPersonalEmail(email) {
    if (!email) return false;
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const local  = parts[0].toLowerCase();
    const domain = parts[1].toLowerCase();

    // Reject blocked generic prefixes (exact match)
    if (BLOCKED_EMAIL_PREFIXES.has(local)) return false;

    // Reject if local part is too long (system IDs, hex tokens, etc.)
    if (local.length > 40) return false;

    // Reject if local part starts with a digit (phone number artifacts like "2840391info@")
    if (/^\d/.test(local)) return false;

    // Reject if local part looks like a hex/UUID token (only hex chars + dashes, no vowels typical of a name)
    if (/^[0-9a-f\-]{20,}$/i.test(local)) return false;

    // Reject if local part contains no letters at all
    if (!/[a-z]/i.test(local)) return false;

    // Block known platform/system domains and their subdomains
    if (BLOCKED_EMAIL_DOMAINS.has(domain)) return false;
    const rootDomain = domain.split('.').slice(-2).join('.');
    if (BLOCKED_EMAIL_DOMAINS.has(rootDomain)) return false;

    return true;
}

function passesGate(contact) {
    if (!contact.name || contact.name.trim().length < 2) return false;
    if (!isDecisionMaker(contact.title)) return false;
    const hasEmail = contact.email && isPersonalEmail(contact.email);
    const hasPhone = contact.phone && contact.phone.replace(/\D/g, '').length >= 10;
    return hasEmail || hasPhone;
}

// Parse "John Smith - CEO" or "CEO | John Smith" lines from scraper
function parsePerson(line) {
    // Pattern 1: "John Smith - CEO" / "Jane Doe | President"
    const p1 = line.match(/^(.+?)\s*[-–|,]\s*(CEO|CFO|COO|CTO|President|Owner|Founder|Director|VP|Manager|Partner|Principal[^,\n]{0,25})$/i);
    if (p1) return { name: p1[1].trim(), title: p1[2].trim() };

    // Pattern 2: "CEO: John Smith" / "Owner - Jane Doe"  (title comes first)
    const p2 = line.match(/^(CEO|CFO|COO|CTO|President|Owner|Founder|Director|VP|Manager|Partner|Principal[^,\n]{0,25})[:\s|,-]+(.{2,60})$/i);
    if (p2) return { name: p2[2].trim(), title: p2[1].trim() };  // note: name=m[2], title=m[1]

    return null;
}

module.exports = {
    DECISION_MAKER_TOKENS,
    BLOCKED_EMAIL_PREFIXES,
    BLOCKED_EMAIL_DOMAINS,
    isDecisionMaker,
    isPersonalEmail,
    passesGate,
    parsePerson,
};
