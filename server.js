const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Datenbank-Tabellen anlegen
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1Id INTEGER,
    user2Id INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user1Id) REFERENCES users(id),
    FOREIGN KEY(user2Id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fromUserId INTEGER,
    toUserId INTEGER,
    status TEXT DEFAULT 'pending',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fromUserId) REFERENCES users(id),
    FOREIGN KEY(toUserId) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    title TEXT,
    description TEXT,
    content TEXT,
    type TEXT,
    sharedWith TEXT, -- JSON string of user IDs
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT,
    icon TEXT,
    type TEXT,
    parentId TEXT,
    expanded INTEGER DEFAULT 1,
    userId INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS share_in_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shareId INTEGER,
    folderId TEXT,
    userId INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shareId) REFERENCES shares(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);
});

// Registrierung
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
  }

  db.run(
    `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
    [username, email, password],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
        }
        return res.status(400).json({ error: err.message });
      }
      res.json({ id: this.lastID, username, email });
    }
  );
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
  }

  db.get(
    `SELECT id, username, email FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
      res.json(row);
    }
  );
});

// Freundschaftsanfrage senden
app.post('/api/friend-request', (req, res) => {
  const { fromUserId, toUsername } = req.body;
  
  // Erst den Zielbenutzer finden
  db.get('SELECT id FROM users WHERE username = ?', [toUsername], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    
    const toUserId = user.id;
    
    // Prüfen ob bereits Freunde oder Anfrage existiert
    db.get(`
      SELECT 1 FROM friendships 
      WHERE (user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?)
      UNION
      SELECT 1 FROM friend_requests 
      WHERE (fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)
    `, [fromUserId, toUserId, toUserId, fromUserId, fromUserId, toUserId, toUserId, fromUserId], (err, exists) => {
      if (err) return res.status(500).json({ error: err.message });
      if (exists) return res.status(400).json({ error: 'Freundschaft oder Anfrage existiert bereits' });
      
      // Freundschaftsanfrage erstellen
      db.run(
        'INSERT INTO friend_requests (fromUserId, toUserId) VALUES (?, ?)',
        [fromUserId, toUserId],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id: this.lastID });
        }
      );
    });
  });
});

// Freundschaftsanfragen abrufen
app.get('/api/friend-requests/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`
    SELECT fr.id, fr.fromUserId, fr.toUserId, fr.status, fr.createdAt,
           u.username as fromUsername, u.email as fromEmail
    FROM friend_requests fr
    JOIN users u ON fr.fromUserId = u.id
    WHERE fr.toUserId = ? AND fr.status = 'pending'
  `, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Freundschaftsanfrage annehmen/ablehnen
app.post('/api/friend-request/:requestId/:action', (req, res) => {
  const { requestId, action } = req.params;
  
  if (action === 'accept') {
    // Erst die Anfrage holen
    db.get('SELECT * FROM friend_requests WHERE id = ?', [requestId], (err, request) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!request) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
      
      // Freundschaft erstellen
      db.run(
        'INSERT INTO friendships (user1Id, user2Id) VALUES (?, ?)',
        [request.fromUserId, request.toUserId],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          // Anfrage löschen
          db.run('DELETE FROM friend_requests WHERE id = ?', [requestId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
          });
        }
      );
    });
  } else if (action === 'reject') {
    db.run('DELETE FROM friend_requests WHERE id = ?', [requestId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  } else {
    res.status(400).json({ error: 'Ungültige Aktion' });
  }
});

// Freunde abrufen
app.get('/api/friends/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`
    SELECT f.id as friendshipId, u.id, u.username, u.email
    FROM friendships f
    JOIN users u ON (f.user1Id = u.id OR f.user2Id = u.id)
    WHERE (f.user1Id = ? OR f.user2Id = ?) AND u.id != ?
  `, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Inhalte teilen
app.post('/api/share', (req, res) => {
  const { userId, title, description, content, type, sharedWith } = req.body;
  
  const sharedWithJson = JSON.stringify(sharedWith);
  
  db.run(
    `INSERT INTO shares (userId, title, description, content, type, sharedWith) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, title, description, content, type, sharedWithJson],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Eigene geteilte Inhalte abrufen
app.get('/api/my-shares/:userId', (req, res) => {
  db.all(
    `SELECT * FROM shares WHERE userId = ? ORDER BY createdAt DESC`,
    [req.params.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Parse sharedWith JSON
      const parsedRows = rows.map(row => ({
        ...row,
        sharedWith: JSON.parse(row.sharedWith || '[]')
      }));
      
      res.json(parsedRows);
    }
  );
});

// Erhaltene Inhalte abrufen
app.get('/api/received-shares/:userId', (req, res) => {
  db.all(`
    SELECT s.*, u.username as authorName
    FROM shares s
    JOIN users u ON s.userId = u.id
    WHERE s.id IN (
      SELECT s2.id FROM shares s2 
      WHERE JSON_EXTRACT(s2.sharedWith, '$') LIKE '%' || ? || '%'
    ) AND s.userId != ?
    ORDER BY s.createdAt DESC
  `, [req.params.userId, req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Parse sharedWith JSON and filter
    const parsedRows = rows.map(row => ({
      ...row,
      sharedWith: JSON.parse(row.sharedWith || '[]')
    })).filter(row => row.sharedWith.includes(parseInt(req.params.userId)));
    
    res.json(parsedRows);
  });
});

