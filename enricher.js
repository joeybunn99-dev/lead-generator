const axios = require('axios');
const { APOLLO_API_KEY: DEFAULT_APOLLO_KEY } = require('./config');

const DECISION_MAKER_TITLES = [
    'CEO', 'Chief Executive Officer', 'Founder', 'Co-Founder',
    'Owner', 'President', 'Director', 'Managing Director',
    'COO', 'Chief Operating Officer', 'CTO', 'Chief Technology Officer',
    'VP', 'Vice President', 'Partner', 'Principal',
    'Head of Operations', 'General Manager'
];

/**
 * Search Apollo.io for decision makers at a given domain.
 * @param {string} domain  - e.g. "example.com"
 * @param {string} apiKey  - Apollo.io API key
 * @returns {Promise<Array>} Array of person objects
 */
async function enrichWithApollo(domain, apiKey) {
    const key = apiKey || DEFAULT_APOLLO_KEY;
    if (!key) throw new Error('Apollo API key not configured');
    const { data } = await axios.post(
        'https://api.apollo.io/api/v1/mixed_people/search',
        {
            q_organization_domains: [domain],
            person_titles: DECISION_MAKER_TITLES,
            page: 1,
            per_page: 5,
            contact_email_status: ['verified', 'likely to engage']
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Api-Key': key
            },
            timeout: 15000
        }
    );
    return data.people || [];
}

/**
 * Extract hostname without www from a URL string.
 * @param {string} url
 * @returns {string|null}
 */
function extractDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

module.exports = { enrichWithApollo, extractDomain };
