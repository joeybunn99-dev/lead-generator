const { searchBusiness } = require('./scraper');

// Radius logic: simplified to a list of cities within ~25 miles of Clayton, NC
const NEARBY_CITIES = [
    'Clayton, NC',
    'Garner, NC',
    'Smithfield, NC',
    'Wendell, NC',
    'Archer Lodge, NC',
    'Selma, NC',
    'Wilson\'s Mills, NC',
    'Knightdale, NC',
    'Raleigh, NC' // Larger city nearby
];

// Target Categories
const CATEGORIES = [
    'IT Services',
    'Managed Service Providers',
    'Business Consulting',
    'Construction Companies',
    'Medical Offices',
    'Law Firms',
    'Property Management',
    'Retail Chain Headquarters'
];

/**
 * Run a deep discovery for a specific category across all nearby cities.
 * @param {string} category 
 * @returns {Promise<Array>}
 */
async function discoverByCategory(category) {
    let allResults = [];
    console.log(`Starting discovery for: ${category}`);

    for (const city of NEARBY_CITIES) {
        const query = `${category} in ${city}`;
        console.log(`Mining: ${query}`);

        // Add random delay to be polite
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

        const results = await searchBusiness(query);
        allResults = [...allResults, ...results];
    }

    // Deduplicate by URL
    const unique = [];
    const seen = new Set();
    for (const r of allResults) {
        if (!seen.has(r.url)) {
            seen.add(r.url);
            unique.push(r);
        }
    }

    return unique;
}

/**
 * Run discovery for all categories in a specific city/location.
 * @param {string} location 
 */
async function discoverByLocation(location) {
    // Check if location is a ZIP code (5 digits)
    const isZip = /^\d{5}$/.test(location.trim());
    let query = '';

    if (isZip) {
        // ZIP Code Search
        // We'll search for "Business in [ZIP]"
        // Since we don't have a map of ZIP -> City, we rely on the search engine respecting the ZIP.
        // We iterate through our categories.
        query = `${CATEGORIES[0]} in ${location}`; // Minimal demo: just first category? 
        // Better: Search for "Businesses in [ZIP]" is too broad. 
        // Let's iterate all categories for this ZIP.
    } else {
        // Standard City Search OR "Near" (Radius)
        // If user types "Near [City]", we preserve that.
        query = `${CATEGORIES[0]} in ${location}`;
    }

    let allResults = [];

    // For the demo, we will iterate through ALL categories for the given location
    for (const cat of CATEGORIES) {
        const q = `${cat} in ${location}`;
        console.log(`Discovering: ${q}`);

        // Search DuckDuckGo
        const results = await searchBusiness(q);

        // Filter for NC if possible (optional, but good for quality)
        // basic snippet check for "NC" or "North Carolina"
        const ncResults = results.filter(r =>
            (r.snippet && (r.snippet.includes('NC') || r.snippet.includes('North Carolina'))) ||
            (isZip) // If ZIP, we assume the ZIP is correct regardless of snippet text
        );

        allResults = allResults.concat(ncResults);

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Deduplicate
    const unique = [];
    const seen = new Set();
    for (const r of allResults) {
        if (!seen.has(r.url)) {
            seen.add(r.url);
            unique.push(r);
        }
    }

    return unique;
}

module.exports = {
    NEARBY_CITIES,
    CATEGORIES,
    discoverByCategory,
    discoverByLocation
};
