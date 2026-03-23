const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts, try again in 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

const heavyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Rate limit exceeded for this endpoint' },
});

function requireAuth(req, res, next) {
    if (!config.JWT_SECRET || !config.AUTH_PASSWORD_HASH) return next();
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        req.user = jwt.verify(token, config.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

async function handleLogin(req, res) {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    if (!config.AUTH_PASSWORD_HASH || !config.JWT_SECRET) {
        if (username === 'admin' && password === 'password') {
            return res.json({ ok: true, legacy: true });
        }
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (username !== config.AUTH_USERNAME) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, config.AUTH_PASSWORD_HASH);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ username }, config.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
}

function handleLogout(req, res) {
    res.clearCookie('token');
    res.json({ ok: true });
}

module.exports = { requireAuth, handleLogin, handleLogout, loginLimiter, apiLimiter, heavyLimiter };
