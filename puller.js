const axios = require('axios');
const { GOOGLE_PLACES_API_KEY, FOURSQUARE_API_KEY } = require('./config');
const { query, queryOne, run } = require('./database');

// Center point — all distance filtering radiates from here
const CLAYTON = { lat: 35.6501, lng: -78.4570 };

// Anchor cities with coordinates so we can skip ones outside the chosen radius.
// Adding 50-mile buffer when selecting anchors ensures edge coverage.
const ANCHOR_CITIES = [
    // Triangle / center
    { name: 'Clayton NC',        lat: 35.6501, lng: -78.4570 },  //   0 mi
    { name: 'Raleigh NC',        lat: 35.7796, lng: -78.6382 },  //  13 mi
    { name: 'Cary NC',           lat: 35.7915, lng: -78.7811 },  //  21 mi
    { name: 'Wilson NC',         lat: 35.7213, lng: -77.9155 },  //  31 mi
    { name: 'Goldsboro NC',      lat: 35.3849, lng: -77.9927 },  //  32 mi
    { name: 'Durham NC',         lat: 35.9940, lng: -78.8986 },  //  34 mi
    { name: 'Chapel Hill NC',    lat: 35.9132, lng: -79.0558 },  //  38 mi
    { name: 'Rocky Mount NC',    lat: 35.9382, lng: -77.7905 },  //  42 mi
    { name: 'Sanford NC',        lat: 35.4796, lng: -79.1803 },  //  42 mi
    { name: 'Fayetteville NC',   lat: 35.0527, lng: -78.8784 },  //  47 mi
    // 51–100 mi
    { name: 'Greenville NC',     lat: 35.6127, lng: -77.3664 },  //  62 mi
    { name: 'Burlington NC',     lat: 36.0957, lng: -79.4378 },  //  65 mi
    { name: 'Lumberton NC',      lat: 34.6182, lng: -79.0087 },  //  77 mi
    { name: 'Jacksonville NC',   lat: 34.7540, lng: -77.4302 },  //  83 mi
    { name: 'New Bern NC',       lat: 35.1085, lng: -77.0441 },  //  87 mi
    // 101–150 mi
    { name: 'High Point NC',     lat: 35.9557, lng: -80.0053 },  // 107 mi
    { name: 'Wilmington NC',     lat: 34.2257, lng: -77.9447 },  // 113 mi
    { name: 'Concord NC',        lat: 35.4088, lng: -80.5795 },  // 120 mi
    { name: 'Monroe NC',         lat: 34.9854, lng: -80.5495 },  // 123 mi
    { name: 'Greensboro NC',     lat: 36.0726, lng: -79.7920 },  // 127 mi
    { name: 'Elizabeth City NC', lat: 36.2940, lng: -76.2512 },  // 130 mi
    { name: 'Statesville NC',    lat: 35.7828, lng: -80.8873 },  // 136 mi
    { name: 'Winston-Salem NC',  lat: 36.0999, lng: -80.2442 },  // 137 mi
    // 151–200 mi
    { name: 'Charlotte NC',      lat: 35.2271, lng: -80.8431 },  // 158 mi
    { name: 'Gastonia NC',       lat: 35.2620, lng: -81.1873 },  // 165 mi
    { name: 'Hickory NC',        lat: 35.7327, lng: -81.3418 },  // 163 mi
    { name: 'Morganton NC',      lat: 35.7451, lng: -81.6845 },  // 183 mi
    { name: 'Boone NC',          lat: 36.2168, lng: -81.6746 },  // 185 mi
    // 201–300 mi
    { name: 'Asheville NC',      lat: 35.5951, lng: -82.5515 },  // 229 mi
    { name: 'Hendersonville NC', lat: 35.3173, lng: -82.4601 },  // 226 mi
];

