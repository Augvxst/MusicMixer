window.addEventListener('DOMContentLoaded', () => {
  // Elements
  const audio = document.getElementById('audio');
  const songTitle = document.getElementById('title');
  const albumArt = document.querySelector('.user-photo');
  const playButton = document.getElementById('play');
  const prevButton = document.getElementById('prev');
  const nextButton = document.getElementById('next');
  const loopButton = document.getElementById('loop');
  const shuffleButton = document.getElementById('shuffle');
  const overlay = document.getElementById('uploadpopup');
  const closebtn = document.getElementById('closemenubtn');
  const openmenubtn = document.getElementById('openmenubtn');
  const addSongBtn = document.getElementById('addSongBtn');
  const songList = document.querySelector('.song-list');

  const playlistList = document.getElementById('playlistList');
  const newPlaylistBtn = document.getElementById('newPlaylistBtn');
  const playlistSelect = document.getElementById('playlistSelect');
  const toastEl = document.getElementById('toast');

  // State
  let db;
  let songs = []; // current playlist's songs [{ id, name, audioURL, imageURL, playlistId }]
  let currentIndex = -1;
  let isLooping = false;
  let isShuffling = false;
  let playlists = []; // [{ id, name }]
  let currentPlaylistId = null;

  // IndexedDB setup
  const request = indexedDB.open("SpotifyCloneDB", 2);
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    // v1 had songs only; v2 adds playlists and a playlistId on songs
    if (!db.objectStoreNames.contains("songs")) {
      db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
    }
    if (!db.objectStoreNames.contains("playlists")) {
      const ps = db.createObjectStore("playlists", { keyPath: "id", autoIncrement: true });
      ps.createIndex("name_idx", "name", { unique: false });
    }
    // Add index on songs for playlistId if upgrading from older version
    const songsStore = e.currentTarget.transaction.objectStore("songs");
    if (!songsStore.indexNames.contains("playlist_idx")) {
      songsStore.createIndex("playlist_idx", "playlistId", { unique: false });
    }
  };
  request.onsuccess = async (e) => {
    db = e.target.result;
    await ensureDefaultPlaylists();
    await preloadDemosIfEmpty();
    await loadPlaylists();
    // Set current playlist to first available
    if (!currentPlaylistId && playlists.length > 0) {
      currentPlaylistId = playlists[0].id;
    }
    await renderPlaylists();
    await loadSongsForCurrentPlaylist();
    populatePlaylistSelect();
  };
  request.onerror = (e) => {
    console.error("IndexedDB error:", e);
    showToast("Storage failed. Changes won't persist.");
  };

  // Toast feedback
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  // Playback
  function playSong(index) {
    const song = songs[index];
    if (!song) return;
    audio.src = song.audioURL;
    albumArt.src = song.imageURL || "album.jpg";
    songTitle.textContent = song.name;
    audio.play();
    currentIndex = index;
  }

  // Render one song row
  function renderSong(songObj) {
    const row = document.createElement('div');
    row.classList.add('song');

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('song-name');
    nameSpan.textContent = songObj.name;

    // right-side actions
    const actions = document.createElement('div');

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = "❌";
    deleteBtn.classList.add('delete-btn');
    deleteBtn.title = "Delete song";
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = confirm(`Delete "${songObj.name}" from this playlist?`);
      if (!ok) return;
      deleteSong(songObj.id);
    });

    actions.appendChild(deleteBtn);

    row.appendChild(nameSpan);
    row.appendChild(actions);

    row.addEventListener('click', () => {
      const idx = songs.findIndex(s => s.id === songObj.id);
      playSong(idx);
    });

    songList.appendChild(row);
  }

  // Save new song (blob) to DB into specific playlist
  function saveSong(name, audioBlob, imageBlob, playlistId) {
    if (!db) {
      alert("Storage not ready yet. Please wait a moment and try again.");
      return;
    }
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    store.add({ name, audioBlob, imageBlob, playlistId });
    tx.oncomplete = async () => {
      showToast("Song added");
      await loadSongsForPlaylist(playlistId);
      if (playlistId === currentPlaylistId) rebuildSongUI();
    };
    tx.onerror = (e) => console.error("Save error:", e);
  }

  // Load songs for the current playlist into state
  async function loadSongsForCurrentPlaylist() {
    if (!currentPlaylistId) {
      songs = [];
      rebuildSongUI();
      return;
    }
    await loadSongsForPlaylist(currentPlaylistId);
    rebuildSongUI();
  }

  // Query songs by playlist
  async function loadSongsForPlaylist(playlistId) {
    songs = [];
    if (!db) return;
    const tx = db.transaction("songs", "readonly");
    const store = tx.objectStore("songs");
    const index = store.index("playlist_idx");
    return new Promise((resolve) => {
      songList.innerHTML = "";
      const request = index.openCursor(IDBKeyRange.only(playlistId));
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const { id, name, audioBlob, imageBlob, playlistId: pid } = cursor.value;
          const audioURL = URL.createObjectURL(audioBlob);
          const imageURL = imageBlob ? URL.createObjectURL(imageBlob) : null;
          const songObj = { id, name, audioURL, imageURL, playlistId: pid };
          songs.push(songObj);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => resolve();
    });
  }

  function rebuildSongUI() {
    songList.innerHTML = "";
    if (songs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'song';
      empty.textContent = "No songs in this playlist yet.";
      songList.appendChild(empty);
      return;
    }
    songs.forEach(renderSong);
  }

  // Delete song
  function deleteSong(id) {
    if (!db) return;
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    store.delete(id);
    tx.oncomplete = async () => {
      showToast("Song deleted");
      await loadSongsForCurrentPlaylist();
    };
    tx.onerror = (e) => console.error("Delete error:", e);
  }

  // Playlists: CRUD and rendering
  async function loadPlaylists() {
    playlists = [];
    if (!db) return;
    const tx = db.transaction("playlists", "readonly");
    const store = tx.objectStore("playlists");
    return new Promise((resolve) => {
      store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const { id, name } = cursor.value;
          playlists.push({ id, name });
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  function createPlaylist(name) {
    if (!name || !db) return;
    const tx = db.transaction("playlists", "readwrite");
    const store = tx.objectStore("playlists");
    const req = store.add({ name });
    req.onsuccess = async (e) => {
      const id = e.target.result;
      showToast("Playlist created");
      await loadPlaylists();
      // set current to new playlist
      currentPlaylistId = id;
      await renderPlaylists();
      await loadSongsForCurrentPlaylist();
      populatePlaylistSelect();
    };
    req.onerror = (e) => console.error("Create playlist error:", e);
  }

  function deletePlaylist(id) {
    if (!db) return;
    const ok = confirm("Delete this playlist and its songs?");
    if (!ok) return;

    const tx = db.transaction(["playlists", "songs"], "readwrite");
    const ps = tx.objectStore("playlists");
    const ss = tx.objectStore("songs");
    // delete the playlist
    ps.delete(id);
    // delete songs with this playlistId
    const idx = ss.index("playlist_idx");
    idx.openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
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
      if (!currentPlaylistId && playlists.length > 0) currentPlaylistId = playlists[0].id;
      await renderPlaylists();
      await loadSongsForCurrentPlaylist();
      populatePlaylistSelect();
    };
    tx.onerror = (e) => console.error("Delete playlist error:", e);
  }

  function renamePlaylist(id, newName) {
    if (!db || !newName) return;
    const tx = db.transaction("playlists", "readwrite");
    const store = tx.objectStore("playlists");
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
    if (playlists.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'playlist';
      empty.textContent = "No playlists yet.";
      playlistList.appendChild(empty);
      return;
    }

    playlists.forEach(p => {
      const item = document.createElement('div');
      item.className = 'playlist';
      item.textContent = p.name;
      if (p.id === currentPlaylistId) {
        item.style.backgroundColor = '#1db954';
        item.style.color = '#121212';
      }
      item.addEventListener('click', async () => {
        currentPlaylistId = p.id;
        await loadSongsForCurrentPlaylist();
        await renderPlaylists();
      });

      // small action row
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginTop = '6px';

      const renameBtn = document.createElement('button');
      renameBtn.textContent = "✏️";  
      renameBtn.className = 'btn';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt("New playlist name:", p.name);
        if (newName && newName.trim()) renamePlaylist(p.id, newName.trim());
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = "🗑️";
      deleteBtn.className = 'btn';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePlaylist(p.id);
      });

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(actions);

      playlistList.appendChild(item);
    });
  }

  function populatePlaylistSelect() {
    playlistSelect.innerHTML = "";
    playlists.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      playlistSelect.appendChild(opt);
    });
    // Default to current playlist if exists
    if (currentPlaylistId) playlistSelect.value = currentPlaylistId;
  }

  // Ensure a default playlist exists
  async function ensureDefaultPlaylists() {
    const existing = await countStore("playlists");
    if (existing === 0) {
      await addToStore("playlists", { name: "My Library" });
      await addToStore("playlists", { name: "Demos" });
    }
  }

  // Preload demo songs into "Demos" playlist only if it has no songs
  async function preloadDemosIfEmpty() {
    const demosPlaylist = await getPlaylistByName("Demos");
    if (!demosPlaylist) return;
    const demoCount = await countSongsInPlaylist(demosPlaylist.id);
    if (demoCount > 0) return;

    const demos = [
      { name: "Wiz Khalifa - Black and Yellow", audioPath: "songs/song1.mp3", imagePath: "albums/song1.jpg" },
      { name: "Kendrick Lamar - Not Like Us", audioPath: "songs/song2.mp3", imagePath: "albums/song2.png" },
      { name: "J. Cole - No Role Modelz", audioPath: "songs/song4.mp3", imagePath: "albums/song4.jpg" }
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
      } catch (err) {
        console.warn("Preload failed for:", d.name, err);
      }
    }
  }

  // Small IndexedDB helpers
  function countStore(storeName) {
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  }

  function addToStore(storeName, obj) {
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.add(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  function getPlaylistByName(name) {
    return new Promise((resolve) => {
      const tx = db.transaction("playlists", "readonly");
      const store = tx.objectStore("playlists");
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.name === name) resolve(cursor.value);
          else cursor.continue();
        } else resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  }

  function countSongsInPlaylist(playlistId) {
    return new Promise((resolve) => {
      const tx = db.transaction("songs", "readonly");
      const store = tx.objectStore("songs");
      const idx = store.index("playlist_idx");
      const req = idx.count(IDBKeyRange.only(playlistId));
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  }

  // Upload flow
  addSongBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('songNameInput');
    const fileInput = document.getElementById('songFileInput');
    const imageInput = document.getElementById('songImageInput');

    const selectedPlaylistId = Number(playlistSelect.value || currentPlaylistId);

    if (!nameInput.value || fileInput.files.length === 0) {
      alert("Please enter a name and select an audio file.");
      return;
    }
    if (!selectedPlaylistId) {
      alert("Please select a playlist.");
      return;
    }

    const file = fileInput.files[0];
    const songName = nameInput.value.trim();
    const imageFile = imageInput.files.length > 0 ? imageInput.files[0] : null;

    saveSong(songName, file, imageFile, selectedPlaylistId);

    nameInput.value = "";
    fileInput.value = "";
    if (imageInput) imageInput.value = "";
    overlay.classList.add("hidden");
  });

  // Controls
  playButton.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) audio.play();
    else audio.pause();
  });

  prevButton.addEventListener('click', () => {
    if (currentIndex > 0) playSong(currentIndex - 1);
  });

  nextButton.addEventListener('click', () => {
    if (songs.length === 0) return;
    if (isShuffling) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      playSong(randomIndex);
    } else if (currentIndex < songs.length - 1) {
      playSong(currentIndex + 1);
    } else if (isLooping) {
      playSong(0);
    }
  });

  loopButton.addEventListener('click', () => {
    isLooping = !isLooping;
    loopButton.classList.toggle('active', isLooping);
  });

  shuffleButton.addEventListener('click', () => {
    isShuffling = !isShuffling;
    shuffleButton.classList.toggle('active', isShuffling);
  });

  audio.addEventListener('ended', () => {
    if (songs.length === 0) return;
    if (isShuffling) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      playSong(randomIndex);
    } else if (currentIndex < songs.length - 1) {
      playSong(currentIndex + 1);
    } else if (isLooping) {
      playSong(0);
    }
  });

  // Popup
  openmenubtn.addEventListener('click', () => {
    populatePlaylistSelect();
    overlay.classList.remove('hidden');
  });
  closebtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add("hidden"); });

  // Playlist buttons
  newPlaylistBtn.addEventListener('click', () => {
    const name = prompt("New playlist name:");
    if (name && name.trim()) createPlaylist(name.trim());
  });
});
