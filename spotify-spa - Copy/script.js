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

  // State
  let db;
  let songs = []; // [{ id, name, audioURL, imageURL }]
  let currentIndex = -1;
  let isLooping = false;
  let isShuffling = false;

  // IndexedDB setup
  const request = indexedDB.open("SpotifyCloneDB", 1);
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    // Optional: preload demo songs once (safe guard below)
    preloadSongsIfEmpty().then(loadSongs);
  };
  request.onerror = (e) => {
    console.error("IndexedDB error:", e);
    // Fallback: still allow UI, but uploads won’t persist
  };

  // Core playback
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
  function renderSong(songObj, index) {
    const row = document.createElement('div');
    row.classList.add('song');

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('song-name');
    nameSpan.textContent = songObj.name;

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = "❌";
    deleteBtn.classList.add('delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = confirm(`Delete "${songObj.name}"?`);
      if (!ok) return;
      deleteSong(songObj.id);
    });

    row.appendChild(nameSpan);
    row.appendChild(deleteBtn);

    row.addEventListener('click', () => {
      // Always resolve the latest index (safe after deletes)
      const idx = songs.findIndex(s => s.id === songObj.id);
      playSong(idx);
    });

    songList.appendChild(row);
  }

  // Save new song (blob) to DB
  function saveSong(name, audioBlob, imageBlob) {
    if (!db) {
      alert("Storage not ready yet. Please wait a moment and try again.");
      return;
    }
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    store.add({ name, audioBlob, imageBlob });
    tx.oncomplete = () => loadSongs();
    tx.onerror = (e) => console.error("Save error:", e);
  }

  // Load all songs from DB and rebuild UI
  function loadSongs() {
    songs = [];
    songList.innerHTML = "";
    if (!db) return;

    const tx = db.transaction("songs", "readonly");
    const store = tx.objectStore("songs");
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const { id, name, audioBlob, imageBlob } = cursor.value;
        const audioURL = URL.createObjectURL(audioBlob);
        const imageURL = imageBlob ? URL.createObjectURL(imageBlob) : null;
        const songObj = { id, name, audioURL, imageURL };
        songs.push(songObj);
        renderSong(songObj, songs.length - 1);
        cursor.continue();
      }
    };
  }

  // Delete from DB and reload
  function deleteSong(id) {
    if (!db) return;
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    store.delete(id);
    tx.oncomplete = () => loadSongs();
    tx.onerror = (e) => console.error("Delete error:", e);
  }

  // Optional: Preload a few demo songs (only if DB is empty)
  async function preloadSongsIfEmpty() {
    if (!db) return;
    const count = await new Promise((resolve) => {
      const tx = db.transaction("songs", "readonly");
      const store = tx.objectStore("songs");
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
    if (count > 0) return; // already populated

    // Paths must exist relative to your site
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

        const tx = db.transaction("songs", "readwrite");
        const store = tx.objectStore("songs");
        store.add({ name: d.name, audioBlob, imageBlob });
      } catch (err) {
        console.warn("Preload failed for:", d.name, err);
      }
    }
  }

  // Upload flow
  addSongBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('songNameInput');
    const fileInput = document.getElementById('songFileInput');
    const imageInput = document.getElementById('songImageInput');

    if (!nameInput.value || fileInput.files.length === 0) {
      alert("Please enter a name and select an MP3 file.");
      return;
    }
    const file = fileInput.files[0];
    const songName = nameInput.value;
    const imageFile = imageInput.files.length > 0 ? imageInput.files[0] : null;

    saveSong(songName, file, imageFile);

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
  openmenubtn.addEventListener('click', () => overlay.classList.remove('hidden'));
  closebtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add("hidden"); });
});
