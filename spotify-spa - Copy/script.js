window.addEventListener('DOMContentLoaded', () => {
  const getEl = (id) => document.getElementById(id);

  // Player options
  const audio = getEl('audio');
  const songTitle = getEl('title');
  const albumArt = document.querySelector('.user-photo');
  const playButton = getEl('play');
  const pauseButton = getEl('pause');
  const prevButton = getEl('prev');
  const nextButton = getEl('next');
  const progressBar = getEl('progressBar');
  const currentTimeEl = getEl('currentTime');
  const durationEl = getEl('duration');
  const volumeSlider = getEl('volumeSlider');
  const queueList = getEl('queueList');

  // Library 
  const songListContainer = getEl('songListContainer');
  const searchInput = getEl('searchInput');
  const playlistList = getEl('playlistList');
  const newPlaylistBtn = getEl('newPlaylistBtn');
  const playlistSelect = getEl('playlistSelect');

  // Upload Audio
  const uploadModal = getEl('uploadpopup');
  const closeUploadBtn = getEl('closemenubtn');
  const openUploadBtn = getEl('openmenubtn');
  const addSongBtn = getEl('addSongBtn');

  // Stat Page
  const statsBtn = getEl('statsBtn');
  const statsModal = getEl('statspopup');
  const closeStatsBtn = getEl('closestatsbtn');
  const statsContent = getEl('statsContent');

  // Preferences options
  const preferencesBtn = getEl('preferencesBtn');
  const preferencesPopup = getEl('preferencesPopup');
  const closePreferencesBtn = getEl('closePreferencesBtn');
  const themeSelect = getEl('themeSelect');
  const autoplayToggle = getEl('autoplayToggle');
  const confirmDeleteToggle = getEl('confirmDeleteToggle');
  const profileSwitchGroup = getEl('profileSwitchGroup');
  const profileSwitchLabel = getEl('profileSwitchLabel');
  const profileSelectRow = getEl('profileSelectRow');
  const profileAdminActions = getEl('profileAdminActions');
  const profileBasicActions = getEl('profileBasicActions');
  const profileStatus = getEl('profileStatus');
  const profileSelect = getEl('profileSelect');
  const switchProfileBtn = getEl('switchProfileBtn');
  const logoutBtn = getEl('logoutBtn');
  const deleteAccountBtn = getEl('deleteAccountBtn');
  const changePasswordBtn = getEl('changePasswordBtn');
  const switchAccountsBtn = getEl('switchAccountsBtn');
  const exportBackupBtn = getEl('exportBackupBtn');
  const importBackupBtn = getEl('importBackupBtn');
  const importBackupInput = getEl('importBackupInput');
  const resetDataBtn = getEl('resetDataBtn');

  // Playlist controls
  const newPlaylistPopup = getEl('newPlaylistPopup');
  const newPlaylistInput = getEl('newPlaylistInput');
  const createPlaylistBtn = getEl('createPlaylistBtn');
  const cancelNewPlaylistBtn = getEl('cancelNewPlaylistBtn');
  const closeNewPlaylistBtn = getEl('closeNewPlaylistBtn');
  const renamePlaylistPopup = getEl('renamePlaylistPopup');
  const renamePlaylistInput = getEl('renamePlaylistInput');
  const saveRenamePlaylistBtn = getEl('saveRenamePlaylistBtn');
  const cancelRenamePlaylistBtn = getEl('cancelRenamePlaylistBtn');
  const closeRenamePlaylistBtn = getEl('closeRenamePlaylistBtn');

  // Confirm popups
  const deleteConfirmPopup = getEl('deleteConfirmPopup');
  const closeDeleteConfirmBtn = getEl('closeDeleteConfirmBtn');
  const cancelDeleteBtn = getEl('cancelDeleteBtn');
  const confirmDeleteBtn = getEl('confirmDeleteBtn');
  const importConfirmTitle = getEl('importConfirmTitle');
  const importConfirmPopup = getEl('importConfirmPopup');
  const importConfirmMessage = getEl('importConfirmMessage');
  const closeImportConfirmBtn = getEl('closeImportConfirmBtn');
  const cancelImportBtn = getEl('cancelImportBtn');
  const confirmImportBtn = getEl('confirmImportBtn');

  const toastEl = getEl('toast');

  // constants
  const DB_NAME = 'SpotifyCloneDB';
  const DB_VERSION = 3;
  const hiddenClass = 'hidden';
  const PLAYLIST_LIKED = 'Liked Songs';
  const PLAYLIST_DEMOS = 'Demos';
  const ADMIN_ACCOUNT_NAME = 'admin';
  const PLAYCOUNT_STORAGE_PREFIX = 'musicmixer_playcount_';

  const onEvent = (el, event, handler) => {
    if (el) el.addEventListener(event, handler);
  };

  const showModal = (el) => {
    if (el) el.classList.remove(hiddenClass);
  };

  const hideModal = (el) => {
    if (el) el.classList.add(hiddenClass);
  };

  //This wil close the popup whe the user clicks out of the content
  const closeOnBackdropClick = (overlayEl, closeFn) => {
    if (!overlayEl) return;
    onEvent(overlayEl, 'click', (e) => {
      if (e.target === overlayEl) closeFn();
    });
  };

  // gets the preferred playlist on load, defaults to demos
  const getPreferredPlaylistId = (playlistRows) => {
    if (!Array.isArray(playlistRows) || !playlistRows.length) return null;
    const demoPlaylist = playlistRows.find((playlist) => playlist.name === PLAYLIST_DEMOS);
    return demoPlaylist ? demoPlaylist.id : playlistRows[0].id;
  };

  // closes the confirm popup and resolves the dialog
  const closeConfirmDialog = (result = false) => {
    hideModal(importConfirmPopup);
    const resolver = pendingConfirmResolve;
    pendingConfirmResolve = null;
    if (resolver) resolver(result);
  };

  // This will give the user a confirmation dialog and resolve a promise with their input
  const askConfirm = ({ title, message, confirmLabel = 'Confirm' }) => new Promise((resolve) => {
    if (!importConfirmPopup || !importConfirmMessage || !confirmImportBtn || !importConfirmTitle) {
      resolve(confirm(message));
      return;
    }

    //This will resolve a prior dialog if a new dialog is triggered, Defaults to false. 
    if (pendingConfirmResolve) {
      const previous = pendingConfirmResolve;
      pendingConfirmResolve = null;
      previous(false);
    }

    // show the confirmation dialog and store the resolver
    importConfirmTitle.textContent = title;
    importConfirmMessage.textContent = message;
    confirmImportBtn.textContent = confirmLabel;
    pendingConfirmResolve = resolve;
    showModal(importConfirmPopup);
  });

  // state variables
  let db, songs = [], currentIndex = -1, playlists = [], currentPlaylistId = null, playCount = {}, audioCache = {}, imageCache = {}, likedSongs = new Set(), renamePlaylistId = null, playlistToDelete = null, likedPlaylistId = null;
  let pendingConfirmResolve = null;
  let activeProfile = ADMIN_ACCOUNT_NAME;
  let currentSessionUser = null;
  let isMasterSession = false;
  let toastTimerId = null;
  let preferences = {
    theme: 'dark',
    autoPlayNext: true,
    confirmDelete: true
  };

  // Initialise IndexedDB
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  // This will create the database and object stores
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("songs")) {
      db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
    }
    if (!db.objectStoreNames.contains("playlists")) {
      db.createObjectStore("playlists", { keyPath: "id", autoIncrement: true }).createIndex("name_idx", "name", { unique: false });
    }
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "username" });
      }
    const songsStore = e.currentTarget.transaction.objectStore("songs");
    if (!songsStore.indexNames.contains("playlist_idx")) {
      songsStore.createIndex("playlist_idx", "playlistId", { unique: false });
    }
  };

  // This will run when the database is opened, it creates the admin account and then shows the login screen
  request.onsuccess = async (e) => {
    try {
      db = e.target.result;
      await ensureUsersDB();
      await ensureAdminAccount();

      setTimeout(() => {
        showLoginScreen();
      }, 2000);
    } catch (error) {
      console.error('Initialisation error:', error);
      hideLoadingScreen();
    }
  };
  // This will run if there is an error opening the database
  request.onerror = (e) => {
    showToast("Storage failed. Changes won't persist.");
    hideLoadingScreen();
  };
