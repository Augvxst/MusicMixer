window.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById('loadingScreen');
  
  const audio = document.getElementById('audio');
  const songTitle = document.getElementById('title');
  const albumArt = document.querySelector('.user-photo');
  const playButton = document.getElementById('play');
  const pauseButton = document.getElementById('pause');
  const prevButton = document.getElementById('prev');
  const nextButton = document.getElementById('next');
  const overlay = document.getElementById('uploadpopup');
  const closebtn = document.getElementById('closemenubtn');
  const openmenubtn = document.getElementById('openmenubtn');
  const addSongBtn = document.getElementById('addSongBtn');
  const songListContainer = document.getElementById('songListContainer');
  const searchInput = document.getElementById('searchInput');
  const playlistList = document.getElementById('playlistList');
  const newPlaylistBtn = document.getElementById('newPlaylistBtn');
  const playlistSelect = document.getElementById('playlistSelect');
  const toastEl = document.getElementById('toast');
  const statsBtn = document.getElementById('statsBtn');
  const statspopup = document.getElementById('statspopup');
  const closestatsbtn = document.getElementById('closestatsbtn');
  const statsContent = document.getElementById('statsContent');
  const progressBar = document.getElementById('progressBar');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');
  const volumeSlider = document.getElementById('volumeSlider');
  const queueList = document.getElementById('queueList');
  const newPlaylistPopup = document.getElementById('newPlaylistPopup');
  const newPlaylistInput = document.getElementById('newPlaylistInput');
  const createPlaylistBtn = document.getElementById('createPlaylistBtn');
  const cancelNewPlaylistBtn = document.getElementById('cancelNewPlaylistBtn');
  const closeNewPlaylistBtn = document.getElementById('closeNewPlaylistBtn');
  const renamePlaylistPopup = document.getElementById('renamePlaylistPopup');
  const renamePlaylistInput = document.getElementById('renamePlaylistInput');
  const saveRenamePlaylistBtn = document.getElementById('saveRenamePlaylistBtn');
  const cancelRenamePlaylistBtn = document.getElementById('cancelRenamePlaylistBtn');
  const closeRenamePlaylistBtn = document.getElementById('closeRenamePlaylistBtn');
  const deleteConfirmPopup = document.getElementById('deleteConfirmPopup');
  const closeDeleteConfirmBtn = document.getElementById('closeDeleteConfirmBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  let db, songs = [], filteredSongs = [], currentIndex = -1, playlists = [], currentPlaylistId = null, playCount = {}, audioCache = {}, imageCache = {}, likedSongs = new Set(), renamePlaylistId = null, playlistToDelete = null;

  const request = indexedDB.open("SpotifyCloneDB", 3);
  
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
  request.onsuccess = async (e) => {
    try {
      db = e.target.result;
      await ensureUsersStore();

      setTimeout(() => {
        showLoginScreen();
      }, 2000);
    } catch (error) {
      console.error('Initialization error:', error);
      hideLoadingScreen();
    }
  };
  request.onerror = (e) => {
    showToast("Storage failed. Changes won't persist.");
    hideLoadingScreen();
  };

  const ensureUsersStore = () => new Promise((resolve, reject) => {
    if (!db) return resolve();
    if (db.objectStoreNames.contains("users")) return resolve();

    const nextVersion = db.version + 1;
    db.close();
    const upgradeReq = indexedDB.open("SpotifyCloneDB", nextVersion);
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

  async function initializeApp() {
    await ensureDefaultPlaylists();
    await preloadDemosIfEmpty();
    await loadPlaylists();
    if (!currentPlaylistId && playlists.length) currentPlaylistId = playlists[0].id;
    await renderPlaylists();
    await loadSongsForCurrentPlaylist();
    populatePlaylistSelect();
    hideLoadingScreen();
  }

  function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        if (loadingScreen) loadingScreen.remove();
      }, 1000);
    }
  }

  async function signup(username, password) {
    if (!username || !password) {
      return { success: false, message: "Username and password required" };
    }

    await ensureUsersStore();

    const existingUser = await getUser(username);
    if (existingUser) {
      return { success: false, message: "Username already exists" };
    }
    const createdId = await addToStore("users", { username, password });
    if (!createdId) {
      return { success: false, message: "Failed to create account" };
    }
    return { success: true };
  }

  async function login(username, password) {
    if (!username || !password) {
      return { success: false, message: "Username and password required" };
    }

    await ensureUsersStore();
    
    const user = await getUser(username);
    if (!user) {
      return { success: false, message: "User not found" };
    }
    
    if (user.password !== password) {
      return { success: false, message: "Incorrect password" };
    }
    
    return { success: true };
  }

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
          try {
            await initializeApp();
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

  ['loginUsername', 'loginPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
      });
    }
  });

  ['signupUsername', 'signupPassword', 'signupConfirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') signupBtn.click();
      });
    }
  });

  const showToast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1800);
  };

  const playSong = (index) => {
    const song = songs[index];
    if (!song) return;
    audio.src = song.audioURL;
    albumArt.src = song.imageURL || "album.jpg";
    songTitle.textContent = song.name;
    playCount[song.id] = (playCount[song.id] || 0) + 1;
    audio.play();
    currentIndex = index;
    updateQueueView();
  };

  function renderSong(songObj) {
    const row = document.createElement('div');
    row.className = 'song';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'song-name';
    nameSpan.textContent = songObj.name;

    const heartBtn = document.createElement('button');
    heartBtn.className = 'heart-btn';
    heartBtn.textContent = likedSongs.has(songObj.id) ? '♥' : '♡';
    heartBtn.style.opacity = likedSongs.has(songObj.id) ? '1' : '0.4';
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
      if (confirm(`Delete "${songObj.name}" from this playlist?`)) deleteSong(songObj.id);
    };

    row.append(nameSpan, heartBtn, deleteBtn);
    row.onclick = () => playSong(songs.findIndex(s => s.id === songObj.id));
    songListContainer.appendChild(row);
  }

  async function toggleLike(songObj) {
    const likedPlaylist = await getPlaylistByName("Liked Songs");
    if (!likedPlaylist) return;
    
    if (likedSongs.has(songObj.id)) {
      likedSongs.delete(songObj.id);
      const tx = db.transaction("songs", "readwrite");
      tx.objectStore("songs").index("playlist_idx").openCursor(IDBKeyRange.only(likedPlaylist.id)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && cursor.value.id === songObj.id) {
          tx.objectStore("songs").delete(cursor.primaryKey);
        } else if (cursor) {
          cursor.continue();
        }
      };
    } else {
      likedSongs.add(songObj.id);
      await addToStore("songs", { name: songObj.name, audioBlob: audioCache[songObj.id], imageBlob: imageCache[songObj.id] || null, playlistId: likedPlaylist.id });
    }
    
    rebuildSongUI();
    await loadPlaylists();
    await renderPlaylists();
  }

  function saveSong(name, audioBlob, imageBlob, playlistId) {
    if (!db) return alert("Storage not ready yet. Please wait a moment and try again.");
    const tx = db.transaction("songs", "readwrite");
    tx.objectStore("songs").add({ name, audioBlob, imageBlob, playlistId });
    tx.oncomplete = async () => {
      showToast("Song added");
      await loadSongsForPlaylist(playlistId);
      if (playlistId === currentPlaylistId) rebuildSongUI();
    };
  }

  async function loadSongsForCurrentPlaylist() {
    if (!currentPlaylistId) {
      songs = [];
      rebuildSongUI();
      return;
    }
    await loadSongsForPlaylist(currentPlaylistId);
    rebuildSongUI();
  }

  async function loadSongsForPlaylist(playlistId) {
    songs = [];
    if (!db) return;
    return new Promise((resolve) => {
      const req = db.transaction("songs", "readonly").objectStore("songs").index("playlist_idx").openCursor(IDBKeyRange.only(playlistId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const { id, name, audioBlob, imageBlob, playlistId: pid } = cursor.value;
          const audioURL = URL.createObjectURL(audioBlob);
          audioCache[id] = audioBlob;
          imageCache[id] = imageBlob || null;
          songs.push({ id, name, audioURL, imageURL: imageBlob ? URL.createObjectURL(imageBlob) : null, playlistId: pid });
          cursor.continue();
        } else resolve();
      };
      req.onerror = () => resolve();
    });
  }

  function rebuildSongUI() {
    songListContainer.innerHTML = "";
    filteredSongs = songs;
    if (!songs.length) {
      const empty = document.createElement('div');
      empty.className = 'song';
      empty.textContent = "No songs in this playlist yet.";
      songListContainer.appendChild(empty);
    } else songs.forEach(renderSong);
    updateStats();
    updateQueueView();
  }

  function updateStats() {
    document.getElementById('totalSongs').textContent = songs.length;
    document.getElementById('totalPlaylists').textContent = playlists.length;
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

  function filterSongs(query) {
    songListContainer.innerHTML = "";
    const q = query.toLowerCase();
    filteredSongs = songs.filter(s => s.name.toLowerCase().includes(q));
    if (!filteredSongs.length) {
      const empty = document.createElement('div');
      empty.className = 'song';
      empty.textContent = "No songs found.";
      songListContainer.appendChild(empty);
    } else filteredSongs.forEach(renderSong);
  }

  searchInput.addEventListener('input', (e) => filterSongs(e.target.value));

  function deleteSong(id) {
    if (!db) return;
    const tx = db.transaction("songs", "readwrite");
    tx.objectStore("songs").delete(id);
    tx.oncomplete = async () => {
      showToast("Song deleted");
      await loadSongsForCurrentPlaylist();
    };
  }

  async function loadPlaylists() {
    playlists = [];
    if (!db) return;
    return new Promise((resolve) => {
      db.transaction("playlists", "readonly").objectStore("playlists").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          playlists.push({ id: cursor.value.id, name: cursor.value.name });
          cursor.continue();
        } else resolve();
      };
    });
  }

  function createPlaylist(name) {
    if (!name || !db) return;
    const req = db.transaction("playlists", "readwrite").objectStore("playlists").add({ name });
    req.onsuccess = async (e) => {
      currentPlaylistId = e.target.result;
      showToast("Playlist created");
      await loadPlaylists();
      await renderPlaylists();
      await loadSongsForCurrentPlaylist();
      populatePlaylistSelect();
    };
  }

  function deletePlaylist(id) {
    if (!db) return;
    playlistToDelete = id;
    deleteConfirmPopup.classList.remove('hidden');
  }

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
        ss.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    tx.oncomplete = async () => {
      showToast("Playlist deleted");
      if (currentPlaylistId === id) currentPlaylistId = null;
      await loadPlaylists();
      if (!currentPlaylistId && playlists.length) currentPlaylistId = playlists[0].id;
      await renderPlaylists();
      await loadSongsForCurrentPlaylist();
      populatePlaylistSelect();
      deleteConfirmPopup.classList.add('hidden');
      playlistToDelete = null;
    };
  };

  function renamePlaylist(id, newName) {
    if (!db || !newName) return;
    const store = db.transaction("playlists", "readwrite").objectStore("playlists");
    store.get(id).onsuccess = (e) => {
      const obj = e.target.result;
      if (!obj) return;
      obj.name = newName;
      store.put(obj).onsuccess = async () => {
        showToast("Playlist renamed");
        await loadPlaylists();
        await renderPlaylists();
        populatePlaylistSelect();
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
      if (p.id === currentPlaylistId) {
        item.classList.add('active');
      }
      item.onclick = async () => {
        document.querySelectorAll('.playlist').forEach(pl => pl.classList.remove('active'));
        item.classList.add('active');
        currentPlaylistId = p.id;
        await loadSongsForCurrentPlaylist();
      };

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginTop = '6px';

      const renameBtn = document.createElement('button');
      renameBtn.textContent = "↻";
      renameBtn.className = 'btn';
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        renamePlaylistId = p.id;
        renamePlaylistInput.value = p.name;
        renamePlaylistPopup.classList.remove('hidden');
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

  async function ensureDefaultPlaylists() {
    if (await countStore("playlists") === 0) {
      await addToStore("playlists", { name: "My Library" });
      await addToStore("playlists", { name: "Demos" });
    }
    const likedExists = await getPlaylistByName("Liked Songs");
    if (!likedExists) {
      await addToStore("playlists", { name: "Liked Songs" });
    }
  }

  async function preloadDemosIfEmpty() {
    const demosPlaylist = await getPlaylistByName("Demos");
    if (!demosPlaylist || await countSongsInPlaylist(demosPlaylist.id) > 0) return;

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
        await addToStore("songs", { name: d.name, audioBlob, imageBlob, playlistId: demosPlaylist.id });
      } catch (err) {}
    }
  }

  const countStore = (storeName) => new Promise((resolve) => {
    const req = db.transaction(storeName, "readonly").objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => resolve(0);
  });

  const addToStore = (storeName, obj) => new Promise((resolve) => {
    const req = db.transaction(storeName, "readwrite").objectStore(storeName).add(obj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  const getPlaylistByName = (name) => new Promise((resolve) => {
    const req = db.transaction("playlists", "readonly").objectStore("playlists").openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.value.name === name ? resolve(cursor.value) : cursor.continue();
      } else resolve(null);
    };
    req.onerror = () => resolve(null);
  });

  const countSongsInPlaylist = (playlistId) => new Promise((resolve) => {
    const req = db.transaction("songs", "readonly").objectStore("songs").index("playlist_idx").count(IDBKeyRange.only(playlistId));
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => resolve(0);
  });

  const getAllSongs = () => new Promise((resolve) => {
    const allSongs = [];
    const req = db.transaction("songs", "readonly").objectStore("songs").openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        allSongs.push({ id: cursor.value.id, name: cursor.value.name, playlistId: cursor.value.playlistId });
        cursor.continue();
      } else {
        resolve(allSongs);
      }
    };
    req.onerror = () => resolve(allSongs);
  });

  addSongBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('songNameInput');
    const fileInput = document.getElementById('songFileInput');
    const imageInput = document.getElementById('songImageInput');
    const selectedPlaylistId = Number(playlistSelect.value || currentPlaylistId);

    if (!nameInput.value || !fileInput.files.length) return alert("Please enter a name and select an audio file.");
    if (!selectedPlaylistId) return alert("Please select a playlist.");

    saveSong(nameInput.value.trim(), fileInput.files[0], imageInput.files[0] || null, selectedPlaylistId);
    nameInput.value = fileInput.value = imageInput.value = "";
    overlay.classList.add("hidden");
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
  
  audio.addEventListener('ended', playNext);
 
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

  openmenubtn.addEventListener('click', () => {
    populatePlaylistSelect();
    overlay.classList.remove('hidden');
  });
  closebtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add("hidden"); });

  statsBtn.addEventListener('click', async () => {
    const allSongs = await getAllSongs();
    const totalPlays = allSongs.reduce((sum, s) => sum + (playCount[s.id] || 0), 0);

    statsContent.innerHTML = `<div><strong>Total Songs:</strong> ${allSongs.length}</div><div><strong>Total Playlists:</strong> ${playlists.length}</div><div><strong>Total Plays:</strong> ${totalPlays}</div>`;
    const sorted = [...allSongs].sort((a, b) => (playCount[b.id] || 0) - (playCount[a.id] || 0)).slice(0, 5);
    if (sorted.length) {
      statsContent.innerHTML += "<div style='margin-top: 15px;'><strong>Most Played:</strong></div>";
      sorted.forEach(s => statsContent.innerHTML += `<div style='font-size: 0.9em; color: #bbb;'>${s.name} (${playCount[s.id] || 0} plays)</div>`);
    }
    statspopup.classList.remove('hidden');
  });
  closestatsbtn.addEventListener('click', () => statspopup.classList.add('hidden'));
  statspopup.addEventListener('click', (e) => { if (e.target === statspopup) statspopup.classList.add("hidden"); });

  newPlaylistBtn.addEventListener('click', () => {
    newPlaylistInput.value = '';
    newPlaylistPopup.classList.remove('hidden');
    setTimeout(() => newPlaylistInput.focus(), 100);
  });

  createPlaylistBtn.addEventListener('click', () => {
    const name = newPlaylistInput.value.trim();
    if (name) {
      createPlaylist(name);
      newPlaylistPopup.classList.add('hidden');
    }
  });

  cancelNewPlaylistBtn.addEventListener('click', () => newPlaylistPopup.classList.add('hidden'));
  closeNewPlaylistBtn.addEventListener('click', () => newPlaylistPopup.classList.add('hidden'));
  newPlaylistPopup.addEventListener('click', (e) => { if (e.target === newPlaylistPopup) newPlaylistPopup.classList.add('hidden'); });

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
      renamePlaylistPopup.classList.add('hidden');
      renamePlaylistId = null;
    }
  });

  cancelRenamePlaylistBtn.addEventListener('click', () => {
    renamePlaylistPopup.classList.add('hidden');
    renamePlaylistId = null;
  });
  
  closeRenamePlaylistBtn.addEventListener('click', () => {
    renamePlaylistPopup.classList.add('hidden');
    renamePlaylistId = null;
  });
  
  renamePlaylistPopup.addEventListener('click', (e) => {
    if (e.target === renamePlaylistPopup) {
      renamePlaylistPopup.classList.add('hidden');
      renamePlaylistId = null;
    }
  });

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', performDelete);
  }

  const closeDeleteModal = () => {
    deleteConfirmPopup.classList.add('hidden');
    playlistToDelete = null;
  };

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  }

  if (closeDeleteConfirmBtn) {
    closeDeleteConfirmBtn.addEventListener('click', closeDeleteModal);
  }

  if (deleteConfirmPopup) {
    deleteConfirmPopup.addEventListener('click', (e) => {
      if (e.target === deleteConfirmPopup) {
        closeDeleteModal();
      }
    });
  }

  renamePlaylistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRenamePlaylistBtn.click();
    }
  });
});
