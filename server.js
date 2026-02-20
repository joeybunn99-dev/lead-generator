const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database
try {
    initDb();
} catch (err) {
    console.error('Database initialization failed:', err);
}

// API Routes Placeholder
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'NC B2B Lead Engine API is running' });
});

// Import and use routes (to be created)
const leadsRoutes = require('./routes/leads');
app.use('/api', leadsRoutes);
// app.useState('/api/leads', leadsRoutes); // Kept original structure but mapped to /api for easier routing in app.js

app.post('/api/settings/logo', (req, res) => {
    // Simple file stream read for this demo environment without multer
    try {
        const filePath = path.join(__dirname, 'public', 'logo.webp');
        const writeStream = fs.createWriteStream(filePath);
        req.pipe(writeStream);

        req.on('end', () => {
            res.json({ message: 'Logo uploaded successfully' });
        });

        writeStream.on('error', (err) => {
            res.status(500).json({ error: 'Failed to write logo file' });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start server only when run directly (not when imported by Netlify function)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Open http://localhost:${PORT} in your browser.`);
    });
}

module.exports = app;
