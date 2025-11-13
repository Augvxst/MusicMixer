window.addEventListener('DOMContentLoaded', () => {
  const songs = document.querySelectorAll('.song');
  const audio = document.getElementById('audio');
  const songTitle = document.getElementById('title');
  const albumArt = document.querySelector('.user-photo');
  const playButton = document.getElementById('play');
  const overlay = document.getElementById('uploadpopup');
  const closebtn = document.getElementById('closemenubtn');
  const openmenubtn = document.getElementById('openmenubtn');
  const addSongBtn = document.getElementById('addSongBtn');
  const songList = document.querySelector('.song-list');
  let currentSong = null;

 
  function attachSongEvents(song) {
    song.addEventListener('click', () => {
      const src = song.getAttribute('data-songs');
      const img = song.getAttribute('data-images');
      const title = song.textContent;

      audio.src = src;
      albumArt.src = img || "album.jpg"; 
      songTitle.textContent = title;

      audio.play();
      currentSong = song;
    });
  }

  songs.forEach(attachSongEvents);

 
  openmenubtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
  });

  closebtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
    overlay.classList.add("hidden");
    }
  });

 
  addSongBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('songNameInput');
    const fileInput = document.getElementById('songFileInput');

    if (!nameInput.value || fileInput.files.length === 0) {
      alert("Please enter a name and select an MP3 file.");
      return;
    }

    const file = fileInput.files[0];
    const songName = nameInput.value;

 
    const fileURL = URL.createObjectURL(file);

    const newSong = document.createElement('div');
    newSong.classList.add('song');
    newSong.textContent = songName;
    newSong.setAttribute('data-songs', fileURL);
    newSong.setAttribute('data-images', "album.jpg"); 

    attachSongEvents(newSong);

   
    songList.appendChild(newSong);

    nameInput.value = "";
    fileInput.value = "";

    overlay.classList.add("hidden");
  });

  addSongBtn.addEventListener('click', () => {
  const nameInput = document.getElementById('songNameInput');
  const fileInput = document.getElementById('songFileInput');

  if (!nameInput.value || fileInput.files.length === 0) {
    alert("Please enter a name and select an MP3 file.");
    return;
  }

  const file = fileInput.files[0];
  const songName = nameInput.value;
  const fileURL = URL.createObjectURL(file);

  const newSong = document.createElement('div');
  newSong.classList.add('song');
  newSong.textContent = songName;
  newSong.setAttribute('data-songs', fileURL);
  newSong.setAttribute('data-images', "album.jpg"); 

  newSong.addEventListener('click', () => {
    audio.src = fileURL;
    albumArt.src = "album.jpg";
    songTitle.textContent = songName;
    audio.play();
    currentSong = newSong;
  });

  const songList = document.querySelector('.song-list');
  songList.appendChild(newSong);

  nameInput.value = "";
  fileInput.value = "";

  overlay.classList.add("hidden");
});


  playButton.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  });
});
