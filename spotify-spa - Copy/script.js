window.addEventListener('DOMContentLoaded', () => {
const songs = document.querySelectorAll('.song');
const audio = document.getElementById('audio');
const songTitle = document.getElementById('title');
const albumArt = document.querySelector('.user-photo');
const playButton = document.getElementById('play');
let currentSong = null;

songs.forEach(song => {
  song.addEventListener('click', () => {
    const src = song.getAttribute('data-songs');
    const img = song.getAttribute('data-images');
    const title = song.textContent;


    audio.src = src;
    albumArt.src = img;
    songTitle.textContent = title;


    audio.play();
    currentSong = song;
  });
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