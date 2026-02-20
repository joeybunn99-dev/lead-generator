const axios = require('axios');
const cheerio = require('cheerio');
const { GOOGLE_PLACES_API_KEY } = require('./config');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Module-level exclusion filter (shared by all search functions)
const EXCLUDED_TYPES = new Set([
    // Medical / health
    'doctor', 'dentist', 'hospital', 'pharmacy', 'physiotherapist',
    'health', 'veterinary_care', 'chiropractor', 'funeral_home', 'drugstore',
    // Restaurants & food service
    'restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway',
    'meal_delivery', 'night_club', 'food',
    // Large chain / general retail
    'supermarket', 'grocery_or_supermarket', 'department_store',
    'convenience_store', 'gas_station', 'lodging'
]);

/**
 * Search for businesses using the Google Places API.
 * Returns up to 20 real business listings with name, address, phone, website, and rating.
 * @param {string} query - e.g. "IT Services in Clayton, NC"
 * @returns {Promise<Array>}
 */
async function searchBusiness(query) {
    console.log(`Google Places search: ${query}`);
    try {
        // Step 1 — Text Search (up to 20 results)
        const { data: searchData } = await axios.get(
            'https://maps.googleapis.com/maps/api/place/textsearch/json',
            { params: { query, key: GOOGLE_PLACES_API_KEY } }
        );

        if (!['OK', 'ZERO_RESULTS'].includes(searchData.status)) {
            console.error('Places Text Search error:', searchData.status, searchData.error_message || '');
            return [];
        }

        const places = (searchData.results || [])
            .filter(p => !(p.types || []).some(t => EXCLUDED_TYPES.has(t)))
            .slice(0, 20);

        console.log(`Places returned ${places.length} listings (medical filtered) — fetching details...`);

        // Step 2 — Place Details for phone + website (limit to 15 to manage quota)
        const results = [];
        for (const place of places.slice(0, 15)) {
            let phone = null, website = null;
            try {
                const { data: detail } = await axios.get(
                    'https://maps.googleapis.com/maps/api/place/details/json',
                    {
                        params: {
                            place_id: place.place_id,
                            fields: 'formatted_phone_number,website',
                            key: GOOGLE_PLACES_API_KEY
                        }
                    }
                );
                if (detail.result) {
                    phone   = detail.result.formatted_phone_number || null;
                    website = detail.result.website || null;
                }
            } catch (e) { /* skip detail, use basic info */ }

            results.push({
                name:          place.name,
                url:           website,
                snippet:       place.formatted_address || '',
                phone_preview: phone,
                rating:        place.rating || null,
                address:       place.formatted_address || null
            });
        }

        console.log(`Found ${results.length} results from Google Places`);
        return results;

    } catch (error) {
        console.error('Google Places search failed:', error.message);
        return [];
    }
}

/**
 * Fetch a URL's HTML with Axios. Returns null on failure.
 */
async function fetchHtml(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 10000,
            maxRedirects: 5
        });
        return typeof data === 'string' ? data : null;
    } catch {
        return null;
    }
}

/**
 * Extract contact info and leadership from a business website.
 * Uses Axios + Cheerio (no browser — fast and works on all hosting).
 * @param {string} url
 */
