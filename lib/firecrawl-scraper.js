const { FIRECRAWL_API_KEY } = require('../config');
const { extractContactInfo } = require('../scraper');
const logger = require('./logger');

let FirecrawlAppV1;
let firecrawl;

function getFirecrawl() {
    if (!FIRECRAWL_API_KEY) return null;
    if (!firecrawl) {
        FirecrawlAppV1 = require('@mendable/firecrawl-js').FirecrawlAppV1;
        firecrawl = new FirecrawlAppV1({ apiKey: FIRECRAWL_API_KEY });
    }
    return firecrawl;
}

async function scrapeWithFirecrawl(url) {
    const fc = getFirecrawl();
    if (!fc) {
        logger.warn('Firecrawl API key not set — falling back to Cheerio');
        return scrapeWithCheerio(url);
    }

    try {
        logger.info({ url }, 'Firecrawl scraping');
        const result = await fc.scrapeUrl(url, { formats: ['markdown'] });

        if (!result.success) {
            logger.warn({ url, error: result.error }, 'Firecrawl failed — falling back to Cheerio');
            return scrapeWithCheerio(url);
        }

        const content = result.markdown || '';
        const metadata = result.metadata || {};

        // Extract emails
        const emailRegex = /[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
        const emails = [...new Set((content.match(emailRegex) || []).map(e => e.toLowerCase()))];

        // Extract phones
        const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const phones = [...new Set((content.match(phoneRegex) || []).map(p => p.trim()))];

        // Extract people with titles
        const titleRegex = /(CEO|CFO|COO|CTO|President|Owner|Founder|Director|VP|Manager|Partner|Principal)/i;
        const people = [];
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 100);
        for (const line of lines) {
            if (titleRegex.test(line)) people.push(line);
        }

        // Extract address
        const addressMatch = content.match(/\d+\s[A-Za-z0-9\s.,]+,\s[A-Za-z\s]+,?\s[A-Z]{2}\s\d{5}/);

        logger.info({ url, emails: emails.length, phones: phones.length, people: people.length }, 'Firecrawl extraction complete');

        return {
            emails,
            phones,
            people: [...new Set(people)].slice(0, 5),
            address: addressMatch ? addressMatch[0].trim() : null,
            source: 'firecrawl',
            rawLength: content.length,
        };
    } catch (err) {
        if (err.statusCode === 402) {
            logger.warn('Firecrawl credits exhausted — falling back to Cheerio');
        } else {
            logger.warn({ url, error: err.message }, 'Firecrawl error — falling back to Cheerio');
        }
        return scrapeWithCheerio(url);
    }
}

async function scrapeWithCheerio(url) {
    const result = await extractContactInfo(url);
    return { ...result, source: 'cheerio' };
}

module.exports = { scrapeWithFirecrawl };
