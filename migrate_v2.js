const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'leads.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Running migration...");

    // Add best_email column
    db.run("ALTER TABLE leads ADD COLUMN best_email TEXT", (err) => {
        if (err && !err.message.includes('duplicate column')) console.error("Error adding best_email:", err.message);
        else console.log("Added best_email column");
    });

    // Add people column (JSON text)
    db.run("ALTER TABLE leads ADD COLUMN people TEXT", (err) => {
        if (err && !err.message.includes('duplicate column')) console.error("Error adding people:", err.message);
        else console.log("Added people column");
    });
});

db.close();