async function extractContactInfo(url) {
    if (!url) return { emails: [], phones: [], people: [], address: null };
    console.log(`Scraping: ${url}`);

    const emails        = new Set();
    const phones        = new Set();
    const people        = [];
    const visited       = new Set();
    let extractedAddress = null;

    const titlesRegex  = /(CEO|Chief Executive Officer|Founder|Owner|President|Principal|Director|Manager|COO|CTO|Operations|Partner|Head of|VP|Vice President)/i;
    const excludeRegex = /(Sales Rep|Sales Associate|Customer Support|Support Agent|Intern|Assistant|Receptionist|Clerk)/i;
    const emailRegex   = /[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
    const phoneRegex   = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

    function parseHtml(html, baseUrl) {
        const $        = cheerio.load(html);
        const bodyText = $('body').text();

        // Emails — from text and mailto links
        (bodyText.match(emailRegex) || []).forEach(e => emails.add(e.toLowerCase()));
        $('a[href^="mailto:"]').each((_, el) => {
            const e = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
            if (e) emails.add(e.toLowerCase());
        });

        // Phones — from text and tel links
        (bodyText.match(phoneRegex) || []).forEach(p => phones.add(p.trim()));
        $('a[href^="tel:"]').each((_, el) => {
            const p = $(el).attr('href').replace('tel:', '').trim();
            if (p) phones.add(p);
        });

        // Address — schema.org first, then footer heuristic
        if (!extractedAddress) {
            const schema = $('[itemprop="address"], [itemprop="streetAddress"]').first().text().trim();
            if (schema) {
                extractedAddress = schema;
            } else {
                const footerText = $('footer, .footer, #footer').text() || bodyText.slice(-2000);
                const match = footerText.match(/\d+\s[A-Za-z0-9\s.,]+,\s[A-Za-z\s]+,?\s[A-Z]{2}\s\d{5}/);
                if (match) extractedAddress = match[0].trim();
            }
        }

        // Leadership — lines containing decision-maker titles
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 100);
        for (const line of lines) {
            if (titlesRegex.test(line) && !excludeRegex.test(line)) {
                people.push(line);
            }
        }

        // Collect contact/about/team links for deep crawl
        const deepLinks = [];
        try {
            const hostname = new URL(baseUrl).hostname;
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href') || '';
                if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
                if (!/contact|about|team|leadership|staff/i.test(href)) return;
                try {
                    const abs = new URL(href, baseUrl).href;
                    if (new URL(abs).hostname === hostname) deepLinks.push(abs);
                } catch { /* skip malformed href */ }
            });
        } catch { /* skip if baseUrl is invalid */ }

        return [...new Set(deepLinks)];
    }

    try {
        // 1. Homepage
        const homeHtml = await fetchHtml(url);
        if (!homeHtml) return { emails: [], phones: [], people: [], address: null };

        visited.add(url);
        const deepLinks = parseHtml(homeHtml, url);

        // 2. Deep crawl up to 2 contact/about pages
        for (const link of deepLinks.filter(l => !visited.has(l)).slice(0, 2)) {
            console.log(`Deep crawling: ${link}`);
            visited.add(link);
            const html = await fetchHtml(link);
            if (html) parseHtml(html, url);
        }

        return {
            emails:  Array.from(emails),
            phones:  Array.from(phones),
            people:  [...new Set(people)].slice(0, 5),
            address: extractedAddress
        };

    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error.message);
        return { emails: [], phones: [], people: [], address: null };
    }
}

/**
 * Fast bulk search — multi-category Text Search with pagination.
 * Gets up to ~300 businesses per city without website scraping.
 * @param {string} city - e.g. "Clayton, NC"
 * @returns {Promise<Array>}
 */
async function bulkSearchCity(city) {
    console.log(`Bulk import: ${city}`);

    const BULK_CATEGORIES = [
        'business', 'professional services', 'contractor', 'technology',
        'retail', 'financial services', 'legal services', 'manufacturing',
        'real estate', 'cleaning services', 'marketing agency', 'accounting',
        'automotive', 'landscaping', 'security services'
    ];

    const seen = new Set();
    const results = [];

    for (const category of BULK_CATEGORIES) {
        const query = `${category} in ${city}`;
        let pageToken = null;
        let page = 0;

        do {
            try {
                const params = { query, key: GOOGLE_PLACES_API_KEY };
                if (pageToken) params.pagetoken = pageToken;

                // Google requires a short delay before using next_page_token
                if (pageToken) await new Promise(r => setTimeout(r, 2000));

                const { data } = await axios.get(
                    'https://maps.googleapis.com/maps/api/place/textsearch/json',
                    { params }
                );

                if (!['OK', 'ZERO_RESULTS'].includes(data.status)) break;

                for (const p of (data.results || [])) {
                    if (seen.has(p.place_id)) continue;
                    if ((p.types || []).some(t => EXCLUDED_TYPES.has(t))) continue;
                    seen.add(p.place_id);
                    results.push({
                        name:    p.name,
                        address: p.formatted_address || null,
                        rating:  p.rating || null,
                        place_id: p.place_id
                    });
                }

                pageToken = data.next_page_token || null;
                page++;
            } catch (e) {
                console.error(`Bulk page error for ${city}/${category}:`, e.message);
                break;
            }
        } while (pageToken && page < 3); // max 3 pages = 60 per category

        // Small delay between category queries
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`Bulk import ${city}: ${results.length} businesses found`);
    return results;
}

module.exports = {
    searchBusiness,
    extractContactInfo,
    bulkSearchCity
};
