const songListElement = document.getElementById('songList');
const searchToggleButton = document.getElementById('searchToggleBtn');
const songSearchPanel = document.getElementById('songSearchPanel');
const songSearchInput = document.getElementById('songSearchInput');
const playButton = document.getElementById('playBtn');
const nextButton = document.getElementById('nextBtn');
const prevButton = document.getElementById('prevBtn');
const seekBar = document.getElementById('seekBar');
const songInfoElement = document.querySelector('.songinfo');
const songTimeElement = document.getElementById('songTime');
const favoriteListElement = document.getElementById('favoriteList');

const FAVORITES_KEY = 'spotify_clone_favorite_songs';

const audio = new Audio();
let songs = [];
let currentIndex = 0;
let isPlaying = false;
let favoriteSongs = [];
let songSearchQuery = '';

function updateLibraryHighlight() {
	const items = document.querySelectorAll('.song-item');

	items.forEach((item, index) => {
		item.classList.toggle('active', Number(item.dataset.songIndex) === currentIndex && isPlaying);
	});
}

function getSongById(songId) {
	return songs.find((song) => song.id === songId);
}

function getArtistName(song) {
	const artistMap = {
		'Kabhi jo badal barse': 'Arijit Singh',
		'Dheere Dheere': 'Yo Yo Honey Singh',
		'Kabira': 'Arijit Singh',
		'Sangemarmar': 'Arijit Singh',
		'Kai po che': 'Amit Trivedi',
		'Yaariyan': 'Mithoon',
		'Blue eyes': 'Yo Yo Honey Singh',
		'Uff-teri-adaa': 'Shruti Pathak',
		'Janam Janam': 'Arijit Singh',
		'Takdir': 'Rahat Fateh Ali Khan',
		'saaddi gali': 'Lehmber Hussainpuri',
		'sanam re': 'Arijit Singh',
		'Hum tere bin ab reh nhi sakte': 'Mithoon',
	};

	return song.artist || song.artistName || artistMap[song.title] || 'Arijit Singh';
}

function persistFavoriteSongs() {
	localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteSongs));
}

function renderFavoriteSongs() {
	favoriteListElement.innerHTML = '';

	if (!favoriteSongs.length) {
		favoriteListElement.innerHTML = '<li class="empty-state">No favorites saved yet</li>';
		return;
	}

	favoriteSongs.forEach((songId) => {
		const song = getSongById(songId);

		if (!song) {
			return;
		}

		const listItem = document.createElement('li');
		listItem.className = 'favorite-card';
		listItem.innerHTML = `
			<img class="favorite-card-cover" src="${song.cover || 'https://i.scdn.co/image/ab67616d00001e0233bc5d16517fed8db985360c'}" alt="${song.title}">
			<div class="favorite-card-copy">
				<strong>${song.title}</strong>
				<span>${getArtistName(song)}</span>
			</div>
		`;
		listItem.addEventListener('click', () => loadSong(songs.findIndex((item) => item.id === songId)));
		favoriteListElement.appendChild(listItem);
	});
}

function isFavorite(songId) {
	return favoriteSongs.includes(songId);
}

function toggleFavoriteSong(songId) {
	if (isFavorite(songId)) {
		favoriteSongs = favoriteSongs.filter((entry) => entry !== songId);
	} else {
		favoriteSongs = [songId, ...favoriteSongs];
	}

	persistFavoriteSongs();
	renderFavoriteSongs();
	renderSongs();

}

function renderFavoriteButton(songId) {
	const saved = isFavorite(songId);
	return `
		<button class="song-favorite ${saved ? 'saved' : ''}" type="button" aria-label="${saved ? 'Remove from favorites' : 'Save to favorites'}">
			${saved ? '♥' : '♡'}
		</button>
	`;
}

function formatTime(seconds) {
	if (!Number.isFinite(seconds)) {
		return '0:00';
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60)
		.toString()
		.padStart(2, '0');

	return `${minutes}:${remainingSeconds}`;
}

function setPlayButtonState(playing) {
	playButton.src = playing
		? 'https://img.icons8.com/ios-glyphs/30/pause--v1.png'
		: 'https://img.icons8.com/liquid-glass/50/play.png';
}

function updateNowPlaying() {
	const currentSong = songs[currentIndex];

	if (!currentSong) {
		songInfoElement.textContent = 'No songs loaded';
		songTimeElement.textContent = '';
		return;
	}

	songInfoElement.textContent = `Playing: ${currentSong.title}`;
	updateLibraryHighlight();
}