// This will ensure the users object store exists
  const ensureUsersDB = () => new Promise((resolve, reject) => {
    if (!db) return resolve();
    if (db.objectStoreNames.contains("users")) return resolve();

    const nextVersion = db.version + 1;
    db.close();
    const upgradeReq = indexedDB.open(DB_NAME, nextVersion);
    upgradeReq.onupgradeneeded = (evt) => {
      const upgradeDb = evt.target.result;
      if (!upgradeDb.objectStoreNames.contains("users")) {
        upgradeDb.createObjectStore("users", { keyPath: "username" });
      }
    };
    upgradeReq.onsuccess = (evt) => {
      db = evt.target.result;
      resolve();
    };
    upgradeReq.onerror = () => reject(upgradeReq.error);
  });

  // This will show the login/signup screen and hide the loading spinner
  function showLoginScreen() {
    const spinner = document.querySelector('.loading-spinner');
    const loadingContent = document.querySelector('.loading-content');
    const loginForm = document.getElementById('loginForm');
    
    if (spinner) {
      spinner.style.opacity = '0';
      setTimeout(() => {
        if (spinner) spinner.style.display = 'none';
      }, 300);
    }
    
    // This will slide up the loading content and fade in the login form
    setTimeout(() => {
      if (loadingContent) {
        loadingContent.classList.add('slide-up');
        loadingContent.classList.add('login-mode');
      }
    
      setTimeout(() => {
        if (loginForm) {
          loginForm.classList.remove('hidden');
          setTimeout(() => loginForm.classList.add('show'), 50);
        }
      }, 400);
    }, 300);
  }

  //This will create the default playlists and demos
  async function initialiseApp() {
    loadPreferences();
    loadPlayCount();
    applyTheme(preferences.theme);
    await ensureDefaultPlaylists();
    await loadDemos();
    await mergeDuplicates(activeProfile);
    await refreshLibrary();
    await refreshProfileUI();
    hideLoadingScreen();
  }

  // This will fade out the loading screen element
  function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        if (loadingScreen) loadingScreen.remove();
      }, 1000);
    }
  }

  // This will log out the current user and show the login screen
  function logoutCurrentSession() {
    hideModal(preferencesPopup);
    currentSessionUser = null;
    isMasterSession = false;
    activeProfile = ADMIN_ACCOUNT_NAME;
    showToast('Logging out...');
    setTimeout(() => window.location.reload(), 250);
  }

  // This will handle the signup, it will check for an existing username and creates a new user in the database if not found
  async function signup(username, password) {
    if (!username || !password) {
      return { success: false, message: "Username and password required" };
    }

    // This will ensure the users database exists before trying to add a user
    await ensureUsersDB();

    const existingUser = await getUser(username);
    if (existingUser) {
      return { success: false, message: "Username already exists" };
    }
    const createdId = await addRow("users", { username, password });
    if (!createdId) {
      return { success: false, message: "Failed to create account" };
    }
    return { success: true };
  }

  // This will handle the login, it will check for the user in the database and verify the password
  async function login(username, password) {
    if (!username || !password) {
      return { success: false, message: "Username and password required" };
    }

    await ensureUsersDB();
    
    const user = await getUser(username);
    if (!user) {
      return { success: false, message: "User not found" };
    }
    
    if (user.password !== password) {
      return { success: false, message: "Incorrect password" };
    }
    
    return { success: true };
  }

  // This will get a user from the database by username
  const getUser = (username) => new Promise((resolve) => {
    if (!db) return resolve(null);
    try {
      const req = db.transaction("users", "readonly").objectStore("users").get(username);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (err) {
      resolve(null);
    }
  });

  const ensureAdminAccount = async () => {
    const existing = await getUser(ADMIN_ACCOUNT_NAME);
    if (existing) return;
    await addRow('users', { username: ADMIN_ACCOUNT_NAME, password: ADMIN_ACCOUNT_NAME });
  };
  //this will create the event listeners for the login/signup tabs
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const loginPanel = document.getElementById('loginPanel');
  const signupPanel = document.getElementById('signupPanel');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const loginError = document.getElementById('loginError');
  const signupError = document.getElementById('signupError');

  if (loginTab) {
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('active');
      signupTab.classList.remove('active');
      loginPanel.classList.remove('hidden');
      signupPanel.classList.add('hidden');
      loginError.textContent = '';
    });
  }

  if (signupTab) {
    signupTab.addEventListener('click', () => {
      signupTab.classList.add('active');
      loginTab.classList.remove('active');
      signupPanel.classList.remove('hidden');
      loginPanel.classList.add('hidden');
      signupError.textContent = '';
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      loginError.textContent = '';

      try {
        const result = await login(username, password);
        if (result.success) {
          currentSessionUser = username;
          isMasterSession = username.toLowerCase() === ADMIN_ACCOUNT_NAME;
          activeProfile = username;
          try {
            await initialiseApp();
          } catch (initErr) {
            console.error('App init failed:', initErr);
            hideLoadingScreen();
          }
        } else {
          loginError.textContent = result.message;
        }
      } catch (err) {
        loginError.textContent = "Log in failed. Please try again.";
      }
    });
  }
// This will validate the input and attempt to create a new user
  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      const username = document.getElementById('signupUsername').value.trim();
      const password = document.getElementById('signupPassword').value;
      const confirm = document.getElementById('signupConfirm').value;
      
      if (password !== confirm) {
        signupError.textContent = "Passwords don't match";
        return;
      }
      
      const result = await signup(username, password);
      if (result.success) {
        signupError.textContent = '';
        showToast("Account created! Please log in.");
        loginTab.click();
        document.getElementById('loginUsername').value = username;
      } else {
        signupError.textContent = result.message;
      }
    });
  }
