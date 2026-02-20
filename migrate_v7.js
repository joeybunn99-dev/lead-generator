const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'leads.db');
const db = new sqlite3.Database(dbPath);

console.log("Running migration v7...");

db.serialize(() => {
    // Create search_history table
    db.run(`CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_type TEXT NOT NULL,
        query_value TEXT NOT NULL,
        leads_found INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error("Error creating search_history table:", err.message);
        } else {
            console.log("Created search_history table.");
        }
    });
});

db.close();