function loadSong(index, shouldPlay = true) {
	if (!songs.length) {
		return;
	}

	currentIndex = (index + songs.length) % songs.length;
	audio.src = songs[currentIndex].file;
	audio.currentTime = 0;
	seekBar.value = 0;
	updateNowPlaying();

	if (shouldPlay) {
		audio.play();
		isPlaying = true;
		setPlayButtonState(true);
		updateLibraryHighlight();
	}
}

function stopSong() {
	audio.pause();
	audio.currentTime = 0;
	isPlaying = false;
	setPlayButtonState(false);
	updateLibraryHighlight();
}

function renderSongs() {
	songListElement.innerHTML = '';

	const normalizedQuery = songSearchQuery.trim().toLowerCase();
	const visibleSongs = songs
		.map((song, index) => ({ song, index }))
		.filter(({ song }) => {
			if (!normalizedQuery) {
				return true;
			}

			const searchableText = `${song.title} ${getArtistName(song)}`.toLowerCase();
			return searchableText.includes(normalizedQuery);
		});

	if (!visibleSongs.length) {
		songListElement.innerHTML = '<li class="empty-state">No songs matched your search</li>';
		return;
	}

	visibleSongs.forEach(({ song, index }) => {
		const listItem = document.createElement('li');
		listItem.className = 'song-item';
		listItem.dataset.songIndex = String(index);
		listItem.innerHTML = `
			<img class="song-cover" src="${song.cover || 'https://i.scdn.co/image/ab67616d00001e0233bc5d16517fed8db985360c'}" alt="${song.title}">
			<button class="song-play" type="button" aria-label="Play ${song.title}">▶</button>
			<div class="song-copy">
				<strong class="song-title">${song.title}</strong>
					<span class="song-artist">${getArtistName(song)}</span>
			</div>
			${renderFavoriteButton(song.id)}
		`;
		listItem.querySelector('.song-play').addEventListener('click', (event) => {
			event.stopPropagation();
			loadSong(index);
		});
		listItem.querySelector('.song-favorite').addEventListener('click', (event) => {
			event.stopPropagation();
			toggleFavoriteSong(song.id);
		});
		listItem.addEventListener('click', () => loadSong(index));
		songListElement.appendChild(listItem);
	});

	updateLibraryHighlight();
}

function toggleSongSearchPanel() {
	songSearchPanel.classList.toggle('open');

	if (songSearchPanel.classList.contains('open')) {
		songSearchInput.focus();
	}
}

playButton.addEventListener('click', () => {
	if (!songs.length) {
		return;
	}

	if (!audio.src) {
		loadSong(currentIndex);
		return;
	}

	if (isPlaying) {
		audio.pause();
		isPlaying = false;
		setPlayButtonState(false);
	} else {
		audio.play();
		isPlaying = true;
		setPlayButtonState(true);
	}
});

nextButton.addEventListener('click', () => loadSong(currentIndex + 1));
prevButton.addEventListener('click', () => loadSong(currentIndex - 1));

audio.addEventListener('timeupdate', () => {
	if (Number.isFinite(audio.duration) && audio.duration > 0) {
		seekBar.value = String((audio.currentTime / audio.duration) * 100);
	}

	songTimeElement.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
});

audio.addEventListener('loadedmetadata', () => {
	seekBar.value = 0;
	songTimeElement.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
});

seekBar.addEventListener('input', () => {
	if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
		return;
	}

	audio.currentTime = (Number(seekBar.value) / 100) * audio.duration;
});

audio.addEventListener('ended', () => loadSong(currentIndex + 1));

audio.addEventListener('play', () => {
	isPlaying = true;
	setPlayButtonState(true);
	updateLibraryHighlight();
});

audio.addEventListener('pause', () => {
	isPlaying = false;
	setPlayButtonState(false);
	updateLibraryHighlight();
});

searchToggleButton.addEventListener('click', toggleSongSearchPanel);

songSearchInput.addEventListener('input', () => {
	songSearchQuery = songSearchInput.value;
	renderSongs();
});

songSearchInput.addEventListener('keydown', (event) => {
	if (event.key === 'Escape') {
		songSearchInput.value = '';
		songSearchQuery = '';
		renderSongs();
		songSearchPanel.classList.remove('open');
	}
});

fetch('songs.json')
	.then((response) => {
		if (!response.ok) {
			throw new Error(`Failed to load songs.json: ${response.status}`);
		}

		return response.json();
	})
	.then((data) => {
		songs = data;
		favoriteSongs = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
		renderSongs();
		renderFavoriteSongs();

		if (songs.length) {
			updateNowPlaying();
		}
	})
	.catch((error) => {
		console.error(error);
		songInfoElement.textContent = 'Could not load songs.json';
	});