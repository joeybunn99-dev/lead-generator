const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// On Netlify (serverless), use in-memory DB — persistent file system isn't available
const dbPath = process.env.NETLIFY ? ':memory:' : path.resolve(__dirname, 'leads.db');

let db;

function connect() {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Could not connect to database', err);
                reject(err);
            } else {
                console.log('Connected to SQLite database');
                resolve(database);
            }
        });
    });
}

async function initDb() {
    try {
        db = await connect();
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_name TEXT NOT NULL,
                website TEXT,
                email TEXT,
                phone TEXT,
                city TEXT,
                state TEXT,
                verified_email BOOLEAN DEFAULT 0,
                best_email TEXT,
                people TEXT,
                verification_status TEXT,
                lead_score INTEGER DEFAULT 0,
                address TEXT,
                contact_name TEXT,
                job_title TEXT,

                email_verification_status TEXT,
                contacted BOOLEAN DEFAULT 0,
                source TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query_type TEXT,
                query_value TEXT,
                leads_found INTEGER DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('Leads table initialized');
        });
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
}

function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return db;
}

module.exports = {
    initDb,
    getDb
};
