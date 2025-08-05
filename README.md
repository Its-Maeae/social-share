# 📤 Social Share – Teile, was dir wichtig ist

**Social Share** ist eine interaktive Web-Anwendung, die das Teilen von Inhalten mit Freunden revolutioniert. Egal ob Links, Bilder oder Dokumente – hier bekommst du eine übersichtliche Plattform, um deine Inhalte gezielt zu verwalten und mit anderen zu teilen. Alles verpackt in einer intuitiven Oberfläche, die sowohl funktional als auch nutzerfreundlich ist.

---

## ✨ Features

- 🔐 **Benutzer-Authentifizierung**  
  Registriere dich oder logge dich ein – mit einem einfachen Formularsystem.

- 👥 **Freundesmanagement**  
  Sende, akzeptiere oder lehne Freundschaftsanfragen ab. Behalte den Überblick über deine Kontakte.

- 📎 **Teilen von Inhalten**  
  Teile Links, Bilder oder Dokumente direkt mit deinen Freunden. Einfach hochladen oder verlinken, Beschreibung dazu – fertig.

- 🗂️ **Ordnerstruktur für erhaltene Inhalte**  
  Organisiere empfangene Inhalte in benutzerdefinierte Ordner wie „Favoriten“ oder „Wichtig“ oder erstelle eigene Kategorien.

- 📬 **Echtzeit-Dashboard**  
  Behalte im Dashboard den Überblick über deine Freundschaften, geteilten Inhalte und offenen Anfragen.

- 🛠️ **Account-Verwaltung**  
  Aktualisiere deinen Benutzernamen, deine E-Mail oder dein Passwort – oder lösche deinen Account vollständig (wenn du dich traust 😉).

---

## 🚀 Getting Started

### Voraussetzungen

- Webserver (z.B. Rasberry Pi) mit Unterstützung für statische Dateien (z. B. Apache, Nginx, VS Code Live Server)
- Backend-API (nicht enthalten) mit Endpunkten wie `/api/register`, `/api/login`, `/api/friends/...`, etc.

---

## 💻 Einrichtung

- Installation von Git `sudo apt install git-all` (installation checken mit `git --version`)
- Installation der neusten Version von Node `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -` und `sudo apt-get install -y nodejs`
- Ordner in Verzeichnis clonen `git clone [Projektlink]`
- Zu Ordner wechseln `cd social-share`
- Node und Tools installieren mit `npm i`
- Server starten mit `node server.js`
- Der Server läuft auf `https://[IP-Adresse]:3000`


## 🧠 Technisches Konzept

- **Vanilla JS** für Logik, Events und API-Kommunikation
- **Modulare Funktionen** für Authentifizierung, Teilen, Ordnerhandling und mehr
- **Dynamisches DOM-Rendering** für Inhalte, Listen und Modale
- **Fehlerbehandlung** und **User Feedback** via Benachrichtigungen

---

## 🔒 Datenschutz-Hinweis

Das Projekt dient primär zu Demonstrationszwecken. Eine produktive Verwendung sollte um Authentifizierung, Autorisierung und sichere Dateiübertragung ergänzt werden.
