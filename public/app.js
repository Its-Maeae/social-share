// API-Funktionen für Server-Kommunikation
const API_BASE = '';

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(API_BASE + endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Server-Fehler');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Globale Variablen
let currentUser = null;
let currentShareType = 'link';
let currentFolder = 'all';
let selectedShareForFolder = null;
let friendsCache = [];
let foldersCache = [];

// Initialisierung
function init() {
    updateDashboard();
}

// Authentication Functions
function switchAuthTab(tab) {
    document.querySelectorAll('#authContainer .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#authContainer .tab-content').forEach(t => t.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelector('#authContainer .tab:first-child').classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelector('#authContainer .tab:last-child').classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

async function register(event) {
    event.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;

    if (password !== passwordConfirm) {
        showNotification('Passwörter stimmen nicht überein', 'error');
        return;
    }

    try {
        await apiCall('/api/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        
        showNotification('Registrierung erfolgreich! Sie können sich jetzt anmelden.', 'success');
        switchAuthTab('login');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const user = await apiCall('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        currentUser = user;
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        document.getElementById('welcomeMessage').textContent = `Willkommen, ${user.username}!`;
        document.getElementById('userAvatar').textContent = user.username.charAt(0).toUpperCase();
        
        loadAccountData();
        await initializeUserFolders();
        await updateDashboard();
        await loadFriends();
        await loadMyShares();
        await loadFolders();
        await loadReceivedShares();
        
        showNotification('Erfolgreich angemeldet!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function logout() {
    currentUser = null;
    currentFolder = 'all';
    friendsCache = [];
    foldersCache = [];
    
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    
    // Reset forms
    document.querySelectorAll('form').forEach(form => form.reset());
}

// Standard-Ordner für neuen Benutzer initialisieren
async function initializeUserFolders() {
    try {
        await apiCall(`/api/init-folders/${currentUser.id}`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Fehler beim Initialisieren der Ordner:', error);
    }
}

// Friends Management
function showAddFriendModal() {
    document.getElementById('addFriendModal').style.display = 'block';
}

async function sendFriendRequest(event) {
    event.preventDefault();
    
    const friendUsername = document.getElementById('friendUsername').value;
    
    try {
        await apiCall('/api/friend-request', {
            method: 'POST',
            body: JSON.stringify({
                fromUserId: currentUser.id,
                toUsername: friendUsername
            })
        });
        
        closeModal('addFriendModal');
        showNotification('Freundschaftsanfrage gesendet!', 'success');
        await updateDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function acceptFriendRequest(requestId) {
    try {
        await apiCall(`/api/friend-request/${requestId}/accept`, {
            method: 'POST'
        });
        
        await loadFriends();
        await updateDashboard();
        showNotification('Freundschaftsanfrage angenommen!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function rejectFriendRequest(requestId) {
    try {
        await apiCall(`/api/friend-request/${requestId}/reject`, {
            method: 'POST'
        });
        
        await loadFriends();
        await updateDashboard();
        showNotification('Freundschaftsanfrage abgelehnt', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function removeFriend(friendshipId) {
    if (confirm('Möchten Sie diesen Freund wirklich entfernen?')) {
        // Diese Funktionalität müsste im Server implementiert werden
        showNotification('Funktion noch nicht implementiert', 'error');
    }
}

async function loadFriends() {
    try {
        const [friends, requests] = await Promise.all([
            apiCall(`/api/friends/${currentUser.id}`),
            apiCall(`/api/friend-requests/${currentUser.id}`)
        ]);
        
        friendsCache = friends;
        
        // Load current friends
        const friendsList = document.getElementById('friendsList');
        friendsList.innerHTML = '';
        
        friends.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.innerHTML = `
                <div>
                    <strong>${friend.username}</strong>
                    <small style="display: block; color: #718096;">${friend.email}</small>
                </div>
                <button class="btn-danger" onclick="removeFriend(${friend.friendshipId})">Entfernen</button>
            `;
            friendsList.appendChild(friendItem);
        });
        
        if (friends.length === 0) {
            friendsList.innerHTML = '<p style="text-align: center; color: #718096;">Noch keine Freunde hinzugefügt.</p>';
        }
        
        // Load friend requests
        const requestsList = document.getElementById('requestsList');
        requestsList.innerHTML = '';
        
        requests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item';
            requestItem.innerHTML = `
                <div>
                    <strong>${request.fromUsername}</strong>
                    <small style="display: block; color: #718096;">möchte Ihr Freund werden</small>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-success" onclick="acceptFriendRequest(${request.id})">Annehmen</button>
                    <button class="btn-danger" onclick="rejectFriendRequest(${request.id})">Ablehnen</button>
                </div>
            `;
            requestsList.appendChild(requestItem);
        });
        
        if (requests.length === 0) {
            requestsList.innerHTML = '<p style="text-align: center; color: #718096;">Keine offenen Freundschaftsanfragen.</p>';
        }
        
    } catch (error) {
        console.error('Fehler beim Laden der Freunde:', error);
        showNotification('Fehler beim Laden der Freunde', 'error');
    }
}

// Share Content
function selectShareType(type) {
    currentShareType = type;
    
    document.querySelectorAll('.share-type-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (type === 'link') {
        document.getElementById('linkGroup').classList.remove('hidden');
        document.getElementById('fileGroup').classList.add('hidden');
    } else {
        document.getElementById('linkGroup').classList.add('hidden');
        document.getElementById('fileGroup').classList.remove('hidden');
    }
}

function showShareModal() {    
    const friendsCheckboxes = document.getElementById('friendsCheckboxes');
    friendsCheckboxes.innerHTML = '';
    
    friendsCache.forEach(friend => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        checkboxItem.innerHTML = `
            <input type="checkbox" id="friend_${friend.id}" value="${friend.id}">
            <label for="friend_${friend.id}">${friend.username}</label>
        `;
        friendsCheckboxes.appendChild(checkboxItem);
    });
    
    if (friendsCache.length === 0) {
        friendsCheckboxes.innerHTML = '<p style="text-align: center; color: #718096;">Keine Freunde zum Teilen verfügbar. Fügen Sie zuerst Freunde hinzu.</p>';
    }
    
    document.getElementById('shareModal').style.display = 'block';
}

async function shareContent(event) {
    event.preventDefault();
    
    const title = document.getElementById('shareTitle').value;
    const description = document.getElementById('shareDescription').value;
    let content = '';
    
    if (currentShareType === 'link') {
        content = document.getElementById('shareLink').value;
        if (!content) {
            showNotification('Bitte geben Sie eine URL ein', 'error');
            return;
        }
    } else {
        const fileInput = document.getElementById('shareFile');
        if (fileInput.files.length === 0) {
            showNotification('Bitte wählen Sie eine Datei aus', 'error');
            return;
        }
        content = fileInput.files[0].name; // In einer echten App würde die Datei hochgeladen
    }
    
    // Get selected friends
    const selectedFriends = [];
    document.querySelectorAll('#friendsCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFriends.push(parseInt(checkbox.value));
    });
    
    if (selectedFriends.length === 0) {
        showNotification('Bitte wählen Sie mindestens einen Freund aus', 'error');
        return;
    }
    
    try {
        await apiCall('/api/share', {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id,
                title,
                description,
                content,
                type: currentShareType,
                sharedWith: selectedFriends
            })
        });
        
        closeModal('shareModal');
        await loadMyShares();
        await loadReceivedShares();
        await updateDashboard();
        showNotification('Inhalt erfolgreich geteilt!', 'success');
        
        // Reset form
        document.getElementById('shareTitle').value = '';
        document.getElementById('shareDescription').value = '';
        document.getElementById('shareLink').value = '';
        document.getElementById('shareFile').value = '';
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function loadMyShares() {
    try {
        const myShares = await apiCall(`/api/my-shares/${currentUser.id}`);
        const mySharesList = document.getElementById('mySharesList');
        
        mySharesList.innerHTML = '';
        
        myShares.forEach(share => {
            const shareItem = document.createElement('div');
            shareItem.className = 'share-item';
            
            let contentDisplay = '';
            let typeIcon = '';
            
            if (share.type === 'link') {
                contentDisplay = `<a href="${share.content}" target="_blank" style="color: #5a67d8;">${share.content}</a>`;
                typeIcon = '🔗';
            } else if (share.type === 'image') {
                contentDisplay = `🖼️ ${share.content}`;
                typeIcon = '🖼️';
            } else {
                contentDisplay = `📄 ${share.content}`;
                typeIcon = '📄';
            }
            
            const sharedWithNames = share.sharedWith.map(id => {
                const friend = friendsCache.find(f => f.id === id);
                return friend ? friend.username : 'Unbekannt';
            }).join(', ');
            
            shareItem.innerHTML = `
                <div style="flex: 1;">
                    <h4>${typeIcon} ${share.title}</h4>
                    <p style="margin: 5px 0; color: #718096;">${share.description}</p>
                    <div style="margin: 10px 0;">${contentDisplay}</div>
                    <small style="color: #a0aec0;">
                        Geteilt mit: ${sharedWithNames} 
                        am ${new Date(share.createdAt).toLocaleDateString('de-DE')}
                    </small>
                </div>
                <button class="btn-danger" onclick="deleteShare(${share.id})">Löschen</button>
            `;
            
            mySharesList.appendChild(shareItem);
        });
        
        if (myShares.length === 0) {
            mySharesList.innerHTML = '<p style="text-align: center; color: #718096;">Sie haben noch keine Inhalte geteilt.</p>';
        }
    } catch (error) {
        console.error('Fehler beim Laden der eigenen Shares:', error);
        showNotification('Fehler beim Laden der Inhalte', 'error');
    }
}

// Ordner-Management
async function loadFolders() {
    try {
        const folders = await apiCall(`/api/folders/${currentUser.id}`);
        foldersCache = folders;
        
        const folderList = document.getElementById('folderList');
        if (!folderList) return;
        
        folderList.innerHTML = '';
        
        // Standard-Ordner zuerst
        const allFolder = { id: 'all', name: 'Alle Inhalte', icon: '📄', type: 'system' };
        const folderItem = createFolderElement(allFolder);
        folderList.appendChild(folderItem);
        
        // Dann andere Ordner
        const topLevelFolders = folders.filter(f => !f.parentId);
        topLevelFolders.forEach(folder => {
            const folderItem = createFolderElement(folder);
            folderList.appendChild(folderItem);
        });
        
        // Zählungen aktualisieren
        await updateFolderCounts();
    } catch (error) {
        console.error('Fehler beim Laden der Ordner:', error);
    }
}

// Aktualisierte createFolderElement Funktion mit Bearbeiten-Button
function createFolderElement(folder) {
    const li = document.createElement('li');
    li.className = 'folder-item';
    
    let count = 0;
    if (folder.id === 'all') {
        count = '';
    } else {
        count = getShareCountInFolder(folder.id);
    }
    
    const hasChildren = foldersCache.some(f => f.parentId === folder.id);
    
    const header = document.createElement('div');
    header.className = `folder-header ${currentFolder === folder.id ? 'active' : ''}`;
    
    header.innerHTML = `
        ${hasChildren ? `<span class="folder-toggle ${folder.expanded ? '' : 'collapsed'}">▼</span>` : '<span class="folder-toggle" style="visibility: hidden;">▼</span>'}
        <span class="folder-icon">${folder.icon}</span>
        <span class="folder-name">${folder.name}</span>
        <span class="folder-count" id="count-${folder.id}">${count}</span>
        <div class="folder-actions">
            ${folder.type !== 'system' ? `
                <button onclick="renameFolder('${folder.id}', event)" title="Umbenennen">✏️</button>
                <button onclick="deleteFolder('${folder.id}', event)" title="Löschen">🗑️</button>
            ` : ''}
        </div>
    `;
    
    header.addEventListener('click', (e) => {
        if (e.target.classList.contains('folder-toggle') && hasChildren) {
            toggleFolder(folder.id);
        } else if (!e.target.closest('.folder-actions')) {
            selectFolder(folder.id);
        }
    });
    
    li.appendChild(header);
    
    return li;
}

function getShareCountInFolder(folderId) {
    // Placeholder-Wert, wird durch updateFolderCounts() aktualisiert
    return 0;
}

// Neue Funktion zum Aktualisieren der Ordner-Zählungen
async function updateFolderCounts() {
    try {
        // Alle erhaltenen Shares abrufen
        const receivedShares = await apiCall(`/api/received-shares/${currentUser.id}`);
        
        // Zählung für "Alle Inhalte"
        const allCountElement = document.getElementById('count-all');
        if (allCountElement) {
            allCountElement.textContent = receivedShares.length;
        }
        
        // Zählung für jeden Ordner
        for (const folder of foldersCache) {
            if (folder.id !== 'all') {
                try {
                    const folderContentIds = await apiCall(`/api/folder-content/${currentUser.id}/${folder.id}`);
                    const count = folderContentIds.length;
                    
                    const countElement = document.getElementById(`count-${folder.id}`);
                    if (countElement) {
                        countElement.textContent = count;
                    }
                } catch (error) {
                    console.error(`Fehler beim Laden der Zählung für Ordner ${folder.id}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Ordner-Zählungen:', error);
    }
}

function selectFolder(folderId) {
    currentFolder = folderId;
    loadFolders();
    loadReceivedShares();
}

async function createFolder(event) {
    event.preventDefault();
    
    const name = document.getElementById('newFolderName').value.trim();
    if (!name) return;
    
    const folderId = 'folder_' + Date.now();
    
    try {
        await apiCall('/api/folders', {
            method: 'POST',
            body: JSON.stringify({
                id: folderId,
                name: name,
                icon: '📁',
                type: 'user',
                parentId: null,
                userId: currentUser.id
            })
        });
        
        document.getElementById('newFolderName').value = '';
        await loadFolders();
        showNotification('Ordner erstellt!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteFolder(folderId, event) {
    event.stopPropagation();
    
    // Prüfen ob es ein System-Ordner ist
    const folder = foldersCache.find(f => f.id === folderId);
    if (!folder) {
        showNotification('Ordner nicht gefunden', 'error');
        return;
    }
    
    if (folder.type === 'system') {
        showNotification('System-Ordner können nicht gelöscht werden', 'error');
        return;
    }
    
    // Anzahl der Inhalte in dem Ordner prüfen
    let contentCount = 0;
    try {
        const folderContentIds = await apiCall(`/api/folder-content/${currentUser.id}/${folderId}`);
        contentCount = folderContentIds.length;
    } catch (error) {
        console.error('Fehler beim Prüfen der Ordner-Inhalte:', error);
    }
    
    // Bestätigung mit Informationen über Inhalte
    let confirmMessage = `Möchten Sie den Ordner "${folder.name}" wirklich löschen?`;
    if (contentCount > 0) {
        confirmMessage += `\n\nDer Ordner enthält ${contentCount} Inhalt${contentCount !== 1 ? 'e' : ''}. Die Inhalte selbst bleiben erhalten und sind weiterhin unter "Alle Inhalte" verfügbar.`;
    }
    
    if (confirm(confirmMessage)) {
        try {
            await apiCall(`/api/folders/${folderId}?userId=${currentUser.id}`, {
                method: 'DELETE'
            });
            
            // Wenn der gelöschte Ordner aktuell ausgewählt war, zu "Alle Inhalte" wechseln
            if (currentFolder === folderId) {
                currentFolder = 'all';
            }
            
            // UI aktualisieren
            await loadFolders();
            await loadReceivedShares();
            
            showNotification(`Ordner "${folder.name}" wurde gelöscht`, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

// Zusätzliche Hilfsfunktion: Ordner umbenennen (Bonus-Feature)
async function renameFolder(folderId, event) {
    event.stopPropagation();
    
    const folder = foldersCache.find(f => f.id === folderId);
    if (!folder) {
        showNotification('Ordner nicht gefunden', 'error');
        return;
    }
    
    if (folder.type === 'system') {
        showNotification('System-Ordner können nicht umbenannt werden', 'error');
        return;
    }
    
    const newName = prompt(`Neuen Namen für "${folder.name}" eingeben:`, folder.name);
    if (newName && newName.trim() && newName.trim() !== folder.name) {
        try {
            await apiCall(`/api/folders/${folderId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: newName.trim(),
                    userId: currentUser.id
                })
            });
            
            await loadFolders();
            showNotification(`Ordner zu "${newName.trim()}" umbenannt`, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

// Hilfsfunktion um zu prüfen ob ein Share in einem bestimmten Ordner ist
function isShareInFolder(shareId, folderId) {
    return folderAssignmentsCache[folderId] && folderAssignmentsCache[folderId].includes(shareId);
}

// Aktualisierte loadReceivedShares Funktion mit farbigen Buttons
async function loadReceivedShares() {
    try {
        const receivedShares = await apiCall(`/api/received-shares/${currentUser.id}`);
        
        // Ordner-Zuordnungen laden
        await loadFolderAssignments();
        
        let filteredShares = receivedShares;
        
        const receivedSharesList = document.getElementById('receivedSharesList');
        const currentFolderTitle = document.getElementById('currentFolderTitle');
        const contentCount = document.getElementById('contentCount');
        
        let folderName = 'Alle erhaltenen Inhalte';
        
        // Filterung nach Ordner
        if (currentFolder !== 'all') {
            const folder = foldersCache.find(f => f.id === currentFolder);
            if (folder) {
                folderName = folder.name;
                
                // Hole die Share-IDs für diesen Ordner
                try {
                    const folderContentIds = await apiCall(`/api/folder-content/${currentUser.id}/${currentFolder}`);
                    filteredShares = receivedShares.filter(share => 
                        folderContentIds.includes(share.id)
                    );
                } catch (error) {
                    console.error('Fehler beim Laden der Ordner-Inhalte:', error);
                    filteredShares = [];
                }
            }
        }
        
        currentFolderTitle.textContent = folderName;
        contentCount.textContent = `${filteredShares.length} Inhalt${filteredShares.length !== 1 ? 'e' : ''}`;
        
        receivedSharesList.innerHTML = '';
        
        filteredShares.forEach(share => {
            const shareItem = document.createElement('div');
            shareItem.className = 'share-item-enhanced';
            
            let contentDisplay = '';
            let typeIcon = '';
            
            if (share.type === 'link') {
                contentDisplay = `<a href="${share.content}" target="_blank" style="color: #5a67d8;">${share.content}</a>`;
                typeIcon = '🔗';
            } else if (share.type === 'image') {
                contentDisplay = `🖼️ ${share.content}`;
                typeIcon = '🖼️';
            } else {
                contentDisplay = `📄 ${share.content}`;
                typeIcon = '📄';
            }
            
            // Button-Klassen basierend auf Ordner-Zugehörigkeit
            const favoriteClass = isShareInFolder(share.id, 'favorites') ? 'btn-active-favorite' : 'btn-secondary';
            const importantClass = isShareInFolder(share.id, 'important') ? 'btn-active-important' : 'btn-secondary';
            
            // Prüfen ob der Share in benutzerdefinierten Ordnern ist
            const userFolders = foldersCache.filter(f => f.type === 'user');
            const isInUserFolder = userFolders.some(folder => isShareInFolder(share.id, folder.id));
            const folderClass = isInUserFolder ? 'btn-active-folder' : 'btn-secondary';
            
            shareItem.innerHTML = `
                <div class="share-item-actions">
                    <button class="btn-small ${favoriteClass}" 
                            onclick="toggleFavorite(${share.id})" title="Zu Favoriten">
                        ⭐
                    </button>
                    <button class="btn-small ${importantClass}" 
                            onclick="toggleImportant(${share.id})" title="Als wichtig markieren">
                        ❗
                    </button>
                    <button class="btn-small ${folderClass}" 
                            onclick="showFolderSelectModal(${share.id})" title="Zu Ordner hinzufügen">
                        📁
                    </button>
                </div>
                <div class="share-item-content">
                    <h4>${typeIcon} ${share.title}</h4>
                    <p style="margin: 5px 0; color: #718096;">${share.description}</p>
                    <div style="margin: 10px 0;">${contentDisplay}</div>
                    <small style="color: #a0aec0;">
                        Von ${share.authorName} geteilt 
                        am ${new Date(share.createdAt).toLocaleDateString('de-DE')}
                    </small>
                </div>
            `;
            
            receivedSharesList.appendChild(shareItem);
        });
        
        if (filteredShares.length === 0) {
            if (currentFolder === 'all') {
                receivedSharesList.innerHTML = '<p style="text-align: center; color: #718096;">Sie haben noch keine Inhalte erhalten.</p>';
            } else {
                receivedSharesList.innerHTML = '<p style="text-align: center; color: #718096;">Keine Inhalte in diesem Ordner.</p>';
            }
        }
    } catch (error) {
        console.error('Fehler beim Laden der erhaltenen Shares:', error);
        showNotification('Fehler beim Laden der Inhalte', 'error');
    }
}

// Aktualisierte Toggle-Funktionen mit Cache-Update
async function toggleFavorite(shareId) {
    try {
        const currentFolders = await apiCall(`/api/folder-content/${currentUser.id}/favorites`);
        const isInFavorites = currentFolders.includes(shareId);
        
        await apiCall('/api/folder-content', {
            method: 'POST',
            body: JSON.stringify({
                shareId: shareId,
                folderIds: isInFavorites ? [] : ['favorites'],
                userId: currentUser.id
            })
        });
        
        // Cache aktualisieren
        if (isInFavorites) {
            folderAssignmentsCache['favorites'] = folderAssignmentsCache['favorites'].filter(id => id !== shareId);
        } else {
            if (!folderAssignmentsCache['favorites']) folderAssignmentsCache['favorites'] = [];
            folderAssignmentsCache['favorites'].push(shareId);
        }
        
        await loadFolders();
        await loadReceivedShares();
        showNotification(isInFavorites ? 'Von Favoriten entfernt' : 'Zu Favoriten hinzugefügt', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function toggleImportant(shareId) {
    try {
        const currentFolders = await apiCall(`/api/folder-content/${currentUser.id}/important`);
        const isImportant = currentFolders.includes(shareId);
        
        await apiCall('/api/folder-content', {
            method: 'POST',
            body: JSON.stringify({
                shareId: shareId,
                folderIds: isImportant ? [] : ['important'],
                userId: currentUser.id
            })
        });
        
        // Cache aktualisieren
        if (isImportant) {
            folderAssignmentsCache['important'] = folderAssignmentsCache['important'].filter(id => id !== shareId);
        } else {
            if (!folderAssignmentsCache['important']) folderAssignmentsCache['important'] = [];
            folderAssignmentsCache['important'].push(shareId);
        }
        
        await loadFolders();
        await loadReceivedShares();
        showNotification(isImportant ? 'Als nicht mehr wichtig markiert' : 'Als wichtig markiert', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Aktualisierte showFolderSelectModal Funktion mit vorausgewählten Ordnern
async function showFolderSelectModal(shareId) {
    selectedShareForFolder = shareId;
    
    const folderCheckboxes = document.getElementById('folderCheckboxes');
    folderCheckboxes.innerHTML = '';
    
    const userFolders = foldersCache.filter(f => 
        f.type === 'user' || f.id === 'favorites' || f.id === 'important'
    );
    
    // Aktuelle Ordner-Zuordnungen für diesen Share laden
    let currentFolderIds = [];
    try {
        const promises = userFolders.map(async (folder) => {
            const folderContent = await apiCall(`/api/folder-content/${currentUser.id}/${folder.id}`);
            return { folderId: folder.id, isAssigned: folderContent.includes(shareId) };
        });
        
        const results = await Promise.all(promises);
        currentFolderIds = results.filter(r => r.isAssigned).map(r => r.folderId);
    } catch (error) {
        console.error('Fehler beim Laden der aktuellen Ordner-Zuordnungen:', error);
    }
    
    userFolders.forEach(folder => {
        const isChecked = currentFolderIds.includes(folder.id);
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        checkboxItem.innerHTML = `
            <input type="checkbox" id="folder_${folder.id}" value="${folder.id}" ${isChecked ? 'checked' : ''}>
            <label for="folder_${folder.id}">${folder.icon} ${folder.name}</label>
        `;
        folderCheckboxes.appendChild(checkboxItem);
    });
    
    if (userFolders.length === 0) {
        folderCheckboxes.innerHTML = '<p style="text-align: center; color: #718096;">Keine Ordner verfügbar. Erstellen Sie zuerst einen Ordner.</p>';
    }
    
    document.getElementById('folderSelectModal').style.display = 'block';
}


// Aktualisierte addToSelectedFolders Funktion mit Cache-Update
async function addToSelectedFolders() {
    if (!selectedShareForFolder) return;
    
    const selectedFolders = [];
    document.querySelectorAll('#folderCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedFolders.push(checkbox.value);
    });
    
    try {
        await apiCall('/api/folder-content', {
            method: 'POST',
            body: JSON.stringify({
                shareId: selectedShareForFolder,
                folderIds: selectedFolders,
                userId: currentUser.id
            })
        });
        
        // Cache für alle betroffenen Ordner aktualisieren
        await loadFolderAssignments();
        
        await loadFolders();
        await loadReceivedShares();
        closeModal('folderSelectModal');
        
        const folderCount = selectedFolders.length;
        if (folderCount === 0) {
            showNotification('Inhalt aus allen Ordnern entfernt', 'success');
        } else if (folderCount === 1) {
            showNotification('Inhalt zu 1 Ordner hinzugefügt', 'success');
        } else {
            showNotification(`Inhalt zu ${folderCount} Ordnern hinzugefügt`, 'success');
        }
        
        selectedShareForFolder = null;
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteShare(shareId) {
    if (confirm('Möchten Sie diesen geteilten Inhalt wirklich löschen?')) {
        try {
            await apiCall(`/api/shares/${shareId}`, {
                method: 'DELETE'
            });
            
            await loadMyShares();
            await loadReceivedShares();
            await loadFolders();
            await updateDashboard();
            showNotification('Geteilter Inhalt gelöscht', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

// Account Management
function loadAccountData() {
    document.getElementById('accountUsername').value = currentUser.username;
    document.getElementById('accountEmail').value = currentUser.email;
}

async function updateAccount(event) {
    event.preventDefault();
    
    const newUsername = document.getElementById('accountUsername').value;
    const newEmail = document.getElementById('accountEmail').value;
    const newPassword = document.getElementById('accountPassword').value;
    
    try {
        await apiCall(`/api/users/${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                username: newUsername,
                email: newEmail,
                password: newPassword || undefined
            })
        });
        
        currentUser.username = newUsername;
        currentUser.email = newEmail;
        
        document.getElementById('welcomeMessage').textContent = `Willkommen, ${currentUser.username}!`;
        document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
        
        showNotification('Account erfolgreich aktualisiert!', 'success');
        document.getElementById('accountPassword').value = '';
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteAccount() {
    if (confirm('Möchten Sie Ihren Account wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
        if (confirm('Sind Sie sich absolut sicher? Alle Ihre Daten werden unwiderruflich gelöscht!')) {
            try {
                await apiCall(`/api/users/${currentUser.id}`, {
                    method: 'DELETE'
                });
                
                logout();
                showNotification('Account wurde gelöscht', 'success');
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    }
}

// Dashboard Updates
async function updateDashboard() {
    if (!currentUser) return;
    
    try {
        const [friends, myShares, requests] = await Promise.all([
            apiCall(`/api/friends/${currentUser.id}`).catch(() => []),
            apiCall(`/api/my-shares/${currentUser.id}`).catch(() => []),
            apiCall(`/api/friend-requests/${currentUser.id}`).catch(() => [])
        ]);
        
        document.getElementById('friendCount').textContent = `${friends.length} Freunde`;
        document.getElementById('shareCount').textContent = `${myShares.length} Inhalte geteilt`;
        document.getElementById('requestCount').textContent = `${requests.length} offene Anfragen`;
    } catch (error) {
        console.error('Fehler beim Aktualisieren des Dashboards:', error);
    }
}

// Tab Management
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    if (tabName === 'friends') {
        loadFriends();
    } else if (tabName === 'myshares') {
        loadMyShares();
    } else if (tabName === 'received') {
        loadFolders();
        loadReceivedShares();
    }
}

function switchFriendTab(tab) {
    document.querySelectorAll('#friendsTab .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#friendsTab .tab-content').forEach(t => t.classList.remove('active'));
    
    if (tab === 'current') {
        document.querySelector('#friendsTab .tab:first-child').classList.add('active');
        document.getElementById('currentFriends').classList.add('active');
    } else {
        document.querySelector('#friendsTab .tab:last-child').classList.add('active');
        document.getElementById('friendRequests').classList.add('active');
    }
}

// Utility Functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if (modalId === 'folderSelectModal') {
        selectedShareForFolder = null;
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Event Listeners
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
            if (modal.id === 'folderSelectModal') {
                selectedShareForFolder = null;
            }
        }
    });
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal');
        openModals.forEach(modal => {
            if (modal.style.display === 'block') {
                modal.style.display = 'none';
                if (modal.id === 'folderSelectModal') {
                    selectedShareForFolder = null;
                }
            }
        });
    }
});

// Initialize app
init();