require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pinoHttp = require('pino-http');
const cookieParser = require('cookie-parser');
const { initDb } = require('./database');
const logger = require('./lib/logger');
const { requireAuth, handleLogin, handleLogout, loginLimiter, apiLimiter } = require('./middleware/auth');
const { validate, loginSchema } = require('./middleware/validate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url.startsWith('/style') || req.url.endsWith('.js') || req.url.endsWith('.css') || req.url.endsWith('.webp') } }));

// Static files (no auth, no rate limit)
app.use(express.static(path.join(__dirname, 'public')));

// Public routes (no auth)
app.post('/api/login', loginLimiter, validate(loginSchema), handleLogin);
app.post('/api/logout', handleLogout);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Protected API routes
app.use('/api', apiLimiter, requireAuth);

// Mount route modules
app.use('/api', require('./routes/contacts'));
app.use('/api', require('./routes/companies'));
app.use('/api', require('./routes/pulls'));
app.use('/api', require('./routes/enrichment'));
app.use('/api', require('./routes/exports'));

async function start() {
    await initDb();
    app.listen(PORT, () => {
        logger.info({ port: PORT }, `Lead Generator running at http://localhost:${PORT}`);
    });
}

start().catch(err => {
    logger.error(err, 'Failed to start server');
    process.exit(1);
});
