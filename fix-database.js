const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('🔧 Starte Datenbank-Reparatur...');

// Alte Datenbank löschen falls vorhanden und problematisch
const dbPath = './database.db';
if (fs.existsSync(dbPath)) {
    try {
        fs.unlinkSync(dbPath);
        console.log('✅ Alte Datenbank gelöscht');
    } catch (err) {
        console.error('❌ Fehler beim Löschen der alten Datenbank:', err);
    }
}

// Neue Datenbank erstellen
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('❌ Fehler beim Erstellen der Datenbank:', err);
        process.exit(1);
    } else {
        console.log('✅ Neue Datenbank erstellt');
    }
});

db.serialize(() => {
    console.log('🔧 Konfiguriere Datenbank...');
    
    // Optimale Einstellungen für Schreibzugriff
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL"); 
    db.run("PRAGMA temp_store = MEMORY");
    db.run("PRAGMA mmap_size = 268435456");
    
    console.log('📋 Erstelle Tabellen...');
    
    // Benutzer-Tabelle
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Freundschaften-Tabelle
    db.run(`CREATE TABLE friendships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1Id INTEGER NOT NULL,
        user2Id INTEGER NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user1Id) REFERENCES users(id),
        FOREIGN KEY(user2Id) REFERENCES users(id)
    )`);
    
    // Freundschaftsanfragen-Tabelle
    db.run(`CREATE TABLE friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromUserId INTEGER NOT NULL,
        toUserId INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(fromUserId) REFERENCES users(id),
        FOREIGN KEY(toUserId) REFERENCES users(id)
    )`);
    
    // Geteilte Inhalte-Tabelle
    db.run(`CREATE TABLE shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        sharedWith TEXT NOT NULL, -- JSON string of user IDs
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    
    // Ordner-Tabelle
    db.run(`CREATE TABLE folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        type TEXT NOT NULL,
        parentId TEXT,
        expanded INTEGER DEFAULT 1,
        userId INTEGER NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    
    // Ordner-Inhalte-Tabelle
    db.run(`CREATE TABLE share_in_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shareId INTEGER NOT NULL,
        folderId TEXT NOT NULL,
        userId INTEGER NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(shareId, folderId, userId),
        FOREIGN KEY(shareId) REFERENCES shares(id),
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    
    console.log('👤 Erstelle Test-Benutzer...');
    
    // Test-Benutzer erstellen
    db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
        ['admin', 'admin@test.de', 'admin123'], function(err) {
            if (err) {
                console.error('❌ Fehler beim Erstellen des Test-Benutzers:', err);
            } else {
                console.log('✅ Test-Benutzer erstellt (admin/admin123)');
                
                // Standard-Ordner für Test-Benutzer erstellen
                const userId = this.lastID;
                console.log('📁 Erstelle Standard-Ordner...');
                
                db.run(`INSERT INTO folders (id, name, icon, type, parentId, expanded, userId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    ['favorites', 'Favoriten', '⭐', 'system', null, 1, userId], (err) => {
                        if (err) console.error('❌ Fehler beim Erstellen des Favoriten-Ordners:', err);
                        else console.log('✅ Favoriten-Ordner erstellt');
                    });
                
                db.run(`INSERT INTO folders (id, name, icon, type, parentId, expanded, userId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    ['important', 'Wichtig', '❗', 'system', null, 1, userId], (err) => {
                        if (err) console.error('❌ Fehler beim Erstellen des Wichtig-Ordners:', err);
                        else console.log('✅ Wichtig-Ordner erstellt');
                    });
            }
        });
});

// Datenbankberechtigungen setzen
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ Fehler beim Schließen der Datenbank:', err);
        } else {
            console.log('✅ Datenbank geschlossen');
            
            // Berechtigungen setzen
            try {
                fs.chmodSync(dbPath, 0o666);
                console.log('✅ Datenbankberechtigungen gesetzt');
            } catch (err) {
                console.error('❌ Fehler beim Setzen der Berechtigungen:', err);
            }
            
            console.log('🎉 Datenbank-Reparatur abgeschlossen!');
            console.log('📝 Sie können sich mit admin/admin123 anmelden');
            process.exit(0);
        }
    });
}, 1000);