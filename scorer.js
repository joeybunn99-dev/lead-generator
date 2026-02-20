/**
 * Calculate Lead Score based on available data
 * @param {Object} lead 
 * @param {string} lead.website
 * @param {string} lead.verification_status
 * @param {Array} lead.people
 * @param {number} lead.rating (optional)
 * @param {number} lead.employees_count (optional proxy)
 * @returns {number} Score 0-100
 */
function calculateScore(lead) {
    let score = 0;

    // 1. Website Present (+10)
    if (lead.website) score += 10;

    // 2. Valid Email (+30)
    // "Valid" status implies Domain Match in our system
    if (lead.verification_status === 'Valid') score += 30;

    // 3. Decision Maker Found (+30)
    if (lead.people && lead.people.length > 0) score += 30;

    // 4. Google Rating 4+ (+20)
    if (lead.rating && lead.rating >= 4.0) score += 20;

    // 5. Employees 5+ (+10)
    // Proxy: we check people array length or other signals
    // Since we filter people heavily, having > 2 relevant people is a good sign
    // Or we can use total emails/phones heuristic.
    // Let's use lead.people.length >= 2 OR if we explicitly scraped a count.
    if ((lead.people && lead.people.length >= 2) || (lead.employees_count && lead.employees_count >= 5)) {
        score += 10;
    }

    return Math.min(score, 100);
}

module.exports = {
    calculateScore
};
