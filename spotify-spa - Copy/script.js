window.addEventListener('DOMContentLoaded', () => {
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

  let db, songs = [], currentIndex = -1, isLooping = false, isShuffling = false, playlists = [], currentPlaylistId = null;

  const request = indexedDB.open("SpotifyCloneDB", 2);
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("songs")) {
      db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
    }
    if (!db.objectStoreNames.contains("playlists")) {
      db.createObjectStore("playlists", { keyPath: "id", autoIncrement: true }).createIndex("name_idx", "name", { unique: false });
    }
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
    if (!currentPlaylistId && playlists.length) currentPlaylistId = playlists[0].id;
    await renderPlaylists();
    await loadSongsForCurrentPlaylist();
    populatePlaylistSelect();
  };
  request.onerror = (e) => showToast("Storage failed. Changes won't persist.");

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
    audio.play();
    currentIndex = index;
  };

  function renderSong(songObj) {
    const row = document.createElement('div');
    row.className = 'song';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'song-name';
    nameSpan.textContent = songObj.name;

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = "❌";
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = "Delete song";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${songObj.name}" from this playlist?`)) deleteSong(songObj.id);
    };

    row.append(nameSpan, deleteBtn);
    row.onclick = () => playSong(songs.findIndex(s => s.id === songObj.id));
    songList.appendChild(row);
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
      songList.innerHTML = "";
      const req = db.transaction("songs", "readonly").objectStore("songs").index("playlist_idx").openCursor(IDBKeyRange.only(playlistId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const { id, name, audioBlob, imageBlob, playlistId: pid } = cursor.value;
          songs.push({ id, name, audioURL: URL.createObjectURL(audioBlob), imageURL: imageBlob ? URL.createObjectURL(imageBlob) : null, playlistId: pid });
          cursor.continue();
        } else resolve();
      };
      req.onerror = () => resolve();
    });
  }

  function rebuildSongUI() {
    songList.innerHTML = "";
    if (!songs.length) {
      const empty = document.createElement('div');
      empty.className = 'song';
      empty.textContent = "No songs in this playlist yet.";
      songList.appendChild(empty);
    } else songs.forEach(renderSong);
  }

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
    if (!db || !confirm("Delete this playlist and its songs?")) return;
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
    };
  }

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
      return;
    }
    playlists.forEach(p => {
      const item = document.createElement('div');
      item.className = 'playlist';
      item.textContent = p.name;
      if (p.id === currentPlaylistId) {
        item.style.background = '#1db954';
        item.style.color = '#121212';
      }
      item.onclick = async () => {
        currentPlaylistId = p.id;
        await loadSongsForCurrentPlaylist();
        await renderPlaylists();
      };

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginTop = '6px';

      const renameBtn = document.createElement('button');
      renameBtn.textContent = "✏️";
      renameBtn.className = 'btn';
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        const newName = prompt("New playlist name:", p.name);
        if (newName?.trim()) renamePlaylist(p.id, newName.trim());
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = "🗑️";
      deleteBtn.className = 'btn';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deletePlaylist(p.id);
      };

      actions.append(renameBtn, deleteBtn);
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
    if (currentPlaylistId) playlistSelect.value = currentPlaylistId;
  }

  async function ensureDefaultPlaylists() {
    if (await countStore("playlists") === 0) {
      await addToStore("playlists", { name: "My Library" });
      await addToStore("playlists", { name: "Demos" });
    }
  }

  async function preloadDemosIfEmpty() {
    const demosPlaylist = await getPlaylistByName("Demos");
    if (!demosPlaylist || await countSongsInPlaylist(demosPlaylist.id) > 0) return;

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
      } catch (err) {}
    }
  }

  // IndexedDB helpers
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
    if (audio.src) audio.paused ? audio.play() : audio.pause();
  });

  prevButton.addEventListener('click', () => {
    if (currentIndex > 0) playSong(currentIndex - 1);
  });

  const playNext = () => {
    if (!songs.length) return;
    if (isShuffling) {
      playSong(Math.floor(Math.random() * songs.length));
    } else if (currentIndex < songs.length - 1) {
      playSong(currentIndex + 1);
    } else if (isLooping) {
      playSong(0);
    }
  };

  nextButton.addEventListener('click', playNext);

  loopButton.addEventListener('click', () => {
    isLooping = !isLooping;
    loopButton.classList.toggle('active', isLooping);
  });

  shuffleButton.addEventListener('click', () => {
    isShuffling = !isShuffling;
    shuffleButton.classList.toggle('active', isShuffling);
  });

  audio.addEventListener('ended', playNext);

  openmenubtn.addEventListener('click', () => {
    populatePlaylistSelect();
    overlay.classList.remove('hidden');
  });
  closebtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add("hidden"); });

  newPlaylistBtn.addEventListener('click', () => {
    const name = prompt("New playlist name:");
    if (name?.trim()) createPlaylist(name.trim());
  });
});
