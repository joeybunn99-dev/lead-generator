module.exports = {
    // API Keys — MUST be set in .env, no fallbacks
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',
    APOLLO_API_KEY:        process.env.APOLLO_API_KEY        || '',
    FOURSQUARE_API_KEY:    process.env.FOURSQUARE_API_KEY    || '',
    FIRECRAWL_API_KEY:     process.env.FIRECRAWL_API_KEY     || '',
    N8N_WEBHOOK_URL:       process.env.N8N_WEBHOOK_URL       || '',
    BUNNCOMM_API:          process.env.BUNNCOMM_API          || 'http://localhost:3500',

    // Auth
    JWT_SECRET:            process.env.JWT_SECRET            || '',
    AUTH_PASSWORD_HASH:    process.env.AUTH_PASSWORD_HASH     || '',
    AUTH_USERNAME:         process.env.AUTH_USERNAME          || 'admin',

    // Database
    TURSO_DATABASE_URL:    process.env.TURSO_DATABASE_URL    || '',
    TURSO_AUTH_TOKEN:      process.env.TURSO_AUTH_TOKEN      || '',

    PORT:                  process.env.PORT                  || 3000,
};