// This will allow the user to press enter to submit their login/signup info
  const bindEnter = (id, action) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') action();
    });
  };

  ['loginUsername', 'loginPassword'].forEach((id) => bindEnter(id, () => loginBtn.click()));
  ['signupUsername', 'signupPassword', 'signupConfirm'].forEach((id) => bindEnter(id, () => signupBtn.click()));

  // This will show a temporary toast message at the bottom of the screen
  const showToast = (msg, duration = 1800) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimerId) clearTimeout(toastTimerId);
    toastTimerId = setTimeout(() => {
      toastEl.classList.remove('show');
      toastTimerId = null;
    }, duration);
  };

  const getSongLikeId = (song) => song.originalSongId || song.id;

  // This will toggle the like status of a song byadding or removing it from the liked playlist
  function loadPreferences() {
    try {
      const raw = localStorage.getItem(`musicmixer_preferences_${activeProfile}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      preferences = {
        ...preferences,
        ...parsed
      };
    } catch (err) {

    }
  }

  // This will save the current preferences to localStorage
  function savePreferences() {
    localStorage.setItem(`musicmixer_preferences_${activeProfile}`, JSON.stringify(preferences));
  }

  function getPlayCountKey() {
    return `${PLAYCOUNT_STORAGE_PREFIX}${activeProfile}`;
  }

  function loadPlayCount() {
    try {
      const raw = localStorage.getItem(getPlayCountKey());
      playCount = raw ? JSON.parse(raw) : {};
    } catch (err) {
      playCount = {};
    }
  }

  // This will save the current play count to localStorage
  function savePlayCount() {
    localStorage.setItem(getPlayCountKey(), JSON.stringify(playCount));
  }

  const getRowOwner = (row) => {
    if (row && typeof row.owner === 'string' && row.owner.trim()) {
      return row.owner.trim();
    }
    return ADMIN_ACCOUNT_NAME;
  };

  // This will check if a given song or playlist belongs to a specific profile
  const isRowForProfile = (row, profileName) => getRowOwner(row) === profileName;
  const isRowForActiveProfile = (row) => getRowOwner(row) === activeProfile;

  const getPrefs = (profileName) => {
    try {
      const raw = localStorage.getItem(`musicmixer_preferences_${profileName}`);
      if (!raw) return { theme: 'dark', autoPlayNext: true, confirmDelete: true };
      const parsed = JSON.parse(raw);
      return {
        theme: 'dark',
        autoPlayNext: true,
        confirmDelete: true,
        ...parsed
      };
    } catch (err) {
      return { theme: 'dark', autoPlayNext: true, confirmDelete: true };
    }
  };

  const setPrefs = (profileName, nextPreferences) => {
    localStorage.setItem(`musicmixer_preferences_${profileName}`, JSON.stringify(nextPreferences));
  };

  const getPlayCount = (profileName) => {
    try {
      const raw = localStorage.getItem(`${PLAYCOUNT_STORAGE_PREFIX}${profileName}`);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  };

  const setPlayCount = (profileName, nextPlayCount) => {
    localStorage.setItem(`${PLAYCOUNT_STORAGE_PREFIX}${profileName}`, JSON.stringify(nextPlayCount));
  };

  // This will get all users from the database and return them as an array of usernames
  async function getAllUsers() {
    if (!db) return [];
    return new Promise((resolve) => {
      const users = [];
      const req = db.transaction('users', 'readonly').objectStore('users').openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          users.push(cursor.value.username);
          cursor.continue();
        } else {
          resolve(users.sort((a, b) => a.localeCompare(b)));
        }
      };
      req.onerror = () => resolve(users);
    });
  }

  //This allows the admin panel to only be seen by the admin
  function updateProfileButtons() {
    if (!profileSelect || !switchProfileBtn || !deleteAccountBtn || !changePasswordBtn) return;
    const selectedProfile = (profileSelect.value || '').trim().toLowerCase();
    const canManage = isMasterSession;

    switchProfileBtn.disabled = !canManage;
    deleteAccountBtn.disabled = !canManage || selectedProfile === ADMIN_ACCOUNT_NAME;
    changePasswordBtn.disabled = !canManage;
  }

  // This will delete a user account and all their data from the database
  async function deleteUserAccount(username) {
    if (!db || !username) return false;
    return new Promise((resolve) => {
      const tx = db.transaction('users', 'readwrite');
      tx.objectStore('users').delete(username);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  // This will change a users password in the database
  async function changePassword(username, newPassword) {
    if (!db || !username || !newPassword) return false;
    const existing = await getUser(username);
    if (!existing) return false;
    existing.password = newPassword;

    // This will update the user account with the new password
    return new Promise((resolve) => {
      const tx = db.transaction('users', 'readwrite');
      tx.objectStore('users').put(existing);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async function refreshProfileUI() {
    if (!profileSwitchGroup || !profileSelect || !switchProfileBtn || !profileStatus) return;

    const users = await getAllUsers();
    profileSelect.innerHTML = '';
    users.forEach((username) => {
      const opt = document.createElement('option');
      opt.value = username;
      opt.textContent = username;
      profileSelect.appendChild(opt);
    });

    if (!users.includes(activeProfile)) {
      const opt = document.createElement('option');
      opt.value = activeProfile;
      opt.textContent = activeProfile;
      profileSelect.appendChild(opt);
    }

    profileSelect.value = activeProfile;
    profileSwitchGroup.classList.remove(hiddenClass);
    const isAdminSession = !!isMasterSession;
    if (profileSwitchLabel) profileSwitchLabel.classList.toggle(hiddenClass, !isAdminSession);
    profileStatus.classList.toggle(hiddenClass, !isAdminSession);
    if (profileSelectRow) profileSelectRow.classList.toggle(hiddenClass, !isAdminSession);
    if (profileAdminActions) profileAdminActions.classList.toggle(hiddenClass, !isAdminSession);
    if (profileBasicActions) profileBasicActions.classList.toggle(hiddenClass, isAdminSession);
    profileSelect.disabled = !isMasterSession;
    updateProfileButtons();
    profileStatus.textContent = isMasterSession
      ? `Current profile: ${activeProfile}`
      : '';
  }

  // This will switch the active profile and reload all data for that profile
  async function switchActiveProfile(nextProfile) {
    if (!nextProfile || nextProfile === activeProfile) return;
    activeProfile = nextProfile;
    loadPreferences();
    loadPlayCount();
    applyTheme(preferences.theme);
    await ensureDefaultPlaylists();
    await loadDemos();
    await mergeDuplicates(activeProfile);
    await refreshLibrary();
    syncPreferenceUI();
    const snapshot = await makeStatsSummary();
    showStatsSummary(snapshot);
    await refreshProfileUI();
    showToast(`Switched to profile: ${activeProfile}`);
  }
//This will turn a blobl into a base64 url for easier storage into IndexedDB
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    if (!blob) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const base64ToBlob = (dataUrl) => {
    if (!dataUrl) return null;
    const [meta, base64Data] = dataUrl.split(',');
    const mimeMatch = /data:(.*?);base64/.exec(meta || '');
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(base64Data || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const createPlaceholderAudioBlob = () => new Blob([], { type: 'audio/mpeg' });

  function applyTheme(theme) {
    document.body.classList.toggle('light-mode', theme === 'light');
  }

  // This will update the preferences based on the UI and save them
  function syncPreferenceUI() {
    if (themeSelect) themeSelect.value = preferences.theme;
    if (autoplayToggle) autoplayToggle.checked = !!preferences.autoPlayNext;
    if (confirmDeleteToggle) confirmDeleteToggle.checked = !!preferences.confirmDelete;
  }

  async function refreshLiked() {
    likedSongs = new Set();
    const likedPlaylist = await findPlaylistByName(PLAYLIST_LIKED);
    likedPlaylistId = likedPlaylist ? likedPlaylist.id : null;
    if (!db || !likedPlaylistId) return;

    await new Promise((resolve) => {
      const req = db.transaction("songs", "readonly").objectStore("songs").index("playlist_idx").openCursor(IDBKeyRange.only(likedPlaylistId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          likedSongs.add(cursor.value.originalSongId || cursor.value.id);
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
  }

  const removeLikedSong = (likedId) => new Promise((resolve) => {
    if (!db || !likedPlaylistId) return resolve(false);
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    const req = store.index("playlist_idx").openCursor(IDBKeyRange.only(likedPlaylistId));
    let deleted = false;

    // This will loop through the liked playlist songs and delete the one that matches the likedId
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const rowLikeId = cursor.value.originalSongId || cursor.value.id;
        if (rowLikeId === likedId && !deleted) {
          deleted = true;
          store.delete(cursor.primaryKey);
          return;
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deleted);
    tx.onerror = () => resolve(false);
  });

  //This will play a song by its index in the song array
  const playSong = (index) => {
    const song = songs[index];
    if (!song) return;
    audio.src = song.audioURL;
    albumArt.src = song.imageURL || "album.jpg";
    songTitle.textContent = song.name;
    playCount[song.id] = (playCount[song.id] || 0) + 1;
    savePlayCount();
    audio.play();
    currentIndex = index;
    updateQueueView();
  };

  //This will render a song in the song list with its name/like button/delete button
  function renderSong(songObj) {
    const row = document.createElement('div');
    row.className = 'song';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'song-name';
    nameSpan.textContent = songObj.name;

    const heartBtn = document.createElement('button');
    heartBtn.className = 'heart-btn';
    const likedId = getSongLikeId(songObj);
    const isLiked = likedSongs.has(likedId);
    heartBtn.classList.toggle('liked', isLiked);
    heartBtn.textContent = '✓';
    heartBtn.title = isLiked ? 'Liked' : 'Not liked';
    heartBtn.onclick = async (e) => {
      e.stopPropagation();
      await toggleLike(songObj);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = "×";
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = "Delete song";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (!preferences.confirmDelete || confirm(`Delete "${songObj.name}" from this playlist?`)) deleteSong(songObj.id);
    };

    row.append(nameSpan, heartBtn, deleteBtn);
    row.onclick = () => playSong(songs.findIndex(s => s.id === songObj.id));
    songListContainer.appendChild(row);
  }

  //This will toggle the like status of a song by adding it or removing it from the liked playlist
  async function toggleLike(songObj) {
    const likedPlaylist = await findPlaylistByName(PLAYLIST_LIKED);
    likedPlaylistId = likedPlaylist ? likedPlaylist.id : null;
    if (!likedPlaylistId) return;

    const likedId = getSongLikeId(songObj);

    if (likedSongs.has(likedId)) {
      await removeLikedSong(likedId);
      likedSongs.delete(likedId);
      showToast(`Removed from ${PLAYLIST_LIKED}`, 3000);
    } else {
      const sourceId = songObj.originalSongId || songObj.id;
      const audioBlob = audioCache[songObj.id];
      if (!audioBlob) {
        showToast("Could not like this song right now.");
        return;
      }
      likedSongs.add(likedId);
      await addRow("songs", {
        name: songObj.name,
        audioBlob,
        imageBlob: imageCache[songObj.id] || null,
        playlistId: likedPlaylistId,
        owner: activeProfile,
        originalSongId: sourceId
      });
      showToast(`Added to ${PLAYLIST_LIKED}`, 3000);
    }

    if (currentPlaylistId === likedPlaylistId) {
      await loadCurrentSongs();
    } else {
      rebuildSongUI();
    }
    await loadPlaylists();
    await renderPlaylists();
  }

  //This will save a new song to the database
  function saveSong(name, audioBlob, imageBlob, playlistId) {
    if (!db) return alert("Storage not ready yet. Please wait a moment and try again.");
    const tx = db.transaction("songs", "readwrite");
    tx.objectStore("songs").add({ name, audioBlob, imageBlob, playlistId, owner: activeProfile });
    tx.oncomplete = async () => {
      showToast("Song added");
      await loadSongs(playlistId);
      if (playlistId === currentPlaylistId) rebuildSongUI();
    };
  }

  async function loadCurrentSongs() {
    if (!currentPlaylistId) {
      songs = [];
      currentIndex = -1;
      rebuildSongUI();
      return;
    }
    await loadSongs(currentPlaylistId);
    rebuildSongUI();
  }

  async function loadSongs(playlistId) {
    songs.forEach((song) => {
      if (song.audioURL) URL.revokeObjectURL(song.audioURL);
      if (song.imageURL) URL.revokeObjectURL(song.imageURL);
    });
    songs = [];
    if (!db) return;
    return new Promise((resolve) => {
      const req = db.transaction("songs", "readonly").objectStore("songs").index("playlist_idx").openCursor(IDBKeyRange.only(playlistId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const row = cursor.value;
          if (isRowForActiveProfile(row)) {
            const { id, name, audioBlob, imageBlob, playlistId: pid, originalSongId } = row;
            const resolvedAudioBlob = audioBlob || createPlaceholderAudioBlob();
            const audioURL = URL.createObjectURL(resolvedAudioBlob);
            audioCache[id] = resolvedAudioBlob;
            imageCache[id] = imageBlob || null;
            songs.push({ id, name, audioURL, imageURL: imageBlob ? URL.createObjectURL(imageBlob) : null, playlistId: pid, originalSongId: originalSongId || null });
          }
          cursor.continue();
        } else {
          currentIndex = songs.length ? 0 : -1;
          resolve();
        }
      };
      req.onerror = () => {
        currentIndex = -1;
        resolve();
      };
    });
  }

  // This will clear the current song list
  function rebuildSongUI() {
    songListContainer.innerHTML = "";
    if (!songs.length) {
      const empty = document.createElement('div');
      empty.className = 'song';
      empty.textContent = "No songs in this playlist yet.";
      songListContainer.appendChild(empty);
    } else songs.forEach(renderSong);
    updateStats();
    updateQueueView();
  }

  //This will find a playlist by its name
  function updateStats() {
    const totalSongsEl = document.getElementById('totalSongs');
    const totalPlaylistsEl = document.getElementById('totalPlaylists');
    if (totalSongsEl) totalSongsEl.textContent = songs.length;
    if (totalPlaylistsEl) totalPlaylistsEl.textContent = playlists.length;
  }

  function updateQueueView() {
    queueList.innerHTML = '';
    if (currentIndex < songs.length - 1) {
      const nextSong = songs[currentIndex + 1];
      const item = document.createElement('div');
      item.className = 'queue-item';
      item.textContent = nextSong.name;
      queueList.appendChild(item);
    } else {
      const item = document.createElement('div');
      item.className = 'queue-item';
      item.textContent = 'No more songs';
      queueList.appendChild(item);
    }
  }

  //This will filter the songs in the current playlist based on the search query
  function filterSongs(query) {
    songListContainer.innerHTML = "";
    const q = query.toLowerCase();
    const filteredSongs = songs.filter(s => s.name.toLowerCase().includes(q));
    if (!filteredSongs.length) {
      const empty = document.createElement('div');
      empty.className = 'song';
      empty.textContent = "No songs found.";
      songListContainer.appendChild(empty);
    } else filteredSongs.forEach(renderSong);
  }

  searchInput.addEventListener('input', (e) => filterSongs(e.target.value));

  // This will delete a song from the database by its id
  function deleteSong(id) {
    if (!db) return;
    const tx = db.transaction("songs", "readwrite");
    tx.objectStore("songs").delete(id);
    tx.oncomplete = async () => {
      await refreshLiked();
      showToast("Song deleted");
      await loadCurrentSongs();
    };
  }

  async function loadPlaylists() {
    playlists = [];
    if (!db) return;
    return new Promise((resolve) => {
      db.transaction("playlists", "readonly").objectStore("playlists").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (isRowForActiveProfile(cursor.value)) {
            playlists.push({ id: cursor.value.id, name: cursor.value.name });
          }
          cursor.continue();
        } else {
          const likedPlaylist = playlists.find((p) => p.name === PLAYLIST_LIKED);
          likedPlaylistId = likedPlaylist ? likedPlaylist.id : null;
          resolve();
        }
      };
    });
  }

  // This will add a new playlist to the database by the users chossen name
  function createPlaylist(name) {
    if (!name || !db) return;
    const req = db.transaction("playlists", "readwrite").objectStore("playlists").add({
      name,
      owner: activeProfile
    });
    req.onsuccess = async (e) => {
      currentPlaylistId = e.target.result;
      showToast("Playlist created");
      await refreshLibrary({ focusPlaylistId: currentPlaylistId });
    };
  }

  //This will force a confirmation popup on the users screen to confirm if they want to delete the playlist
  function deletePlaylist(id) {
    if (!db) return;
    playlistToDelete = id;
    showModal(deleteConfirmPopup);
  }

  // This will delete the playlist from the database along with all songs that belong to that playlist
  const performDelete = () => {
    if (!playlistToDelete || !db) return;
    const id = playlistToDelete;
    const tx = db.transaction(["playlists", "songs"], "readwrite");
    const ps = tx.objectStore("playlists");
    const ss = tx.objectStore("songs");
    ps.delete(id);
    ss.index("playlist_idx").openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (isRowForActiveProfile(cursor.value)) {
          ss.delete(cursor.primaryKey);
        }
        cursor.continue();
      }
    };
    tx.oncomplete = async () => {
      showToast("Playlist deleted");
      if (currentPlaylistId === id) currentPlaylistId = null;
      await refreshLibrary();
      hideModal(deleteConfirmPopup);
      playlistToDelete = null;
    };
  };

  //This will rename a playlist by its id to the new name provided by the user
  function renamePlaylist(id, newName) {
    if (!db || !newName) return;
    const store = db.transaction("playlists", "readwrite").objectStore("playlists");
    store.get(id).onsuccess = (e) => {
      const obj = e.target.result;
      if (!obj) return;
      obj.name = newName;
      store.put(obj).onsuccess = async () => {
        showToast("Playlist renamed");
        await refreshLibrary({ focusPlaylistId: currentPlaylistId });
      };
    };
  }

  async function renderPlaylists() {
    playlistList.innerHTML = "";
    if (!playlists.length) {
      const empty = document.createElement('div');
      empty.className = 'playlist';
      empty.textContent = "No playlists yet.";
      playlistList.appendChild(empty);
      updateStats();
      return;
    }
    playlists.forEach(p => {
      const item = document.createElement('div');
      item.className = 'playlist';
      item.textContent = p.name;
      const isProtectedPlaylist = p.name === PLAYLIST_LIKED;
      if (p.id === currentPlaylistId) {
        item.classList.add('active');
      }
      item.onclick = async () => {
        document.querySelectorAll('.playlist').forEach(pl => pl.classList.remove('active'));
        item.classList.add('active');
        currentPlaylistId = p.id;
        await loadCurrentSongs();
      };

      //This will add the rename and delete buttons to the playlist item if it's not a protected playlist
      if (!isProtectedPlaylist) {
        const actions = document.createElement('div');
        actions.className = 'playlist-actions';

        const renameBtn = document.createElement('button');
        renameBtn.textContent = "↻";
        renameBtn.className = 'btn';
        renameBtn.onclick = (e) => {
          e.stopPropagation();
          renamePlaylistId = p.id;
          renamePlaylistInput.value = p.name;
          showModal(renamePlaylistPopup);
          setTimeout(() => renamePlaylistInput.select(), 100);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = "×";
        deleteBtn.className = 'btn';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          deletePlaylist(p.id);
        };

        actions.append(renameBtn, deleteBtn);
        item.appendChild(actions);
      }

      playlistList.appendChild(item);
    });
    updateStats();
  }

  function populatePlaylistSelect() {
    playlistSelect.innerHTML = "";
    playlists.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      playlistSelect.appendChild(opt);
    });
    if (currentPlaylistId) playlistSelect.value = currentPlaylistId;
  }

  // This will check if the default playlists exist for the user and create them if they dont
  async function ensureDefaultPlaylists() {
    const libraryExists = await findPlaylistByName('My Library');
    if (!libraryExists) {
      await addRow("playlists", { name: "My Library", owner: activeProfile });
    }

    const demosExists = await findPlaylistByName(PLAYLIST_DEMOS);
    if (!demosExists) {
      await addRow("playlists", { name: PLAYLIST_DEMOS, owner: activeProfile });
    }

    const likedExists = await findPlaylistByName(PLAYLIST_LIKED);
    if (!likedExists) {
      await addRow("playlists", { name: PLAYLIST_LIKED, owner: activeProfile });
    }
  }

  //This will load the demo songs into the demos playlist if it's empty.
  async function loadDemos() {
    const demosPlaylists = await getPlaylistsNamed(PLAYLIST_DEMOS);
    if (!demosPlaylists.length) return;

    const demoCounts = await Promise.all(demosPlaylists.map((playlist) => countPlaylistSongs(playlist.id)));
    if (demoCounts.some((count) => count > 0)) return;

    const demosPlaylist = demosPlaylists[0];

    const demos = [
      { name: "Wiz Khalifa - Black and Yellow", audioPath: "songs/song1.mp3", imagePath: "albums/song1.jpg" },
      { name: "Kendrick Lamar - Not Like Us", audioPath: "songs/song2.mp3", imagePath: "albums/song2.png" },
      { name: "Kendrick Lamar - Swimming Pools", audioPath: "songs/song3.mp3", imagePath: "albums/song3.jpg" },
      { name: "J. Cole - No Role Modelz", audioPath: "songs/song4.mp3", imagePath: "albums/song4.jpg" },
      { name: "50 Cent - In Da Club", audioPath: "songs/song5.mp3", imagePath: "albums/song5.jpg" },
      { name: "Chief Keef - Love Sosa", audioPath: "songs/song6.mp3", imagePath: "albums/song6.jpg" },
      { name: "Fetty Wap - Trap Queen", audioPath: "songs/song7.mp3", imagePath: "albums/song7.jpg" },
      { name: "A$AP Rocky - Fuckin' Problems", audioPath: "songs/song8.mp3", imagePath: "albums/song8.jpg" },
      { name: "Jay-Z - Ni**as in Paris", audioPath: "songs/song9.mp3", imagePath: "albums/song9.jpg" }
    ];

    for (const d of demos) {
      try {
        const audioRes = await fetch(d.audioPath);
        if (!audioRes.ok) continue;
        const audioBlob = await audioRes.blob();
        let imageBlob = null;
        if (d.imagePath) {
          const imgRes = await fetch(d.imagePath);
          if (imgRes.ok) imageBlob = await imgRes.blob();
        }
        await addRow("songs", {
          name: d.name,
          audioBlob,
          imageBlob,
          playlistId: demosPlaylist.id,
          owner: activeProfile
        });
      } catch (err) {}
    }
  }

  const countRows = (storeName) => new Promise((resolve) => {
    const req = db.transaction(storeName, "readonly").objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => resolve(0);
  });

  const addRow = (storeName, obj) => new Promise((resolve) => {
    const req = db.transaction(storeName, "readwrite").objectStore(storeName).add(obj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  const findPlaylistByName = (name) => new Promise((resolve) => {
    const req = db.transaction("playlists", "readonly").objectStore("playlists").openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return resolve(null);
      if (cursor.value.name === name && isRowForActiveProfile(cursor.value)) return resolve(cursor.value);
      cursor.continue();
    };
    req.onerror = () => resolve(null);
  });

  const countPlaylistSongs = (playlistId) => new Promise((resolve) => {
    let count = 0;
    const req = db.transaction("songs", "readonly").objectStore("songs").index("playlist_idx").openCursor(IDBKeyRange.only(playlistId));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (isRowForActiveProfile(cursor.value)) {
          count += 1;
        }
        cursor.continue();
      } else {
        resolve(count);
      }
    };
    req.onerror = () => resolve(count);
  });

  const getAllSongs = () => new Promise((resolve) => {
    const allSongs = [];
    const playlistIds = new Set(playlists.map((playlist) => playlist.id));
    const req = db.transaction("songs", "readonly").objectStore("songs").openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (playlistIds.has(cursor.value.playlistId)) {
          allSongs.push({ id: cursor.value.id, name: cursor.value.name, playlistId: cursor.value.playlistId });
        }
        cursor.continue();
      } else {
        resolve(allSongs);
      }
    };
    req.onerror = () => resolve(allSongs);
  });

  const makeStatsSummary = async () => {
    const allSongs = await getAllSongs();
    const playCounts = allSongs.map((song) => ({
      id: song.id,
      name: song.name,
      playlistId: song.playlistId,
      plays: Math.max(0, Number(playCount[song.id] || 0))
    }));

    const totalPlays = playCounts.reduce((sum, song) => sum + song.plays, 0);
    const mostPlayed = [...playCounts]
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5)
      .map((song) => ({
        id: song.id,
        name: song.name,
        playlistId: song.playlistId,
        plays: song.plays
      }));

    return {
      exportedAt: new Date().toISOString(),
      totals: {
        songs: allSongs.length,
        playlists: playlists.length,
        plays: totalPlays
      },
      playCounts,
      mostPlayed
    };
  };

  const parseStats = (rawData) => {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
      throw new Error('Invalid JSON structure.');
    }

    const sourceList = Array.isArray(rawData.playCounts)
      ? rawData.playCounts
      : (Array.isArray(rawData.mostPlayed) ? rawData.mostPlayed : []);

    if (!sourceList.length) {
      throw new Error('No playable stats entries found.');
    }

    const normalised = sourceList
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const hasId = Number.isFinite(Number(entry.id));
        const hasName = typeof entry.name === 'string' && entry.name.trim().length > 0;
        const plays = Number(entry.plays);
        if ((!hasId && !hasName) || !Number.isFinite(plays) || plays < 0) return null;
        return {
          id: hasId ? Number(entry.id) : null,
          name: hasName ? entry.name.trim() : null,
          plays: Math.floor(plays)
        };
      })
      .filter(Boolean);

    if (!normalised.length) {
      throw new Error('No valid stats entries to import.');
    }

    return normalised;
  };

  const applyStats = async (entries) => {
    const allSongs = await getAllSongs();
    const songsById = new Map(allSongs.map((song) => [song.id, song]));
    const songsByName = new Map();

    allSongs.forEach((song) => {
      const key = (song.name || '').trim().toLowerCase();
      if (key && !songsByName.has(key)) songsByName.set(key, song);
    });

    const nextPlayCount = { ...playCount };
    let matched = 0;

    entries.forEach((entry) => {
      let targetSong = null;
      if (entry.id !== null && songsById.has(entry.id)) {
        targetSong = songsById.get(entry.id);
      } else if (entry.name) {
        const key = entry.name.toLowerCase();
        if (songsByName.has(key)) targetSong = songsByName.get(key);
      }

      if (targetSong) {
        nextPlayCount[targetSong.id] = entry.plays;
        matched += 1;
      }
    });

    if (!matched) {
      throw new Error('Imported file did not match any songs in your library.');
    }

    playCount = nextPlayCount;
    savePlayCount();
    return matched;
  };

  const countMatches = async (entries) => {
    const allSongs = await getAllSongs();
    const ids = new Set(allSongs.map((song) => song.id));
    const names = new Set(allSongs.map((song) => (song.name || '').trim().toLowerCase()).filter(Boolean));
    let matches = 0;

    entries.forEach((entry) => {
      if (entry.id !== null && ids.has(entry.id)) {
        matches += 1;
        return;
      }
      if (entry.name && names.has(entry.name.toLowerCase())) {
        matches += 1;
      }
    });

    return matches;
  };

  const showStatsSummary = (snapshot) => {
    statsContent.innerHTML = `
      <div><strong>Total Songs:</strong> ${snapshot.totals.songs}</div>
      <div><strong>Total Playlists:</strong> ${snapshot.totals.playlists}</div>
      <div><strong>Total Plays:</strong> ${snapshot.totals.plays}</div>
    `;

    if (snapshot.mostPlayed.length) {
      statsContent.innerHTML += "<div class='stats-section-title'><strong>Most Played:</strong></div>";
      snapshot.mostPlayed.forEach((song) => {
        statsContent.innerHTML += `<div class='stats-most-played-item'>${song.name} (${song.plays} plays)</div>`;
      });
    }
  };

  const exportStats = async () => {
    const snapshot = await makeStatsSummary();
    const exportData = {
      app: "MusicMixer",
      ...snapshot
    };
    const statsJson = JSON.stringify(exportData, null, 2);
    const blob = new Blob([statsJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const link = document.createElement('a');
    link.href = url;
    link.download = `musicmixer-stats-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const getAllRows = (storeName) => new Promise((resolve) => {
    const rows = [];
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        rows.push(cursor.value);
        cursor.continue();
      } else {
        resolve(rows);
      }
    };
    req.onerror = () => resolve(rows);
  });

  const getPlaylistsNamed = async (name, profileName = activeProfile) => {
    const rows = await getAllRows('playlists');
    return rows.filter((row) => row.name === name && isRowForProfile(row, profileName));
  };

  const moveSongsToPlaylist = (fromPlaylistIds, toPlaylistId) => new Promise((resolve) => {
    if (!db || !fromPlaylistIds.size) return resolve(true);
    const tx = db.transaction('songs', 'readwrite');
    const store = tx.objectStore('songs');
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (fromPlaylistIds.has(cursor.value.playlistId)) {
          cursor.update({ ...cursor.value, playlistId: toPlaylistId });
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });

  const deletePlaylistsById = (playlistIds) => new Promise((resolve) => {
    if (!db || !playlistIds.size) return resolve(true);
    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (playlistIds.has(cursor.value.id)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });

  const mergeDuplicates = async (profileName = activeProfile) => {
    for (const playlistName of ["My Library", PLAYLIST_DEMOS, PLAYLIST_LIKED]) {
      const matches = (await getPlaylistsNamed(playlistName, profileName)).sort((a, b) => a.id - b.id);
      if (matches.length < 2) continue;

      const keptPlaylist = matches[0];
      const duplicateIds = new Set(matches.slice(1).map((row) => row.id));
      await moveSongsToPlaylist(duplicateIds, keptPlaylist.id);
      await deletePlaylistsById(duplicateIds);
    }
  };

  const refreshLibrary = async ({ focusPlaylistId = null } = {}) => {
    await loadPlaylists();
    await refreshLiked();

    const hasFocusPlaylist = focusPlaylistId !== null && playlists.some((playlist) => playlist.id === focusPlaylistId);
    const hasCurrentPlaylist = currentPlaylistId !== null && playlists.some((playlist) => playlist.id === currentPlaylistId);

    if (hasFocusPlaylist) {
      currentPlaylistId = focusPlaylistId;
    } else if (!hasCurrentPlaylist) {
      currentPlaylistId = getPreferredPlaylistId(playlists);
    }

    await renderPlaylists();
    await loadCurrentSongs();
    populatePlaylistSelect();
  };

  const clearStore = (storeName) => new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });

  const buildBackup = async (profileName) => {
    const playlistsRows = (await getAllRows('playlists')).filter((row) => isRowForProfile(row, profileName));
    const playlistIds = new Set(playlistsRows.map((row) => row.id));
    const songsRows = (await getAllRows('songs')).filter((row) => playlistIds.has(row.playlistId));

    const serialisedSongs = songsRows.map((song) => ({
      id: song.id,
      name: song.name,
      playlistId: song.playlistId,
      originalSongId: song.originalSongId || null,
      owner: song.owner || profileName
    }));

    return {
      profile: profileName,
      preferences: getPrefs(profileName),
      playCount: getPlayCount(profileName),
      playlists: playlistsRows,
      songs: serialisedSongs
    };
  };

  const downloadFile = (dataObj, fileName) => {
    const backupJson = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const saveFile = async (dataObj, fileName) => {
    downloadFile(dataObj, fileName);
    return true;
  };

  const exportBackup = async (profileName = activeProfile) => {
    const payload = await buildBackup(profileName);
    const backup = {
      app: 'MusicMixer',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...payload
    };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return saveFile(backup, `musicmixer-backup-${profileName}-${timestamp}.json`);
  };

  const exportAllBackups = async () => {
    const users = await getAllUsers();
    const profiles = [];
    for (const username of users) {
      profiles.push(await buildBackup(username));
    }

    const backup = {
      app: 'MusicMixer',
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      scope: 'all-accounts',
      profiles
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return saveFile(backup, `musicmixer-backup-all-accounts-${timestamp}.json`);
  };

  const clearProfileSongs = async (profileName, options = {}) => {
    const { preserveDemoPlaylist = false } = options;
    const profilePlaylists = (await getAllRows('playlists')).filter((row) => isRowForProfile(row, profileName));
    const profilePlaylistIds = new Set(profilePlaylists.map((row) => row.id));
    const protectedPlaylistIds = new Set();

    if (preserveDemoPlaylist) {
      profilePlaylists.forEach((playlist) => {
        if (playlist.name === PLAYLIST_DEMOS) {
          protectedPlaylistIds.add(playlist.id);
        }
      });
    }

    await new Promise((resolve) => {
      const tx = db.transaction('songs', 'readwrite');
      const req = tx.objectStore('songs').openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (
            !protectedPlaylistIds.has(cursor.value.playlistId) &&
            (profilePlaylistIds.has(cursor.value.playlistId) || isRowForProfile(cursor.value, profileName))
          ) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });

    await new Promise((resolve) => {
      const tx = db.transaction('playlists', 'readwrite');
      const req = tx.objectStore('playlists').openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (preserveDemoPlaylist && cursor.value.name === PLAYLIST_DEMOS && isRowForProfile(cursor.value, profileName)) {
            cursor.continue();
            return;
          }

          if (isRowForProfile(cursor.value, profileName)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  };

  const applyProfileBackupPayload = async (payload, targetProfile) => {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid backup payload.');
    if (!Array.isArray(payload.playlists) || !Array.isArray(payload.songs)) {
      throw new Error('Backup payload is missing playlists or songs.');
    }

    await clearProfileSongs(targetProfile, { preserveDemoPlaylist: true });

    const playlistMap = new Map();
    for (const playlist of payload.playlists) {
      const createdId = await addRow('playlists', { name: playlist.name, owner: targetProfile });
      playlistMap.set(playlist.id, createdId);
    }

    const songIdMap = new Map();
    for (const song of payload.songs) {
      const mappedPlaylistId = playlistMap.get(song.playlistId) || playlistMap.values().next().value || currentPlaylistId;
      const createdSongId = await addRow('songs', {
        name: song.name,
        audioBlob: song.audioBlob ? base64ToBlob(song.audioBlob) : createPlaceholderAudioBlob(),
        imageBlob: song.imageBlob ? base64ToBlob(song.imageBlob) : null,
        playlistId: mappedPlaylistId,
        owner: targetProfile,
        originalSongId: song.originalSongId || null
      });
      songIdMap.set(String(song.id), createdSongId);
    }

    const nextPreferences = payload.preferences && typeof payload.preferences === 'object'
      ? {
        theme: 'dark',
        autoPlayNext: true,
        confirmDelete: true,
        ...payload.preferences
      }
      : { theme: 'dark', autoPlayNext: true, confirmDelete: true };
    setPrefs(targetProfile, nextPreferences);

    const remappedPlayCount = {};
    if (payload.playCount && typeof payload.playCount === 'object') { 
      Object.entries(payload.playCount).forEach(([oldId, plays]) => {
        const mappedId = songIdMap.get(String(oldId));
        if (mappedId !== undefined) {
          remappedPlayCount[mappedId] = Number(plays) || 0;
        }
      });
    }
    setPlayCount(targetProfile, remappedPlayCount);

    if (targetProfile === activeProfile) {
      preferences = nextPreferences;
      playCount = remappedPlayCount;
      savePreferences();
      savePlayCount();
      applyTheme(preferences.theme);
      syncPreferenceUI();
    }
  };

  const importFullBackupFromJson = async (rawText, targetProfile = activeProfile) => {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup file.');

    let payload = parsed;
    if (Array.isArray(parsed.profiles)) {
      payload = parsed.profiles.find((entry) => entry && entry.profile === targetProfile) || null;
      if (!payload) {
        throw new Error(`Backup file has no data for account "${targetProfile}".`);
      }
    }

    await applyProfileBackupPayload(payload, targetProfile);

    await mergeDuplicates(targetProfile);
    await refreshLibrary();
  };

  const importAllBackupsFromJson = async (rawText) => {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.profiles)) {
      throw new Error('This file is not an all-accounts backup.');
    }

    const users = await getAllUsers();
    const userSet = new Set(users);
    const importedProfiles = [];
    let importedCount = 0;

    for (const entry of parsed.profiles) {
      if (!entry || typeof entry !== 'object' || typeof entry.profile !== 'string') continue;
      if (!userSet.has(entry.profile)) continue;
      await applyProfileBackupPayload(entry, entry.profile);
      importedProfiles.push(entry.profile);
      importedCount += 1;
    }

    if (!importedCount) {
      throw new Error('No matching accounts found in this backup.');
    }

    for (const profileName of importedProfiles) {
      await mergeDuplicates(profileName);
    }
    await refreshLibrary();
    return importedCount;
  };

  const resetCurrentData = async () => {
    await clearProfileSongs(activeProfile, { preserveDemoPlaylist: true });

    playCount = {};
    savePlayCount();
    preferences = {
      theme: 'dark',
      autoPlayNext: true,
      confirmDelete: true
    };
    savePreferences();
    applyTheme(preferences.theme);
    syncPreferenceUI();
    await ensureDefaultPlaylists();
    await loadDemos();
    await mergeDuplicates(activeProfile);
    await refreshLibrary();
  };

  addSongBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('songNameInput');
    const fileInput = document.getElementById('songFileInput');
    const imageInput = document.getElementById('songImageInput');
    const selectedPlaylistId = Number(playlistSelect.value || currentPlaylistId);

    if (!nameInput.value || !fileInput.files.length) return alert("Please enter a name and select an audio file.");
    if (!selectedPlaylistId) return alert("Please select a playlist.");

    saveSong(nameInput.value.trim(), fileInput.files[0], imageInput.files[0] || null, selectedPlaylistId);
    nameInput.value = fileInput.value = imageInput.value = "";
    hideModal(uploadModal);
  });

  playButton.addEventListener('click', () => {
    if (audio.src && audio.paused) audio.play();
  });

  pauseButton.addEventListener('click', () => {
    if (audio.src && !audio.paused) audio.pause();
  });

  prevButton.addEventListener('click', () => {
    if (currentIndex > 0) playSong(currentIndex - 1);
  });

  const playNext = () => {
    if (!songs.length) return;
    if (currentIndex < songs.length - 1) {
      playSong(currentIndex + 1);
    }
  };

  nextButton.addEventListener('click', playNext);
  
  audio.addEventListener('ended', () => {
    if (preferences.autoPlayNext) playNext();
  });
 
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      progressBar.value = (audio.currentTime / audio.duration) * 100;
      currentTimeEl.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
  });

  progressBar.addEventListener('input', () => {
    audio.currentTime = (progressBar.value / 100) * audio.duration;
  });

  volumeSlider.addEventListener('input', () => {
    audio.volume = volumeSlider.value / 100;
  });
  audio.volume = 0.7;

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      playButton.click();
    } else if (e.code === 'ArrowRight') {
      nextButton.click();
    } else if (e.code === 'ArrowLeft') {
      prevButton.click();
    }
  });

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  };

  onEvent(openUploadBtn, 'click', () => {
    populatePlaylistSelect();
    showModal(uploadModal);
  });
  onEvent(closeUploadBtn, 'click', () => hideModal(uploadModal));
  closeOnBackdropClick(uploadModal, () => hideModal(uploadModal));

  onEvent(statsBtn, 'click', async () => {
    const snapshot = await makeStatsSummary();
    showStatsSummary(snapshot);
    showModal(statsModal);
  });

  onEvent(closeStatsBtn, 'click', () => hideModal(statsModal));
  closeOnBackdropClick(statsModal, () => hideModal(statsModal));

  onEvent(preferencesBtn, 'click', () => {
    syncPreferenceUI();
    refreshProfileUI();
    showModal(preferencesPopup);
  });

  onEvent(closePreferencesBtn, 'click', () => hideModal(preferencesPopup));
  closeOnBackdropClick(preferencesPopup, () => hideModal(preferencesPopup));

  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      preferences.theme = themeSelect.value === 'light' ? 'light' : 'dark';
      savePreferences();
      applyTheme(preferences.theme);
      showToast(`Theme set to ${preferences.theme}.`);
    });
  }

  if (autoplayToggle) {
    autoplayToggle.addEventListener('change', () => {
      preferences.autoPlayNext = autoplayToggle.checked;
      savePreferences();
    });
  }

  if (confirmDeleteToggle) {
    confirmDeleteToggle.addEventListener('change', () => {
      preferences.confirmDelete = confirmDeleteToggle.checked;
      savePreferences();
    });
  }

  onEvent(exportBackupBtn, 'click', async () => {
    try {
      const saved = await exportBackup(activeProfile);
      if (saved) showToast('Backup exported as JSON');
    } catch (err) {
      showToast('Failed to export backup');
    }
  });

  onEvent(importBackupBtn, 'click', () => {
    if (importBackupInput) importBackupInput.click();
  });

  onEvent(importBackupInput, 'change', async () => {
    const file = importBackupInput.files && importBackupInput.files[0];
    if (!file) return;

    try {
      const rawText = await file.text();
      if (!isMasterSession) {
        const approved = await askConfirm({
          title: 'Import Backup',
          message: 'Import backup and overwrite current account songs/playlists?',
          confirmLabel: 'Import'
        });
        if (!approved) {
          return;
        }
        await importFullBackupFromJson(rawText, activeProfile);
        showToast('Backup imported');
        return;
      }

      const mode = (prompt('Import backup for:\n1) Current account\n2) Specific account\n3) All accounts', '1') || '').trim();
      if (!mode) return;

      if (mode === '3') {
        const approved = await askConfirm({
          title: 'Import Backup',
          message: 'Import and overwrite backup data for all matching accounts in this file?',
          confirmLabel: 'Import All'
        });
        if (!approved) {
          return;
        }
        const importedCount = await importAllBackupsFromJson(rawText);
        showToast(`Backup imported for ${importedCount} account(s)`);
        return;
      }

      let targetProfile = activeProfile;
      if (mode === '2') {
        const users = await getAllUsers();
        const username = (prompt(`Enter account username to import into:\n${users.join(', ')}`, activeProfile) || '').trim();
        if (!username) return;
        if (!users.includes(username)) {
          showToast('Account not found');
          return;
        }
        targetProfile = username;
      }

      const approved = await askConfirm({
        title: 'Import Backup',
        message: `Import backup and overwrite songs/playlists for "${targetProfile}"?`,
        confirmLabel: 'Import'
      });
      if (!approved) {
        return;
      }

      await importFullBackupFromJson(rawText, targetProfile);
      showToast('Backup imported');
    } catch (err) {
      showToast(err && err.message ? err.message : 'Failed to import backup');
    } finally {
      importBackupInput.value = '';
    }
  });

  onEvent(resetDataBtn, 'click', async () => {
    const approved = await askConfirm({
      title: 'Reset Account Data',
      message: 'Reset this account to factory presets? This removes custom playlists and songs for this account only.',
      confirmLabel: 'Reset'
    });
    if (!approved) return;
    await resetCurrentData();
    showToast('App data reset');
  });

  onEvent(switchProfileBtn, 'click', async () => {
    if (!isMasterSession) {
      showToast('Profile switch is only available for admin account');
      return;
    }
    await switchActiveProfile(profileSelect.value);
  });

  onEvent(profileSelect, 'change', () => {
    updateProfileButtons();
  });

  onEvent(logoutBtn, 'click', () => {
    logoutCurrentSession();
  });

  onEvent(switchAccountsBtn, 'click', () => {
    logoutCurrentSession();
  });

  onEvent(deleteAccountBtn, 'click', async () => {
    if (!isMasterSession) {
      showToast('Only admin can delete accounts');
      return;
    }

    const selectedProfile = (profileSelect.value || '').trim();
    if (!selectedProfile) {
      showToast('Select an account first');
      return;
    }

    if (selectedProfile.toLowerCase() === ADMIN_ACCOUNT_NAME) {
      showToast('Admin account cannot be deleted');
      return;
    }

    const approved = await askConfirm({
      title: 'Delete Account',
      message: `Delete account "${selectedProfile}"?`,
      confirmLabel: 'Delete'
    });
    if (!approved) return;

    const wasDeleted = await deleteUserAccount(selectedProfile);
    if (!wasDeleted) {
      showToast('Failed to delete account');
      return;
    }

    localStorage.removeItem(`musicmixer_preferences_${selectedProfile}`);
    localStorage.removeItem(`${PLAYCOUNT_STORAGE_PREFIX}${selectedProfile}`);

    if (activeProfile === selectedProfile) {
      await switchActiveProfile(ADMIN_ACCOUNT_NAME);
    }

    await refreshProfileUI();
    showToast(`Deleted account: ${selectedProfile}`);
  });

  onEvent(changePasswordBtn, 'click', async () => {
    if (!isMasterSession) {
      showToast('Only admin can change account passwords');
      return;
    }

    const selectedProfile = (profileSelect.value || '').trim();
    if (!selectedProfile) {
      showToast('Select an account first');
      return;
    }

    const firstEntry = prompt(`Enter a new password for "${selectedProfile}"`);
    if (firstEntry === null) return;
    const password = firstEntry.trim();
    if (!password) {
      showToast('Password cannot be empty');
      return;
    }

    const confirmEntry = prompt(`Confirm new password for "${selectedProfile}"`);
    if (confirmEntry === null) return;
    if (password !== confirmEntry.trim()) {
      showToast('Passwords do not match');
      return;
    }

    const didUpdate = await changePassword(selectedProfile, password);
    if (!didUpdate) {
      showToast('Failed to change password');
      return;
    }

    showToast(`Password changed for ${selectedProfile}`);
  });

  syncPreferenceUI();

  onEvent(newPlaylistBtn, 'click', () => {
    newPlaylistInput.value = '';
    showModal(newPlaylistPopup);
    setTimeout(() => newPlaylistInput.focus(), 100);
  });

  onEvent(createPlaylistBtn, 'click', () => {
    const name = newPlaylistInput.value.trim();
    if (name) {
      createPlaylist(name);
      hideModal(newPlaylistPopup);
    }
  });

  onEvent(cancelNewPlaylistBtn, 'click', () => hideModal(newPlaylistPopup));
  onEvent(closeNewPlaylistBtn, 'click', () => hideModal(newPlaylistPopup));
  closeOnBackdropClick(newPlaylistPopup, () => hideModal(newPlaylistPopup));

  newPlaylistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      createPlaylistBtn.click();
    }
  });

  saveRenamePlaylistBtn.addEventListener('click', () => {
    const newName = renamePlaylistInput.value.trim();
    if (newName && renamePlaylistId) {
      renamePlaylist(renamePlaylistId, newName);
      hideModal(renamePlaylistPopup);
      renamePlaylistId = null;
    }
  });

  onEvent(cancelRenamePlaylistBtn, 'click', () => {
    hideModal(renamePlaylistPopup);
    renamePlaylistId = null;
  });
  
  onEvent(closeRenamePlaylistBtn, 'click', () => {
    hideModal(renamePlaylistPopup);
    renamePlaylistId = null;
  });
  
  onEvent(renamePlaylistPopup, 'click', (e) => {
    if (e.target === renamePlaylistPopup) {
      hideModal(renamePlaylistPopup);
      renamePlaylistId = null;
    }
  });

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', performDelete);
  }

  const closeDeleteModal = () => {
    hideModal(deleteConfirmPopup);
    playlistToDelete = null;
  };

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  }

  if (closeDeleteConfirmBtn) {
    closeDeleteConfirmBtn.addEventListener('click', closeDeleteModal);
  }

  closeOnBackdropClick(deleteConfirmPopup, closeDeleteModal);

  if (cancelImportBtn) {
    cancelImportBtn.addEventListener('click', () => closeConfirmDialog(false));
  }

  if (closeImportConfirmBtn) {
    closeImportConfirmBtn.addEventListener('click', () => closeConfirmDialog(false));
  }

  closeOnBackdropClick(importConfirmPopup, () => closeConfirmDialog(false));

  if (confirmImportBtn) {
    confirmImportBtn.addEventListener('click', () => closeConfirmDialog(true));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (importConfirmPopup && !importConfirmPopup.classList.contains(hiddenClass)) {
        closeConfirmDialog(false);
      }
      [
        uploadModal,
        statsModal,
        preferencesPopup,
        newPlaylistPopup,
        renamePlaylistPopup,
        deleteConfirmPopup
      ].forEach((modalEl) => hideModal(modalEl));
    }

    if (e.key === 'Enter' && !deleteConfirmPopup.classList.contains(hiddenClass)) {
      performDelete();
    }
  });

  renamePlaylistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRenamePlaylistBtn.click();
    }
  });
});
