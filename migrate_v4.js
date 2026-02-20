const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'leads.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Running migration v4...");

    // Add lead_score column
    db.run("ALTER TABLE leads ADD COLUMN lead_score INTEGER DEFAULT 0", (err) => {
        if (err && !err.message.includes('duplicate column')) console.error("Error adding lead_score:", err.message);
        else console.log("Added lead_score column");
    });
});

db.close();
