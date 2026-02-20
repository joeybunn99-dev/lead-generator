const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'leads.db');
const db = new sqlite3.Database(dbPath);

console.log("Running migration v6...");

db.serialize(() => {
    // Add contacted column
    db.run("ALTER TABLE leads ADD COLUMN contacted BOOLEAN DEFAULT 0", (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error("Error adding contacted column:", err.message);
        } else {
            console.log("Added contacted column.");
        }
    });
});

db.close();
