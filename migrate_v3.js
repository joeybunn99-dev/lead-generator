const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'leads.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Running migration v3...");

    // Add verification_status column
    db.run("ALTER TABLE leads ADD COLUMN verification_status TEXT DEFAULT 'Unverified'", (err) => {
        if (err && !err.message.includes('duplicate column')) console.error("Error adding verification_status:", err.message);
        else console.log("Added verification_status column");
    });
});

db.close();