// ── Industry search queries ──────────────────────────────────────────────────
const INDUSTRY_QUERIES = [
    // Technology / IT
    { industry: 'Technology/IT', query: 'managed service provider' },
    { industry: 'Technology/IT', query: 'IT support company' },
    { industry: 'Technology/IT', query: 'cybersecurity firm' },
    { industry: 'Technology/IT', query: 'software development company' },
    { industry: 'Technology/IT', query: 'IT consulting' },
    { industry: 'Technology/IT', query: 'technology solutions company' },
    { industry: 'Technology/IT', query: 'network services company' },

    // Construction / Trades
    { industry: 'Construction', query: 'general contractor' },
    { industry: 'Construction', query: 'commercial construction company' },
    { industry: 'Construction', query: 'electrical contractor' },
    { industry: 'Construction', query: 'HVAC company' },
    { industry: 'Construction', query: 'plumbing contractor' },
    { industry: 'Construction', query: 'roofing company' },
    { industry: 'Construction', query: 'mechanical contractor' },
    { industry: 'Construction', query: 'civil engineering firm' },

    // Manufacturing / Industrial / Logistics
    { industry: 'Manufacturing', query: 'manufacturing company' },
    { industry: 'Manufacturing', query: 'industrial supplier' },
    { industry: 'Manufacturing', query: 'logistics company' },
    { industry: 'Manufacturing', query: 'warehousing and distribution' },
    { industry: 'Manufacturing', query: 'metal fabrication shop' },
    { industry: 'Manufacturing', query: 'printing company' },

    // Professional Services
    { industry: 'Legal',       query: 'law firm' },
    { industry: 'Legal',       query: 'business attorney' },
    { industry: 'Accounting',  query: 'CPA firm' },
    { industry: 'Accounting',  query: 'accounting firm' },
    { industry: 'Consulting',  query: 'business consulting firm' },
    { industry: 'Consulting',  query: 'management consulting' },
    { industry: 'Engineering', query: 'engineering firm' },
    { industry: 'Marketing',   query: 'marketing agency' },
    { industry: 'Marketing',   query: 'advertising agency' },

    // Automotive Dealers
    { industry: 'Automotive',  query: 'car dealership' },
    { industry: 'Automotive',  query: 'auto dealership' },
    { industry: 'Automotive',  query: 'automobile dealer' },
    { industry: 'Automotive',  query: 'truck dealership' },

    // Real Estate
    { industry: 'Real Estate', query: 'real estate brokerage' },
    { industry: 'Real Estate', query: 'real estate agency' },
    { industry: 'Real Estate', query: 'commercial real estate company' },
    { industry: 'Real Estate', query: 'property management company' },
];

