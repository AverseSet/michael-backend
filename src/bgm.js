const VOLUME_KEY = "michael_bgm_volume";
const ENABLED_KEY = "michael_bgm_enabled";
const PLAYLIST_TRACK_COUNT = 3;

let bgmAudio = null;
let currentMode = "regular";
let currentPlaylistIndex = 1;
let playlistActive = false;
let enabled = true;
let currentSource = "";
let waitingForUserGesture = false;

function getAudio() {
  if (!bgmAudio) {
    bgmAudio = new Audio();
    bgmAudio.preload = "auto";
  }
  return bgmAudio;
}

function getPlaylistTrack(index) {
  return localStorage.getItem(`michael_bgm_track_${index}`);
}

function findPlaylistTrack(startIndex) {
  for (let offset = 0; offset < PLAYLIST_TRACK_COUNT; offset += 1) {
    const index = ((startIndex - 1 + offset) % PLAYLIST_TRACK_COUNT) + 1;
    const source = getPlaylistTrack(index);
    if (source) return { index, source };
  }
  return null;
}

function hasModeOrPlaylistTrack(mode = currentMode) {
  return Boolean(
    localStorage.getItem(`bgm_${mode}`)
    || findPlaylistTrack(currentPlaylistIndex)
  );
}

function startSource(source, loop, onEnded) {
  const audio = getAudio();
  audio.volume = Number(localStorage.getItem(VOLUME_KEY) ?? 0.3);
  audio.loop = loop;
  audio.onended = onEnded;

  if (currentSource !== source) {
    audio.pause();
    audio.currentTime = 0;
    audio.src = source;
    currentSource = source;
  }

  audio.play().then(() => {
    waitingForUserGesture = false;
  }).catch((error) => {
    if (error.name === "NotAllowedError") {
      waitingForUserGesture = true;
      return;
    }
    console.error("Background music playback failed:", error);
  });
}

function startPlaylistAt(index) {
  const track = findPlaylistTrack(index);
  if (!track) {
    playlistActive = false;
    return false;
  }

  currentPlaylistIndex = track.index;
  playlistActive = true;
  const trackName = localStorage.getItem(`michael_bgm_name_${track.index}`)
    || `Michael-BGM${track.index}`;
  console.info(`[BGM Playlist] Playing: ${trackName}`);
  startSource(track.source, false, () => {
    const nextIndex = (track.index % PLAYLIST_TRACK_COUNT) + 1;
    startPlaylistAt(nextIndex);
  });
  return true;
}

function startCurrentMode() {
  const modeTrack = localStorage.getItem(`bgm_${currentMode}`);
  if (modeTrack) {
    playlistActive = false;
    startSource(modeTrack, true, null);
    return true;
  }

  return startPlaylistAt(currentPlaylistIndex);
}

function retryAfterUserGesture() {
  if (!waitingForUserGesture || !enabled) return;
  waitingForUserGesture = false;
  if (playlistActive) {
    startPlaylistAt(currentPlaylistIndex);
  } else {
    startCurrentMode();
  }
}

/**
 * Loads saved playback preferences and starts the regular soundtrack or playlist.
 */
export function initBGM() {
  const storedVolume = localStorage.getItem(VOLUME_KEY);
  const savedVolume = storedVolume === null ? 0.3 : Number(storedVolume);
  getAudio().volume = Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : 0.3;
  enabled = localStorage.getItem(ENABLED_KEY) !== "false";
  if (!enabled) return;

  startCurrentMode();
  document.addEventListener("pointerdown", retryAfterUserGesture);
  document.addEventListener("keydown", retryAfterUserGesture);
}

/**
 * Plays a mode-specific track, or the saved playlist when that mode has no custom track.
 * @param {'regular' | 'serious' | 'awaken'} mode
 */
export function setBGMMode(mode) {
  currentMode = mode.toLowerCase();
  if (!enabled) return hasModeOrPlaylistTrack(currentMode);
  return startCurrentMode();
}

export function playPlaylistTrack(index) {
  if (!Number.isInteger(index) || index < 1 || index > PLAYLIST_TRACK_COUNT) {
    throw new RangeError(`Playlist track must be between 1 and ${PLAYLIST_TRACK_COUNT}.`);
  }
  if (!getPlaylistTrack(index)) return false;
  enabled = true;
  localStorage.setItem(ENABLED_KEY, "true");
  return startPlaylistAt(index);
}

export function setBGMEnabled(shouldEnable) {
  enabled = shouldEnable;
  localStorage.setItem(ENABLED_KEY, String(shouldEnable));
  if (!shouldEnable) {
    waitingForUserGesture = false;
    playlistActive = false;
    currentSource = "";
    if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
    }
    return false;
  }
  return startCurrentMode();
}

export function stopBGM() {
  setBGMEnabled(false);
}

export function isBGMEnabled() {
  return enabled;
}

export function setBGMVolume(volumeLevel) {
  const volume = Math.max(0, Math.min(1, volumeLevel));
  localStorage.setItem(VOLUME_KEY, String(volume));
  getAudio().volume = volume;
}

export function getCurrentMode() {
  return currentMode;
}
