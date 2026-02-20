const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'leads.db');
const db = new sqlite3.Database(dbPath);

console.log("Running migration v5...");

db.serialize(() => {
    // 1. Add new columns
    const columns = [
        "ALTER TABLE leads ADD COLUMN address TEXT",
        "ALTER TABLE leads ADD COLUMN contact_name TEXT",
        "ALTER TABLE leads ADD COLUMN job_title TEXT",
        "ALTER TABLE leads ADD COLUMN email_verification_status TEXT"
    ];

    columns.forEach(sql => {
        db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error("Error adding column:", err.message);
            }
        });
    });

    // 2. Backfill data
    db.all("SELECT id, people, verification_status, city, state FROM leads", (err, rows) => {
        if (err) return console.error("Error fetching leads:", err);

        const stmt = db.prepare("UPDATE leads SET contact_name = ?, job_title = ?, email_verification_status = ?, address = ? WHERE id = ?");

        rows.forEach(row => {
            let contact_name = null;
            let job_title = null;
            let address = row.city && row.state ? `${row.city}, ${row.state}` : null; // Default address

            // Parse People
            if (row.people) {
                try {
                    const people = JSON.parse(row.people);
                    if (people.length > 0) {
                        const person = people[0]; // Take the first one
                        // heuristic split: "Name - Title" or "Name, Title" or "Title Name"
                        // Our scraper regex often captures "John Doe - CEO"
                        const separatorRegex = /[\s-]+(CEO|Chief|Founder|Owner|President|Director|Manager|VP|Head|Partner|Principal)/i;
                        const match = person.match(separatorRegex);

                        if (match) {
                            const splitIdx = match.index;
                            contact_name = person.substring(0, splitIdx).trim().replace(/[-,\s]+$/, '');
                            job_title = person.substring(splitIdx).trim().replace(/^[-,\s]+/, '');
                        } else {
                            // Fallback
                            job_title = "Decision Maker";
                            contact_name = person;
                        }
                    }
                } catch (e) { }
            }

            stmt.run(contact_name, job_title, row.verification_status, address, row.id);
        });

        stmt.finalize(() => {
            console.log("Migration v5 completed: Columns added and data backfilled.");
            db.close();
        });
    });
});
