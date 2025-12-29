/**
 * Premium Web Radio Player Logic
 * Handles streaming, fallback URLs, and metadata polling.
 */

const CONFIG = {
    urls: [
        "https://server.streamcasthd.com:7022",       // URL regular (metadatos)
        "https://server.streamcasthd.com/8056/stream", // URL directa SSL
        "https://server.streamcasthd.com/0/stream"    // Custom Play ID
    ],
    metadataInterval: 10000,
    retryDelay: 3000
};

class RadioPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentUrlIndex = 1; // Empezamos por la directa SSL para mejor compatibilidad inicial
        this.isPlaying = false;
        this.currentSong = null;

        // DOM Elements
        this.playBtn = document.getElementById('play-pause-btn');
        this.playIcon = document.getElementById('play-icon');
        this.pauseIcon = document.getElementById('pause-icon');
        this.volumeSlider = document.getElementById('volume-slider');
        this.statusBadge = document.getElementById('connection-status');
        this.statusText = this.statusBadge.querySelector('.text');
        this.trackTitle = document.getElementById('track-title');
        this.artistName = document.getElementById('artist-name');
        this.playerCard = document.querySelector('.glass-card');

        this.init();
    }

    init() {
        this.setupAudio();
        this.setupListeners();
        this.startMetadataPolling();

        // Initial volume
        this.audio.volume = this.volumeSlider.value;
    }

    setupAudio() {
        this.audio.crossOrigin = "anonymous";
        this.audio.src = CONFIG.urls[this.currentUrlIndex];

        this.audio.addEventListener('playing', () => {
            this.updateStatus('Conectado', 'connected');
            this.playerCard.classList.add('playing');
        });

        this.audio.addEventListener('waiting', () => {
            this.updateStatus('Buffering...', 'buffering');
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.handlePlaybackError();
        });

        this.audio.addEventListener('pause', () => {
            this.playerCard.classList.remove('playing');
        });
    }

    setupListeners() {
        this.playBtn.addEventListener('click', () => this.togglePlay());

        this.volumeSlider.addEventListener('input', (e) => {
            this.audio.volume = e.target.value;
        });
    }

    togglePlay() {
        if (this.isPlaying) {
            this.audio.pause();
            this.showPlayIcon();
        } else {
            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.showPauseIcon();
                }).catch(error => {
                    console.error("Playback failed:", error);
                    this.handlePlaybackError();
                });
            }
        }
        this.isPlaying = !this.isPlaying;
    }

    showPlayIcon() {
        this.playIcon.style.display = 'block';
        this.pauseIcon.style.display = 'none';
    }

    showPauseIcon() {
        this.playIcon.style.display = 'none';
        this.pauseIcon.style.display = 'block';
    }

    updateStatus(text, className) {
        this.statusText.textContent = text;
        this.statusBadge.className = `status-badge ${className}`;
    }

    handlePlaybackError() {
        this.updateStatus('Reconectando...', 'error');

        // Fallback logic
        this.currentUrlIndex = (this.currentUrlIndex + 1) % CONFIG.urls.length;
        console.log(`Switching to URL: ${CONFIG.urls[this.currentUrlIndex]}`);

        setTimeout(() => {
            this.audio.src = CONFIG.urls[this.currentUrlIndex];
            if (this.isPlaying) {
                this.audio.play().catch(() => { });
            }
        }, CONFIG.retryDelay);
    }

    async fetchMetadata() {
        try {
            const response = await fetch(CONFIG.urls[0] + '/stats?json=1', { mode: 'cors' });
            if (response.ok) {
                const data = await response.json();
                await this.updateUIWithMetadata(data);
            }
        } catch (error) {
            console.debug('Metadata fetch failed:', error);
        }
    }

    async updateUIWithMetadata(data) {
        if (data && data.songtitle) {
            const songTitle = data.songtitle;
            const parts = songTitle.split(' - ');
            const artist = parts[0] || 'Radio Stream';
            const track = parts[1] || '';

            // Solo buscar nueva portada si la canción cambió
            if (this.currentSong !== songTitle) {
                this.currentSong = songTitle;
                this.trackTitle.textContent = track || artist;
                this.artistName.textContent = track ? artist : 'En vivo';

                // Buscar portada en iTunes
                await this.fetchCoverArt(artist, track);
            }
        } else {
            this.trackTitle.textContent = "Streaming en vivo";
            this.artistName.textContent = "Radio Online";
        }
    }

    async fetchCoverArt(artist, track) {
        const query = `${artist} ${track}`.trim();
        const defaultCover = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80";
        const coverImg = document.getElementById('cover-image');

        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const artworkUrl = data.results[0].artworkUrl100.replace('100x100', '600x600');
                coverImg.src = artworkUrl;
            } else {
                coverImg.src = defaultCover;
            }
        } catch (error) {
            console.error('Error fetching cover art:', error);
            coverImg.src = defaultCover;
        }
    }

    startMetadataPolling() {
        this.fetchMetadata();
        setInterval(() => this.fetchMetadata(), CONFIG.metadataInterval);
    }
}

// Start the player
document.addEventListener('DOMContentLoaded', () => {
    window.player = new RadioPlayer();
});
