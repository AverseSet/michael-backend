// BGM Audio Controller Module

let bgmAudio = new Audio();
bgmAudio.loop = true; // Loop background music continuously
let currentMode = "regular";

/**
 * Initialize BGM system and load tracks saved in localStorage
 */
export function initBGM() {
  bgmAudio.volume = 0.3; // Set default BGM volume to 30% so voice TTS remains clear
}

/**
 * Play music for a specific operational mode
 * @param {'regular' | 'serious' | 'awaken'} mode 
 */
export function setBGMMode(mode) {
  const modeKey = mode.toLowerCase();
  const trackUrl = localStorage.getItem(`bgm_${modeKey}`);

  if (!trackUrl) {
    console.warn(`No BGM track uploaded for ${modeKey} mode.`);
    return false;
  }

  currentMode = modeKey;
  bgmAudio.src = trackUrl;
  bgmAudio.play().catch((err) => {
    console.error("Autoplay blocked or audio load error:", err);
  });

  return true;
}

/**
 * Stop/Pause currently playing BGM track
 */
export function stopBGM() {
  bgmAudio.pause();
  bgmAudio.currentTime = 0;
}

/**
 * Adjust BGM volume
 * @param {number} volumeLevel - Floating point between 0.0 and 1.0
 */
export function setBGMVolume(volumeLevel) {
  bgmAudio.volume = Math.max(0, Math.min(1, volumeLevel));
}

/**
 * Retrieve current mode string
 */
export function getCurrentMode() {
  return currentMode;
}