// Google place types to exclude (medical, food, consumer retail)
const EXCLUDED_TYPES = new Set([
    'doctor', 'dentist', 'hospital', 'pharmacy', 'physiotherapist',
    'health', 'veterinary_care', 'chiropractor', 'funeral_home', 'drugstore',
    'restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery',
    'night_club', 'food', 'supermarket', 'grocery_or_supermarket',
    'department_store', 'convenience_store', 'gas_station', 'lodging',
    'beauty_salon', 'hair_care', 'spa', 'gym', 'church', 'school',
    'university', 'library', 'museum', 'park', 'stadium',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────
function distanceMiles(lat1, lng1, lat2, lng2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasExcludedType(types = []) {
    return types.some(t => EXCLUDED_TYPES.has(t));
}

function extractDomain(url) {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch { return null; }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ── Google Places API calls ──────────────────────────────────────────────────
async function textSearch(queryStr, pageToken = null) {
    const params = {
        query: queryStr,
        key: GOOGLE_PLACES_API_KEY,
        type: 'establishment',
    };
    if (pageToken) params.pagetoken = pageToken;

    const { data } = await axios.get(
        'https://maps.googleapis.com/maps/api/place/textsearch/json',
        { params }
    );
    return data;
}

async function placeDetails(placeId) {
    const { data } = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
            params: {
                place_id: placeId,
                fields: 'formatted_phone_number,website,address_component',
                key: GOOGLE_PLACES_API_KEY,
            }
        }
    );
    return data.result || {};
}

// ── In-process pull state (for status polling) ───────────────────────────────
const pullState = {
    running: false,
    cancelled: false,
    jobId: null,
    radiusMiles: null,
    queriesTotal: 0,
    queriesDone: 0,
    companiesFound: 0,
};

function getPullState() { return { ...pullState }; }

function cancelPullJob() {
    if (pullState.running) pullState.cancelled = true;
}

// ── Main pull job ─────────────────────────────────────────────────────────────
async function runPullJob(jobId, selectedIndustries = null, radiusMiles = 300) {
    const queries = selectedIndustries
        ? INDUSTRY_QUERIES.filter(q => selectedIndustries.includes(q.industry))
        : INDUSTRY_QUERIES;

    // Only query anchors within radius + 50-mile buffer (saves API calls on small radii)
    const relevantAnchors = ANCHOR_CITIES.filter(a =>
        distanceMiles(CLAYTON.lat, CLAYTON.lng, a.lat, a.lng) <= radiusMiles + 50
    );

    // Build all (query, anchor) combinations
    const workList = [];
    for (const iq of queries) {
        for (const anchor of relevantAnchors) {
            workList.push({ text: `${iq.query} in ${anchor.name}`, industry: iq.industry });
        }
    }

    Object.assign(pullState, {
        running: true, cancelled: false, jobId,
        radiusMiles,
        queriesTotal: workList.length,
        queriesDone: 0,
        companiesFound: 0,
    });

    await run('UPDATE pull_jobs SET queries_total=? WHERE id=?', [workList.length, jobId]);

    const seenPlaceIds = new Set();

    for (const work of workList) {
        if (pullState.cancelled) break;
        try {
            let pageToken = null;
            let page = 0;

            do {
                if (pageToken) await sleep(2000); // Google requires delay before using next_page_token
                const data = await textSearch(work.text, pageToken);
                pageToken = data.next_page_token || null;
                page++;

                for (const place of (data.results || [])) {
                    if (seenPlaceIds.has(place.place_id)) continue;
                    seenPlaceIds.add(place.place_id);

                    if (hasExcludedType(place.types)) continue;

                    const loc = place.geometry?.location;
                    if (!loc) continue;

                    const dist = distanceMiles(CLAYTON.lat, CLAYTON.lng, loc.lat, loc.lng);
                    if (dist > radiusMiles) continue;

                    const existing = await queryOne('SELECT id FROM companies WHERE place_id=?', [place.place_id]);
                    if (existing) continue;

                    // Fetch details for phone, website, and proper city name
                    let phone = null, website = null, city = '';
                    try {
                        const detail = await placeDetails(place.place_id);
                        phone = detail.formatted_phone_number || null;
                        website = detail.website || null;
                        // address_components gives a reliable city (locality type)
                        const localityComp = (detail.address_components || [])
                            .find(c => c.types.includes('locality'));
                        city = localityComp?.long_name || '';
                    } catch { /* skip detail on error */ }
                    // Fallback: formatted_address is "Street, City, NC ZIP, USA"
                    // so the city is 3rd-from-last comma segment
                    if (!city) {
                        const parts = (place.formatted_address || '').split(',');
                        city = parts.length >= 3 ? parts[parts.length - 3].trim() : '';
                    }
                    const domain = extractDomain(website);

                    await run(
                        `INSERT OR IGNORE INTO companies
                         (place_id, name, website, domain, phone, address, city, lat, lng, rating, industry, google_types)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            place.place_id, place.name, website, domain, phone,
                            place.formatted_address || null, city,
                            loc.lat, loc.lng, place.rating || null,
                            work.industry, JSON.stringify(place.types || []),
                        ]
                    );

                    pullState.companiesFound++;
                }

                await sleep(200);
            } while (pageToken && page < 3);

        } catch (err) {
            console.error(`Pull query error [${work.text}]:`, err.message);
        }

        pullState.queriesDone++;
        await run(
            'UPDATE pull_jobs SET queries_done=?, companies_found=? WHERE id=?',
            [pullState.queriesDone, pullState.companiesFound, jobId]
        );
    }

    const finalStatus = pullState.cancelled ? 'cancelled' : 'done';
    await run(
        `UPDATE pull_jobs SET status='${finalStatus}', finished_at=CURRENT_TIMESTAMP WHERE id=?`,
        [jobId]
    );

    pullState.running = false;
    console.log(`Pull ${finalStatus}: ${pullState.companiesFound} companies found`);
}

// ── Foursquare pull ────────────────────────────────────────────────────────────

const FOURSQUARE_ANCHORS = [
    { name: 'Raleigh',       lat: 35.7796, lng: -78.6382 },
    { name: 'Charlotte',     lat: 35.2271, lng: -80.8431 },
    { name: 'Greensboro',    lat: 36.0726, lng: -79.7920 },
    { name: 'Durham',        lat: 35.9940, lng: -78.8986 },
    { name: 'Winston-Salem', lat: 36.0999, lng: -80.2442 },
    { name: 'Fayetteville',  lat: 35.0527, lng: -78.8784 },
    { name: 'Wilmington',    lat: 34.2257, lng: -77.9447 },
    { name: 'Asheville',     lat: 35.5951, lng: -82.5515 },
];

const FOURSQUARE_QUERIES = [
    { industry: 'Technology/IT',  term: 'managed service provider IT support' },
    { industry: 'Technology/IT',  term: 'cybersecurity software development' },
    { industry: 'Construction',   term: 'general contractor commercial construction' },
    { industry: 'Construction',   term: 'electrical HVAC plumbing roofing' },
    { industry: 'Manufacturing',  term: 'manufacturing industrial logistics' },
    { industry: 'Legal',          term: 'law firm business attorney' },
    { industry: 'Accounting',     term: 'CPA accounting firm' },
    { industry: 'Consulting',     term: 'business management consulting' },
    { industry: 'Engineering',    term: 'engineering firm' },
    { industry: 'Marketing',      term: 'marketing advertising agency' },
    { industry: 'Automotive',     term: 'car dealership auto dealer' },
    { industry: 'Real Estate',    term: 'real estate brokerage property management' },
];

async function foursquareSearch(query, lat, lng, radiusMeters) {
    const url = new URL('https://api.foursquare.com/v3/places/search');
    url.searchParams.set('query', query);
    url.searchParams.set('ll', `${lat},${lng}`);
    url.searchParams.set('radius', Math.min(radiusMeters, 100000));
    url.searchParams.set('limit', '50');
    url.searchParams.set('fields', 'fsq_id,name,location,tel,website,geocodes,categories');

    const { data } = await axios.get(url.toString(), {
        headers: {
            Authorization: FOURSQUARE_API_KEY,
            Accept: 'application/json',
        },
    });
    return data.results || [];
}

const foursquareState = {
    running: false, cancelled: false,
    queriesTotal: 0, queriesDone: 0, companiesFound: 0,
};

function getFoursquareState() { return { ...foursquareState }; }
function cancelFoursquarePull() { if (foursquareState.running) foursquareState.cancelled = true; }

async function runFoursquarePull(selectedIndustries = null, radiusMiles = 300) {
    if (!FOURSQUARE_API_KEY) throw new Error('FOURSQUARE_API_KEY not set in config.js');

    const queries = selectedIndustries
        ? FOURSQUARE_QUERIES.filter(q => selectedIndustries.includes(q.industry))
        : FOURSQUARE_QUERIES;

    const anchors = FOURSQUARE_ANCHORS.filter(a =>
        distanceMiles(CLAYTON.lat, CLAYTON.lng, a.lat, a.lng) <= radiusMiles + 50
    );

    const workList = [];
    for (const q of queries) {
        for (const a of anchors) {
            workList.push({ term: q.term, industry: q.industry, anchor: a });
        }
    }

    Object.assign(foursquareState, {
        running: true, cancelled: false,
        queriesTotal: workList.length, queriesDone: 0, companiesFound: 0,
    });

    const radiusMeters = radiusMiles * 1609.34;

    for (const work of workList) {
        if (foursquareState.cancelled) break;
        try {
            const results = await foursquareSearch(work.term, work.anchor.lat, work.anchor.lng, radiusMeters);

            for (const biz of results) {
                if (foursquareState.cancelled) break;

                const geo = biz.geocodes?.main;
                if (!geo?.latitude) continue;

                const dist = distanceMiles(CLAYTON.lat, CLAYTON.lng, geo.latitude, geo.longitude);
                if (dist > radiusMiles) continue;

                const placeId = `fsq:${biz.fsq_id}`;
                const existing = await queryOne('SELECT id FROM companies WHERE place_id=?', [placeId]);
                if (existing) continue;

                const city = biz.location?.locality || biz.location?.city || '';
                const address = biz.location?.formatted_address ||
                    [biz.location?.address, city, biz.location?.region].filter(Boolean).join(', ');
                const rawPhone = (biz.tel || '').replace(/\s/g, '');
                const website = biz.website || null;
                const domain = extractDomain(website);

                await run(
                    `INSERT OR IGNORE INTO companies
                     (place_id, name, website, domain, phone, address, city, lat, lng, industry, google_types)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        placeId, biz.name, website, domain, rawPhone || null,
                        address, city, geo.latitude, geo.longitude,
                        work.industry, JSON.stringify(['foursquare']),
                    ]
                );
                foursquareState.companiesFound++;
            }

            await sleep(300);
        } catch (err) {
            console.error(`Foursquare error [${work.term}]:`, err.message);
        }

        foursquareState.queriesDone++;
    }

    foursquareState.running = false;
    console.log(`Foursquare pull complete: ${foursquareState.companiesFound} companies found`);
}

// ── OpenStreetMap Overpass pull ────────────────────────────────────────────────

const OSM_QUERIES = [
    { industry: 'Technology/IT',
      filter: 'node["office"~"it_consultant|software|technology|computer"]["name"]' },
    { industry: 'Construction',
      filter: '(node["office"="construction"]["name"];node["craft"~"electrician|plumber|roofer|hvac"]["name"];)' },
    { industry: 'Manufacturing',
      filter: '(node["man_made"="works"]["name"];node["craft"~"metal_construction|printing|carpenter"]["name"];)' },
    { industry: 'Legal',
      filter: 'node["office"="lawyer"]["name"]' },
    { industry: 'Accounting',
      filter: 'node["office"~"accountant|tax"]["name"]' },
    { industry: 'Consulting',
      filter: 'node["office"="consulting"]["name"]' },
    { industry: 'Engineering',
      filter: 'node["office"~"engineer|engineering"]["name"]' },
    { industry: 'Marketing',
      filter: 'node["office"~"advertising|marketing"]["name"]' },
    { industry: 'Automotive',
      filter: '(node["shop"="car"]["name"];node["amenity"="car_dealership"]["name"];)' },
    { industry: 'Real Estate',
      filter: 'node["office"~"real_estate|estate_agent"]["name"]' },
];

const osmState = {
    running: false, cancelled: false,
    queriesTotal: 0, queriesDone: 0, companiesFound: 0,
};

function getOsmState() { return { ...osmState }; }
function cancelOsmPull() { if (osmState.running) osmState.cancelled = true; }

async function runOsmPull(selectedIndustries = null) {
    const queries = selectedIndustries
        ? OSM_QUERIES.filter(q => selectedIndustries.includes(q.industry))
        : OSM_QUERIES;

    Object.assign(osmState, {
        running: true, cancelled: false,
        queriesTotal: queries.length, queriesDone: 0, companiesFound: 0,
    });

    for (const q of queries) {
        if (osmState.cancelled) break;
        try {
            const overpassQuery = `
[out:json][timeout:180];
area["name"="North Carolina"]["admin_level"="4"]->.nc;
${q.filter}(area.nc);
out body;
`.trim();

            const { data } = await axios.post(
                'https://overpass-api.de/api/interpreter',
                `data=${encodeURIComponent(overpassQuery)}`,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 200000 }
            );

            for (const el of (data.elements || [])) {
                if (osmState.cancelled) break;
                const tags = el.tags || {};
                const name = tags.name;
                if (!name) continue;

                const placeId = `osm:${el.id}`;
                const existing = await queryOne('SELECT id FROM companies WHERE place_id=?', [placeId]);
                if (existing) continue;

                const city = tags['addr:city'] || '';
                const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
                const address = [street, city, tags['addr:state'] || 'NC'].filter(Boolean).join(', ');
                const rawPhone = (tags.phone || tags['contact:phone'] || '').replace(/\s/g, '');
                const website = tags.website || tags['contact:website'] || null;
                const domain = extractDomain(website);
                const lat = el.lat ?? el.center?.lat ?? null;
                const lng = el.lon ?? el.center?.lon ?? null;

                await run(
                    `INSERT OR IGNORE INTO companies
                     (place_id, name, website, domain, phone, address, city, state, lat, lng, industry, google_types)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        placeId, name, website, domain, rawPhone || null,
                        address, city, 'NC', lat, lng,
                        q.industry, JSON.stringify(['osm']),
                    ]
                );
                osmState.companiesFound++;
            }

            await sleep(1000); // be polite to Overpass public instance
        } catch (err) {
            console.error(`OSM error [${q.industry}]:`, err.message);
        }

        osmState.queriesDone++;
    }

    osmState.running = false;
    console.log(`OSM pull complete: ${osmState.companiesFound} companies found`);
}


module.exports = {
    runPullJob, getPullState, cancelPullJob, INDUSTRY_QUERIES,
    runFoursquarePull, getFoursquareState, cancelFoursquarePull, FOURSQUARE_QUERIES,
    runOsmPull, getOsmState, cancelOsmPull,
};