// Ordner erstellen
app.post('/api/folders', (req, res) => {
  const { id, name, icon, type, parentId, userId } = req.body;
  
  db.run(
    'INSERT INTO folders (id, name, icon, type, parentId, userId) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, icon, type, parentId, userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Ordner abrufen
app.get('/api/folders/:userId', (req, res) => {
  db.all(
    'SELECT * FROM folders WHERE userId = ? OR type = "system" ORDER BY name',
    [req.params.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Inhalt zu Ordner hinzufügen/entfernen
app.post('/api/folder-content', (req, res) => {
  const { shareId, folderIds, userId } = req.body;
  
  // Erst alle existierenden Zuordnungen für diesen Share löschen
  db.run('DELETE FROM share_in_folders WHERE shareId = ? AND userId = ?', [shareId, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Dann neue Zuordnungen hinzufügen
    if (folderIds && folderIds.length > 0) {
      const placeholders = folderIds.map(() => '(?, ?, ?)').join(',');
      const values = [];
      folderIds.forEach(folderId => {
        values.push(shareId, folderId, userId);
      });
      
      db.run(
        `INSERT INTO share_in_folders (shareId, folderId, userId) VALUES ${placeholders}`,
        values,
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        }
      );
    } else {
      res.json({ success: true });
    }
  });
});

// Ordner löschen
app.delete('/api/folders/:folderId', (req, res) => {
  const { folderId } = req.params;
  const { userId } = req.query; // userId als Query-Parameter
  
  if (!userId) {
    return res.status(400).json({ error: 'Benutzer-ID erforderlich' });
  }
  
  // Prüfen ob der Ordner dem Benutzer gehört und nicht vom System ist
  db.get(
    'SELECT * FROM folders WHERE id = ? AND userId = ? AND type != "system"',
    [folderId, userId],
    (err, folder) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!folder) return res.status(404).json({ error: 'Ordner nicht gefunden oder keine Berechtigung' });
      
      // Erst alle Share-Zuordnungen für diesen Ordner löschen
      db.run('DELETE FROM share_in_folders WHERE folderId = ? AND userId = ?', [folderId, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Dann den Ordner selbst löschen
        db.run('DELETE FROM folders WHERE id = ? AND userId = ?', [folderId, userId], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        });
      });
    }
  );
});

// Ordner umbenennen
app.put('/api/folders/:folderId', (req, res) => {
  const { folderId } = req.params;
  const { name, userId } = req.body;
  
  if (!name || !userId) {
    return res.status(400).json({ error: 'Name und Benutzer-ID erforderlich' });
  }
  
  // Prüfen ob der Ordner dem Benutzer gehört und nicht vom System ist
  db.get(
    'SELECT * FROM folders WHERE id = ? AND userId = ? AND type != "system"',
    [folderId, userId],
    (err, folder) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!folder) return res.status(404).json({ error: 'Ordner nicht gefunden oder keine Berechtigung' });
      
      // Ordner umbenennen
      db.run(
        'UPDATE folders SET name = ? WHERE id = ? AND userId = ?',
        [name.trim(), folderId, userId],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        }
      );
    }
  );
});

// Ordner-Inhalte abrufen
app.get('/api/folder-content/:userId/:folderId', (req, res) => {
  const { userId, folderId } = req.params;
  
  db.all(
    'SELECT shareId FROM share_in_folders WHERE userId = ? AND folderId = ?',
    [userId, folderId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(row => row.shareId));
    }
  );
});

// Share löschen
app.delete('/api/shares/:shareId', (req, res) => {
  const shareId = req.params.shareId;
  
  // Erst aus Ordnern entfernen
  db.run('DELETE FROM share_in_folders WHERE shareId = ?', [shareId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Dann Share löschen
    db.run('DELETE FROM shares WHERE id = ?', [shareId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// Account aktualisieren
app.put('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  const { username, email, password } = req.body;
  
  let query = 'UPDATE users SET username = ?, email = ?';
  let params = [username, email];
  
  if (password) {
    query += ', password = ?';
    params.push(password);
  }
  
  query += ' WHERE id = ?';
  params.push(userId);
  
  db.run(query, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// Account löschen
app.delete('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  
  // Alle Daten des Benutzers löschen
  db.serialize(() => {
    db.run('DELETE FROM share_in_folders WHERE userId = ?', [userId]);
    db.run('DELETE FROM shares WHERE userId = ?', [userId]);
    db.run('DELETE FROM folders WHERE userId = ?', [userId]);
    db.run('DELETE FROM friendships WHERE user1Id = ? OR user2Id = ?', [userId, userId]);
    db.run('DELETE FROM friend_requests WHERE fromUserId = ? OR toUserId = ?', [userId, userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// Standard-Ordner für neuen Benutzer erstellen
app.post('/api/init-folders/:userId', (req, res) => {
  const userId = req.params.userId;
  
  const defaultFolders = [
    { id: 'favorites', name: 'Favoriten', icon: '⭐', type: 'system' },
    { id: 'important', name: 'Wichtig', icon: '❗', type: 'system' }
  ];
  
  const placeholders = defaultFolders.map(() => '(?, ?, ?, ?, NULL, 1, ?)').join(',');
  const values = [];
  
  defaultFolders.forEach(folder => {
    values.push(folder.id, folder.name, folder.icon, folder.type, userId);
  });
  
  db.run(
    `INSERT OR IGNORE INTO folders (id, name, icon, type, parentId, expanded, userId) VALUES ${placeholders}`,
    values,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Server läuft auf http://localhost:${PORT}`);
  console.log(`🌐 Netzwerk-Zugriff auf http://$(hostname -I | cut -d' ' -f1):${PORT}`);
});