import "./style.css";
import {
  analyzeScreen,
  getAIProvider,
  getAIProviderSettings,
  isAIProviderConfigured,
  runQuery,
  saveAIProviderSettings,
  setAIProvider
} from "./ai.js";
import { handleCommand } from "./commands.js";
import { initBGM, isBGMEnabled, playPlaylistTrack, setBGMEnabled, setBGMMode, setBGMVolume } from "./bgm.js";
import { gameProfiles } from "./gamesConfig.js";
import { buildMemoryContext, getCampfireLocation, getPlayerMemoryAnswer, newServer, observePlayer, rememberFact, saveCampfireLocation, clearPermanentMemoryCompletely } from "./memory.js";
import { parseVisionReport } from "./visionReport.js";
import { toSpeechText } from "./speechText.js";
import { parseVisualTargetCommand } from "./visualTargetCommands.js";
import { formatChatText } from "./chatFormatting.js";
import {
  clearPersonalProviderKeys,
  getConfiguredPersonalProviders,
  PERSONAL_AI_PROVIDERS,
  savePersonalProviderKeys
} from "./localAiFallback.js";
import { createAmongUsTracker, getAmongUsSuspects, updateAmongUsTracker } from "./amongUsTracker.js";
import { initTacticalRecorder, stopTacticalRecorder } from "./recorder.js";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { SpeechRecognition as NativeSpeechRecognition } from "@capacitor-community/speech-recognition";
import { SpeechSynthesis as NativeSpeechSynthesis } from "@capgo/capacitor-speech-synthesis";

let liveVisionActive = false;
let screenStream = null;
let nativeScreenCaptureActive = false;
let latestVisionFrame = null;
let microphoneListening = false;
const NativeScreenCapture = registerPlugin("ScreenCapture");
const NativeFloatingOverlay = registerPlugin("FloatingOverlay");
let pendingVisionStart = false;
let activeMode = "regular";
let currentGameKey = localStorage.getItem("michael_game_profile") || "bloxfruits";
let isRecordingActive = false;
let recentConversation = [];
let amongUsTracker = createAmongUsTracker();
const LIVE_VISION_INTERVAL_MS = 15000;
const TARGET_VISION_INTERVAL_MS = 5000;
let activeVisualTarget = null;
let currentVisibleMarker = null;

// --- 99 NIGHTS CAMPFIRE STATE ---
let campfireData = {
  isLocated: false,
  locationCoordinates: getCampfireLocation(),
  fuelLevel: 100
};

if (campfireData.locationCoordinates) {
  campfireData.isLocated = true;
}

const savedVolumeLevel = Number(localStorage.getItem("michael_bgm_volume") ?? 0.3);
let currentVolumeLevel = Number.isFinite(savedVolumeLevel) ? Math.max(0, Math.min(1, savedVolumeLevel)) : 0.3;

const deploymentGreetings = [
  "Ready for deployment, Captain. Systems fully operational.",
  "All tactical protocols online. Let's hunt some bounties, Captain.",
  "Neural link established. Michael AI standing by for operations.",
  "Weapons hot and vision stream calibrated. Ready when you are, Captain.",
  "Server connection secured. Ready to track objectives and eliminate threats.",
  "Combat matrix active. Let's dominate the mission today, Captain.",
  "All subroutines synced. Michael reporting for duty.",
  "Sensors online. Scanning for rare targets and hostile players.",
  "Tactical co-pilot active. Your orders, Captain?",
  "System diagnostics green. Ready to secure victory.",
  "Audio and vision engines humming. Let's make some progress, Captain.",
  "Target acquisition protocols loaded. Standing by for engagement.",
  "Tracking systems online. Let's rise through the ranks.",
  "Core AI initialized. Ready to assist your gameplay journey, Captain.",
  "Live feed ready. No threat escapes our notice today.",
  "All systems synchronized. Let's claim victory, Captain.",
  "Network stable, co-pilot ready. What's first objective?",
  "Combat assistance online. Let's clear out the opposition.",
  "Readiness check complete. Michael standing by for tactical command.",
  "Power levels nominal. Let's conquer the match, Captain."
];

const randomGreeting = deploymentGreetings[Math.floor(Math.random() * deploymentGreetings.length)];

// RENDER FULL APPLICATION UI INSIDE #app
document.querySelector("#app").innerHTML = `
  <div id="loader" style="opacity: 0; display: none;">
    <div class="spinner"></div>
    <p id="loaderText">Initializing Michael AI Systems...</p>
  </div>

  <div class="app-container">
    <aside id="slideSidebar" class="slide-sidebar">
      <div class="sidebar-header">
        <h3>⚔️ Menu</h3>
        <button id="closeSidebarBtn" style="background:none; border:none; color:#fff; cursor:pointer; font-size:1.2rem;">✕</button>
      </div>
      <nav class="sidebar-nav">
        <button id="navChat" class="active">💬 Chat & Vision</button>
        <button id="navGames">🎮 Game Profiles</button>
        <button id="navTutorial">📖 Tutorial</button>
        <button id="navNotes">📝 Captain's Notes</button>
        <button id="navSettings">⚙️ Settings</button>
      </nav>
    </aside>

    <div class="main-wrapper">
      <header class="app-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="sidebarToggleBtn">☰</button>
          <div class="header-title">
            <h1>MICHAEL</h1>
            <span class="subtitle">Multi-Game AI Co-Pilot</span>
          </div>
        </div>
      </header>

      <main class="main-content">
        <div id="chatPage" class="page-view active">
          <div class="live-vision-bar" style="display: flex; justify-content: space-between; align-items: center; background: #181824; padding: 10px 15px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #2d2d42;">
            <div class="live-vision-actions" style="display: flex; align-items: center; gap: 10px;">
              <button id="toggleVisionBtn" class="action-btn">🎥 Start Live Vision</button>
              <button id="floatingOverlayBtn" class="action-btn">📱 Floating Michael</button>
              <button id="toggleRecordBtn" class="action-btn" style="display: none;">🔴 Record Session</button>
              <span id="visionStatus" style="color: #b2bec3; font-weight: bold; font-size: 0.9rem;">Live Feed: OFF</span>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
              <div id="campfireHud" style="display: none; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; color: #fff; border: 1px solid #ff4500;">
                🔥 Campfire: <span id="fireMeterText">${campfireData.isLocated ? "Tracked" : "Not Found"}</span>
              </div>
              <span id="visionLatency" style="color: #74b9ff; font-size: 0.85rem; font-family: monospace;">Mode: STANDARD</span>
            </div>
          </div>

          <div id="liveFeedBox" style="background: #0f0f17; padding: 10px 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #6c5ce7;">
            <p id="liveFeedText" style="color: #dfe6e9; font-size: 0.9rem; margin: 0;">Awaiting vision initialization...</p>
          </div>
          <section id="amongUsHud" class="among-us-hud" aria-live="polite" hidden>
            <strong>Among Us — visual suspicion estimates</strong>
            <p id="amongUsEvidence">Watching for shared-room clues and reported bodies.</p>
            <div id="amongUsSuspects"></div>
            <small>Estimates use visible clues only; they are not proof of who the Impostor is.</small>
          </section>

          <div id="chatBox" class="chat-box">
            <div class="message michael">
              <span class="sender">Michael:</span>
              <p>${randomGreeting}</p>
            </div>
          </div>

          <div class="input-area" style="display: flex; align-items: center; gap: 10px;">
            <input type="text" id="userInput" placeholder="Ask Michael or speak your command..." style="flex: 1;" />
            <button id="micBtn" title="Speak to Michael" style="width: 45px; height: 42px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; border-radius: 8px; background: #1e293b; border: 1px solid #475569; color: #fff; cursor: pointer;">🎤</button>
            <button id="sendBtn" class="action-btn" style="width: 80px; height: 42px; padding: 0; font-size: 0.95rem; border-radius: 8px;">Send</button>
          </div>
        </div>

        <div id="gamesPage" class="page-view">
          <h2>🎮 Active Game Context</h2>
          <div class="setting-group" style="margin-top: 15px;">
            <label>Select Active Game Profile:</label>
            <select id="gameProfileSelect" class="custom-select" style="margin-top: 5px; width: 100%;">
              <option value="bloxfruits">Blox Fruits (Roblox)</option>
              <option value="amongus">Among Us</option>
              <option value="ninetynine">99 Nights In The Forest (Roblox)</option>
            </select>
          </div>
          <div id="gameContextDetails" style="margin-top: 20px; background: #1e1e2f; padding: 20px; border-radius: 8px;">
            <p>Currently tracking: <strong id="activeGameTitle">Blox Fruits (Roblox)</strong></p>
            <p id="gameContextDesc" style="color: #b2bec3; margin-top: 10px; line-height: 1.6;">Sea 1: 1-700 | Sea 2: 700-1500 | Sea 3: 1500+</p>
          </div>
        </div>

        <div id="tutorialPage" class="page-view">
          <h2>📖 Michael AI Captain's Tutorial</h2>
          <p style="color: #b2bec3; margin-top: 5px;">Master your multi-game AI co-pilot with this quick operational guide.</p>
          
          <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 15px;">
            <div style="background: #181824; padding: 15px; border-radius: 8px; border-left: 4px solid #38bdf8;">
              <h3 style="color: #fff; margin-bottom: 5px;">1. Chat & Live Vision</h3>
              <p style="color: #b2bec3; font-size: 0.9rem; line-height: 1.5;">Click <strong>Start Live Vision</strong> to stream your gameplay. Tap <strong>Floating Michael</strong> and allow display-over-other-apps permission to use the square bubble over Roblox. Tap the bubble to open the 16:9 controls for speaking, screen sharing, and chat.</p>
            </div>

            <div style="background: #181824; padding: 15px; border-radius: 8px; border-left: 4px solid #6c5ce7;">
              <h3 style="color: #fff; margin-bottom: 5px;">2. Game Profiles</h3>
              <p style="color: #b2bec3; font-size: 0.9rem; line-height: 1.5;">Switch between supported titles under the <strong>Game Profiles</strong> tab to adapt Michael's tracking metrics to your current game.</p>
            </div>

            <div style="background: #181824; padding: 15px; border-radius: 8px; border-left: 4px solid #f43f5e;">
              <h3 style="color: #fff; margin-bottom: 5px;">3. Modes & Soundtracks</h3>
              <p style="color: #b2bec3; font-size: 0.9rem; line-height: 1.5;">Configure background audio tracks and playlists in Settings. Use <code>!mode awaken</code> for real-time zero-delay visual alerts.</p>
            </div>
          </div>
        </div>

        <div id="notesPage" class="page-view">
          <h2>📝 Captain's Notes</h2>
          <p style="color: #b2bec3;">Jot down strategies, task lists, or trade plans:</p>
          <textarea id="notesTextarea" placeholder="Type your tactical notes here..."></textarea>
        </div>

        <div id="settingsPage" class="page-view">
          <h2>⚙️ System & Audio Settings</h2>

          <div class="setting-group" style="background: #181824; padding: 15px; border-radius: 8px; border: 1px solid #6c5ce7; margin: 15px 0 20px;">
            <label for="aiProviderSettingsSelect" style="color: #a29bfe; font-weight: bold; display: block; margin-bottom: 5px;">AI provider</label>
            <select id="aiProviderSettingsSelect" class="custom-select" style="width: 100%; margin: 6px 0 10px;">
              <option value="personalFallback">My API keys (on-device fallback)</option>
              <option value="gemini">Gemini (Google AI Studio)</option>
              <option value="groq">Qwen via Groq</option>
              <option value="ollama">Ollama (your own server)</option>
              ${PERSONAL_AI_PROVIDERS.filter(({ id }) => !["gemini", "groq"].includes(id)).map(({ id, name, model }) => `<option value="${id}">${name} (${model})</option>`).join("")}
            </select>
            <p id="aiProviderStatus" style="color: #b2bec3; font-size: 0.85rem; margin-bottom: 10px;"></p>
            <p style="color: #b2bec3; font-size: 0.85rem; margin-bottom: 10px;">Add your own provider API keys. Keys are saved on this device and requests go directly from the app to your selected AI provider. Ollama uses your own server URL.</p>
            <button id="manageAIProviderBtn" class="action-btn">Set up AI provider</button>
          </div>

          <div class="setting-group">
            <label for="targetMarkerStyleSelect">On-screen target marker</label>
            <select id="targetMarkerStyleSelect" class="custom-select">
              <option value="arrow">Arrow + label</option>
              <option value="ring">Target ring + label</option>
              <option value="crosshair">Crosshair + label</option>
            </select>
            <small style="color: #b2bec3; line-height: 1.5;">Landmarks are re-detected from live frames and marked only while visible. This is a screen marker, not off-screen compass navigation.</small>
          </div>

          <div class="setting-group" style="background: #181824; padding: 15px; border-radius: 8px; border: 1px solid #e17055; margin-bottom: 20px;">
            <label style="color: #ff7675; font-weight: bold; display: block; margin-bottom: 5px;">⚠️ Permanent Memory Management</label>
            <p style="color: #b2bec3; font-size: 0.85rem; margin-bottom: 10px;">Wipe permanent long-term memory data (such as campfire location anchors and saved player states).</p>
            <button id="openClearMemoryModalBtn" class="action-btn">Clear Memory</button>
          </div>

          <div class="setting-group" style="background: #181824; padding: 15px; border-radius: 8px; border: 1px solid #6c5ce7; margin-bottom: 20px;">
            <label style="color: #38bdf8; font-weight: bold; display: block; margin-bottom: 5px;">💬 Contact Us on Discord</label>
            <p style="color: #b2bec3; font-size: 0.85rem; margin-bottom: 10px;">Join our community server to get support, share feedback, and connect with other captains!</p>
            <a href="https://discord.gg/cRXk3Pz8S" target="_blank" style="display: inline-block; padding: 8px 16px; background: #5865F2; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">Open Discord Invite</a>
          </div>

          <div class="setting-group">
            <label>👁️ Live Vision Startup Behavior:</label>
            <div style="display: flex; align-items: center; gap: 15px; margin-top: 8px;">
              <select id="visionAutoStartSelect" class="custom-select">
                <option value="manual">Manual (Click button to start)</option>
                <option value="auto">Always On (Auto-start on launch)</option>
              </select>
              <span id="visionModeHint" class="file-name-label">Manual mode active</span>
            </div>
          </div>

          <div class="setting-group" style="margin-top: 20px;">
            <label>🔊 Global Sound & Volume Control:</label>
            <div style="display: flex; align-items: center; gap: 15px; margin-top: 8px; flex-wrap: wrap;">
              <input type="range" id="bgmVolumeSlider" min="0" max="1" step="0.05" value="${currentVolumeLevel}" style="flex: 1; cursor: pointer;" />
              <span id="volumePercentageLabel" style="color: #38bdf8; font-family: monospace; min-width: 45px;">${Math.round(currentVolumeLevel * 100)}%</span>
              <button id="muteAudioBtn" class="action-btn">Stop BGM</button>
            </div>
          </div>

          <div class="setting-group">
            <label>🎵 Michael-BGM1 (Track 1):</label>
            <div class="custom-file-row">
              <input type="file" id="bgm1AudioInput" accept="audio/*" />
              <button id="playBgm1Btn" class="action-btn">▶️ Play BGM1</button>
              <span id="bgm1FileName" class="file-name-label">No track selected</span>
            </div>
          </div>

          <div class="setting-group">
            <label>🎵 Michael-BGM2 (Track 2):</label>
            <div class="custom-file-row">
              <input type="file" id="bgm2AudioInput" accept="audio/*" />
              <button id="playBgm2Btn" class="action-btn">▶️ Play BGM2</button>
              <span id="bgm2FileName" class="file-name-label">No track selected</span>
            </div>
          </div>

          <div class="setting-group">
            <label>🎵 Michael-BGM3 (Track 3):</label>
            <div class="custom-file-row">
              <input type="file" id="bgm3AudioInput" accept="audio/*" />
              <button id="playBgm3Btn" class="action-btn">▶️ Play BGM3</button>
              <span id="bgm3FileName" class="file-name-label">No track selected</span>
            </div>
          </div>

          <div class="setting-group">
            <label>🎵 Regular Mode Sound:</label>
            <div class="custom-file-row">
              <input type="file" id="regularAudioInput" accept="audio/*" />
              <button id="playRegularBtn" class="action-btn">▶️ Play Regular</button>
              <span id="regularFileName" class="file-name-label">No track selected</span>
            </div>
          </div>

          <div class="setting-group">
            <label>⚡ Serious Mode Sound:</label>
            <div class="custom-file-row">
              <input type="file" id="seriousAudioInput" accept="audio/*" />
              <button id="playSeriousBtn" class="action-btn">▶️ Play Serious</button>
              <span id="seriousFileName" class="file-name-label">No track selected</span>
            </div>
          </div>

          <div class="setting-group">
            <label>🔥 Awaken Mode Sound:</label>
            <div class="custom-file-row">
              <input type="file" id="awakenAudioInput" accept="audio/*" />
              <button id="playAwakenBtn" class="action-btn">▶️ Play Awaken</button>
              <span id="awakenFileName" class="file-name-label">No track selected</span>
            </div>
          </div>
        </div>
      </main>

      <footer style="text-align: center; padding: 10px; font-size: 11px; color: #888; border-top: 1px solid #1f1f2e; background: #12121c;">
        Michael is AI and answers can be wrong.
      </footer>
    </div>
  </div>

  <div id="clearMemoryModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; justify-content: center; align-items: center;">
    <div style="background: #1e1e2f; padding: 25px; border-radius: 10px; text-align: center; max-width: 320px; border: 1px solid #475569; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <p style="margin-bottom: 20px; font-size: 0.95rem; color: #fff; line-height: 1.5;">Are you sure you want to clear this? Can't be undone?</p>
      <div style="display: flex; justify-content: center; gap: 10px;">
        <button id="confirmClearMemoryBtn" class="action-btn">Okay</button>
        <button id="cancelClearMemoryBtn" style="background: #475569; color: white; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer;">Cancel</button>
      </div>
    </div>
  </div>

  <div id="aiProviderModal" role="dialog" aria-modal="true" aria-labelledby="aiProviderModalTitle" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 10000; justify-content: center; align-items: center; padding: 20px;">
    <div style="width: min(100%, 420px); max-height: 90vh; overflow-y: auto; background: #1e1e2f; border: 1px solid #6c5ce7; border-radius: 12px; padding: 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <h2 id="aiProviderModalTitle" style="color: #a29bfe; margin-bottom: 10px;">Choose an AI provider</h2>
      <p style="color: #fff; line-height: 1.5; margin-bottom: 14px;">Choose a provider or on-device fallback rotation and enter your own API keys. Keys are saved only on this device and sent directly to the selected AI provider.</p>
      <label for="aiProviderModalSelect">Provider</label>
      <select id="aiProviderModalSelect" class="custom-select" style="width: 100%; margin: 6px 0 12px;">
        <option value="personalFallback">My API keys (on-device fallback)</option>
        <option value="gemini">Gemini</option>
        <option value="groq">Qwen via Groq</option>
        <option value="ollama">Ollama</option>
        ${PERSONAL_AI_PROVIDERS.filter(({ id }) => !["gemini", "groq"].includes(id)).map(({ id, name, model }) => `<option value="${id}">${name} (${model})</option>`).join("")}
      </select>
      <div id="personalFallbackFields" hidden>
        <p id="personalFallbackDescription" style="color: #b2bec3; line-height: 1.5; margin-bottom: 12px;">Enter provider keys you own. They are saved on this device and requests go directly from the app to each provider. Keys are not uploaded to Michael or Netlify.</p>
        <div id="personalProviderKeyFields"></div>
        <button id="clearPersonalKeysBtn" class="action-btn" type="button" style="margin-top: 10px;">Clear all saved personal keys</button>
      </div>
      <div id="geminiProviderFields">
        <label for="geminiKeyInput">Gemini API key</label>
        <input id="geminiKeyInput" type="password" autocomplete="off" placeholder="Paste your Gemini API key" style="width: 100%; padding: 12px; color: #fff; background: #0f0f17; border: 1px solid #6c5ce7; border-radius: 8px;" />
        <small id="geminiKeyStatus" style="display: block; color: #b2bec3; margin-top: 5px;">Not saved on this device</small>
        <label for="geminiModelInput" style="margin-top: 10px;">Gemini model (default: gemini-3.5-flash)</label>
        <input id="geminiModelInput" type="text" autocomplete="off" style="width: 100%; padding: 12px; color: #fff; background: #0f0f17; border: 1px solid #6c5ce7; border-radius: 8px;" />
      </div>
      <div id="groqProviderFields" hidden>
        <label for="groqKeyInput">Groq API key (Qwen)</label>
        <input id="groqKeyInput" type="password" autocomplete="off" placeholder="Paste your Groq API key" style="width: 100%; padding: 12px; color: #fff; background: #0f0f17; border: 1px solid #6c5ce7; border-radius: 8px;" />
        <small id="groqKeyStatus" style="display: block; color: #b2bec3; margin-top: 5px;">Not saved on this device</small>
        <label for="groqModelInput" style="margin-top: 10px;">Groq model (default: qwen/qwen3.8-27b)</label>
        <input id="groqModelInput" type="text" autocomplete="off" style="width: 100%; padding: 12px; color: #fff; background: #0f0f17; border: 1px solid #6c5ce7; border-radius: 8px;" />
      </div>
      <div id="ollamaProviderFields" hidden>
        <label for="ollamaUrlInput">Ollama server URL</label>
        <input id="ollamaUrlInput" type="url" autocomplete="url" placeholder="http://localhost:11434" style="width: 100%; padding: 12px; color: #fff; background: #0f0f17; border: 1px solid #6c5ce7; border-radius: 8px;" />
        <label for="ollamaModelInput" style="margin-top: 10px;">Installed vision model (example: qwen3-vl:8b)</label>
        <input id="ollamaModelInput" type="text" autocomplete="off" style="width: 100%; padding: 12px; color: #fff; background: #0f0f17; border: 1px solid #6c5ce7; border-radius: 8px;" />
        <small style="display: block; color: #b2bec3; line-height: 1.4; margin-top: 8px;">For Android, localhost means the phone. Use a reachable HTTPS server address and allow Michael’s origin (https://localhost in the APK) in Ollama’s OLLAMA_ORIGINS setting.</small>
      </div>
      <p id="aiProviderError" role="alert" style="color: #ff7675; min-height: 20px; margin-top: 8px;"></p>
      <div style="display: flex; gap: 10px;">
        <button id="saveAIProviderBtn" class="action-btn" style="flex: 1;">Save &amp; Continue</button>
        <button id="cancelAIProviderBtn" class="action-btn" style="flex: 1; background: #2d2d42;">Cancel</button>
      </div>
    </div>
  </div>

  <div id="floatingOverlayHelp" role="dialog" aria-modal="true" aria-labelledby="floatingOverlayHelpTitle">
    <div class="floating-overlay-help-card">
      <h2 id="floatingOverlayHelpTitle">Allow floating Michael</h2>
      <p>Android needs permission to display Michael over Roblox and other apps. On the next screen, enable “Allow display over other apps,” then return to Michael.</p>
      <button id="floatingOverlayPermissionBtn" class="action-btn">Open Android Settings</button>
      <button id="floatingOverlayCancelBtn" class="action-btn">Cancel</button>
    </div>
  </div>
`;

const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");

if (loader) {
  loader.style.display = "flex";
  loader.style.opacity = "1";

  if (loaderText) loaderText.textContent = "Initializing Michael AI Systems...";

  setTimeout(() => {
    if (loaderText) loaderText.textContent = "Calibrating Video Vision & Frame Analyzers...";
  }, 1000);

  setTimeout(() => {
    if (loaderText) loaderText.textContent = "Establishing Neural Uplink...";
  }, 2000);

  setTimeout(() => {
    loader.style.opacity = "0";
    setTimeout(() => { loader.style.display = "none"; }, 500);
  }, 3000);
}

initBGM();

async function speakText(text) {
  try {
    const speechText = toSpeechText(text);
    if (!speechText) return;

    const speechRate = {
      awaken: 2.5,
      serious: 2,
      regular: 1.5
    }[activeMode] || 1.5;

    if (Capacitor.isNativePlatform()) {
      await NativeSpeechSynthesis.cancel();
      const { voices } = await NativeSpeechSynthesis.getVoices();
      const englishVoices = Array.isArray(voices) ? voices.filter((voice) => (voice.language || '').toLowerCase().startsWith('en')) : [];

      const maleVoice = englishVoices.find((voice) => (voice.gender || '').toLowerCase() === 'male')
        || englishVoices.find((voice) => /(male|david|mark|daniel|alex|guy|george|michael|-tpd\b)/i.test(`${voice.name || ''} ${voice.id || ''}`))
        || englishVoices[0];

      const voice = maleVoice || englishVoices[0];

      await NativeSpeechSynthesis.speak({
        text: speechText,
        language: voice?.language || 'en-US',
        voiceId: voice?.id,
        rate: speechRate,
        pitch: 0.9,
        volume: 1,
        queueStrategy: 'Flush'
      });
      return;
    }

    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find((voice) => (voice.lang || '').toLowerCase().startsWith('en') && ((voice.name || '').toLowerCase().includes('male') || (voice.voiceURI || '').toLowerCase().includes('male')))
      || voices.find((voice) => (voice.lang || '').toLowerCase().startsWith('en') && (voice.name || '').toLowerCase().includes('david'))
      || voices.find((voice) => (voice.lang || '').toLowerCase().startsWith('en') && (voice.name || '').toLowerCase().includes('male'))
      || voices.find((voice) => (voice.lang || '').toLowerCase().startsWith('en') && (voice.name || '').toLowerCase().includes('natural'))
      || voices.find((voice) => (voice.lang || '').toLowerCase().startsWith('en'));

    if (maleVoice) utterance.voice = maleVoice;
    utterance.rate = speechRate;
    utterance.pitch = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Speech Synthesis Error:', err);
  }
}

const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const userInput = document.getElementById("userInput");
const floatingOverlayButton = document.getElementById("floatingOverlayBtn");
const floatingOverlayHelp = document.getElementById("floatingOverlayHelp");
const floatingOverlayPermissionButton = document.getElementById("floatingOverlayPermissionBtn");
const floatingOverlayCancelButton = document.getElementById("floatingOverlayCancelBtn");

if (!Capacitor.isNativePlatform() && floatingOverlayButton) {
  floatingOverlayButton.style.display = "none";
}

async function showFloatingOverlay() {
  try {
    const permission = await NativeFloatingOverlay.requestPermission();
    if (!permission.granted) {
      floatingOverlayHelp.style.display = "flex";
      return;
    }
    await NativeFloatingOverlay.show({
      listening: microphoneListening,
      visionActive: liveVisionActive
    });
    addMessage("michael", "Android display-over-other-apps permission is active. Michael’s floating controls and detected target markers can now appear over Roblox.");
    if (activeVisualTarget && !liveVisionActive) await startVisionStream();
  } catch (error) {
    console.error("Unable to show Michael's floating controls:", error);
    addMessage("michael", `Floating Michael could not start: ${error.message}`);
  }
}

if (floatingOverlayButton) {
  floatingOverlayButton.onclick = async () => {
    if (Capacitor.getPlatform() !== "android") {
      addMessage("michael", "Floating Michael over other apps is available in the Android app.");
      return;
    }

    try {
      const permission = await NativeFloatingOverlay.requestPermission();
      if (!permission.granted) {
        floatingOverlayHelp.style.display = "flex";
        return;
      }
      await NativeFloatingOverlay.show({
        listening: microphoneListening,
        visionActive: liveVisionActive
      });
      addMessage("michael", "Android can display Michael over other apps. Floating controls and detected target markers can appear over Roblox; tap the bubble to open the controls.");
      if (activeVisualTarget && !liveVisionActive) await startVisionStream();
    } catch (error) {
      console.error("Unable to show Michael's floating controls:", error);
      addMessage("michael", `Floating Michael could not start: ${error.message}`);
    }
  };
}

if (floatingOverlayPermissionButton) {
  floatingOverlayPermissionButton.onclick = async () => {
    floatingOverlayHelp.style.display = "none";
    await showFloatingOverlay();
  };
}

if (floatingOverlayCancelButton) {
  floatingOverlayCancelButton.onclick = () => {
    floatingOverlayHelp.style.display = "none";
  };
}

if (Capacitor.isNativePlatform()) {
  NativeFloatingOverlay.addListener("overlayAction", async ({ action, text }) => {
    if (action === "microphone") {
      micBtn.click();
    } else if (action === "screen") {
      document.getElementById("toggleVisionBtn").click();
    } else if (action === "send" && typeof text === "string" && text.trim()) {
      userInput.value = text.trim();
      await handleSendMessage();
    }
  }).catch((error) => {
    console.error("Unable to listen for floating Michael controls:", error);
  });
}

function addMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;
  
  const senderSpan = document.createElement("span");
  senderSpan.className = "sender";
  senderSpan.textContent = sender === "user" ? "You:" : "Michael:";

  const textP = document.createElement("p");
  textP.innerHTML = formatChatText(text);

  msgDiv.appendChild(senderSpan);
  msgDiv.appendChild(textP);
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function setNativeTargetMarker({ visible, label = "", screenX = 0.5, screenY = 0.5 }) {
  currentVisibleMarker = visible ? { label, screenX, screenY } : null;
  if (Capacitor.getPlatform() !== "android") return;
  const selectedStyle = localStorage.getItem("michael_target_marker_style");
  const style = ["arrow", "ring", "crosshair"].includes(selectedStyle) ? selectedStyle : "arrow";
  await NativeFloatingOverlay.setMarker({ visible, label, screenX, screenY, style });
}

async function handleVisualTargetCommand(command) {
  if (command.type === "clear") {
    activeVisualTarget = null;
    await setNativeTargetMarker({ visible: false }).catch((error) => {
      console.error("Unable to clear the target marker:", error);
    });
    const message = "Target marker cleared.";
    addMessage("michael", message);
    speakText(message);
    return;
  }

  activeVisualTarget = {
    label: command.target,
    type: command.type
  };
  const confirmation = command.type === "pin"
    ? "I’ll place a pin at the center of the screen. This is a screen position, not a saved world coordinate."
    : `I’ll look for ${command.target} and show its marker only while it is visible. Start Live Vision and grant Android screen-sharing permission when prompted.`;
  addMessage("michael", confirmation);
  speakText(confirmation);

  if (Capacitor.getPlatform() !== "android") {
    const message = "On-screen markers over another app are available in the Android app. Start Floating Michael and allow display over other apps.";
    addMessage("michael", message);
    return;
  }

  try {
    const permission = await NativeFloatingOverlay.requestPermission();
    if (!permission.granted) {
      floatingOverlayHelp.style.display = "flex";
      addMessage("michael", "Android must allow Michael to display over other apps before an arrow can appear over Roblox. Tap Open Android Settings, enable the permission, then return here.");
      return;
    }
    await NativeFloatingOverlay.show({
      listening: microphoneListening,
      visionActive: liveVisionActive
    });
    if (command.type === "pin") {
      await setNativeTargetMarker({ visible: true, label: command.target, screenX: 0.5, screenY: 0.5 });
    } else if (!liveVisionActive) {
      await startVisionStream();
    }
  } catch (error) {
    console.error("Unable to enable the target marker:", error);
    addMessage("michael", `Android overlay could not start: ${error.message}`);
  }
}

async function processUserCommand(text) {
  if (!text) return;

  const visualTargetCommand = parseVisualTargetCommand(text);
  if (visualTargetCommand) {
    addMessage("user", text);
    await handleVisualTargetCommand(visualTargetCommand);
    return;
  }

  const rememberedFact = /^(?:remember(?: that)?\s+)?([A-Za-z0-9_]{1,20})\s+has\s+([A-Za-z0-9][A-Za-z0-9 _'-]{0,39})[.!?]*$/i.exec(text.trim());
  if (rememberedFact) {
    const [, player, item] = rememberedFact;
    const fact = `${player} has ${item.trim()}`;
    rememberFact(player, fact);
    addMessage("user", text);
    const confirmation = `Got it. I’ll remember that ${fact}.`;
    addMessage("michael", confirmation);
    speakText(confirmation);
    return;
  }

  const rememberedPlayerQuestion = /^(?:what does|what has)\s+([A-Za-z0-9_]{1,20})\s+(?:have|own|use|equip)\??$/i.exec(text.trim());
  if (rememberedPlayerQuestion) {
    const [, player] = rememberedPlayerQuestion;
    const answer = getPlayerMemoryAnswer(player);
    if (answer) {
      addMessage("user", text);
      addMessage("michael", answer);
      speakText(answer);
      return;
    }
  }

  if (text.toLowerCase().startsWith("!mode ")) {
    addMessage("user", text);
    const requestedMode = text.split(" ")[1].toLowerCase();
    switchModeWithFeedback(requestedMode);
    return;
  }

  const commandResult = handleCommand(text);
  if (commandResult) {
    addMessage("user", text);
    addMessage("michael", commandResult);
    speakText(commandResult);
    return;
  }

  if (!isAIProviderConfigured()) {
    userInput.value = text;
    openAIProviderModal();
    return;
  }

  addMessage("user", text);
  const memoryContext = [
    `Active game: ${gameProfiles[currentGameKey].name}. Use its rules for this answer.`,
    buildMemoryContext(text),
    recentConversation.length
      ? `Recent conversation for short-term context:\n${recentConversation.map(({ role, text: message }) => `${role}: ${message}`).join("\n")}`
      : ""
  ].filter(Boolean).join("\n\n");
  const response = await runQuery(
    text,
    memoryContext,
    liveVisionActive ? latestVisionFrame : null,
    currentGameKey
  );
  
  addMessage("michael", response);
  recentConversation.push({ role: "user", text }, { role: "Michael", text: response });
  recentConversation = recentConversation.slice(-12);
  speakText(response);
}

function handleVoiceModeCommand(transcript) {
  const command = transcript
    .trim()
    .replace(/^(?:yo|hey)\s+michael(?:[\s,.:;-]+|$)/i, "")
    .trim();
  const requestedMode = /^(?:please\s+)?(?:(?:activate|switch to|enter|go to|start|turn on)\s+)?(awaken|serious|normal|regular)(?:\s+mode)?(?:\s+please)?[.!?]*$/i.exec(command)?.[1]?.toLowerCase();
  if (!requestedMode) return false;

  addMessage("user", transcript);
  switchModeWithFeedback(requestedMode === "normal" ? "regular" : requestedMode);
  return true;
}

async function handleSendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  userInput.value = "";
  await processUserCommand(text);
}

sendBtn.onclick = handleSendMessage;
userInput.onkeydown = (e) => { if (e.key === "Enter") handleSendMessage(); };

const aiProviderModal = document.getElementById("aiProviderModal");
const targetMarkerStyleSelect = document.getElementById("targetMarkerStyleSelect");
const aiProviderModalSelect = document.getElementById("aiProviderModalSelect");
const aiProviderSettingsSelect = document.getElementById("aiProviderSettingsSelect");
const geminiKeyInput = document.getElementById("geminiKeyInput");
const groqKeyInput = document.getElementById("groqKeyInput");
const ollamaUrlInput = document.getElementById("ollamaUrlInput");
const geminiModelInput = document.getElementById("geminiModelInput");
const groqModelInput = document.getElementById("groqModelInput");
const ollamaModelInput = document.getElementById("ollamaModelInput");
const personalProviderKeyFields = document.getElementById("personalProviderKeyFields");
const aiProviderError = document.getElementById("aiProviderError");
const saveAIProviderBtn = document.getElementById("saveAIProviderBtn");
let pendingProviderSetup = false;

if (targetMarkerStyleSelect) {
  const savedMarkerStyle = localStorage.getItem("michael_target_marker_style");
  targetMarkerStyleSelect.value = ["arrow", "ring", "crosshair"].includes(savedMarkerStyle)
    ? savedMarkerStyle
    : "arrow";
  targetMarkerStyleSelect.onchange = () => {
    localStorage.setItem("michael_target_marker_style", targetMarkerStyleSelect.value);
    if (currentVisibleMarker) {
      setNativeTargetMarker({ visible: true, ...currentVisibleMarker }).catch((error) => {
        console.error("Unable to update the target marker style:", error);
      });
    }
  };
}

personalProviderKeyFields.innerHTML = PERSONAL_AI_PROVIDERS.map(({ id, name, model }) => `
  <div class="setting-group" style="margin: 10px 0; padding: 10px 12px;">
    <label for="personalKey-${id}">${name} API key</label>
    <input id="personalKey-${id}" type="password" autocomplete="off"
      placeholder="Enter ${name} API key"
      style="width: 100%; padding: 10px; color: #fff; background: #0f0f17; border: 1px solid #6c5ce7; border-radius: 8px;" />
    <small id="personalKeyStatus-${id}" style="color: #b2bec3;">Not saved on this device</small>
    <small style="color: #b2bec3;">Model: ${model}</small>
  </div>
`).join("") + `
  <div class="setting-group" style="margin: 10px 0; padding: 10px 12px;">
    <label for="cloudflareAccountIdInput">Cloudflare account ID</label>
    <input id="cloudflareAccountIdInput" type="text" autocomplete="off"
      placeholder="Required with Cloudflare API key"
      style="width: 100%; padding: 10px; color: #fff; background: #0f0f17; border: 1px solid #6c5ce7; border-radius: 8px;" />
    <small id="cloudflareAccountStatus" style="color: #b2bec3;">Not saved on this device</small>
  </div>
`;

const cloudflareAccountIdInput = document.getElementById("cloudflareAccountIdInput");
const personalKeyInputs = new Map(
  PERSONAL_AI_PROVIDERS.map(({ id }) => [id, document.getElementById(`personalKey-${id}`)])
);

function updatePersonalKeyIndicators() {
  for (const [id, input, statusId] of [
    ["gemini", geminiKeyInput, "geminiKeyStatus"],
    ["groq", groqKeyInput, "groqKeyStatus"]
  ]) {
    const saved = Boolean(localStorage.getItem(`${id}_api_key`)?.trim());
    const status = document.getElementById(statusId);
    if (status) {
      status.textContent = saved ? "✓ API key saved on this device (value hidden)" : "Not saved on this device";
      status.style.color = saved ? "#55efc4" : "#b2bec3";
    }
    input.placeholder = saved ? "Saved — enter a new key to replace it" : `Enter ${id === "groq" ? "Groq" : "Gemini"} API key`;
  }
  for (const { id, name } of PERSONAL_AI_PROVIDERS) {
    const saved = Boolean(localStorage.getItem(`${id}_api_key`)?.trim());
    const status = document.getElementById(`personalKeyStatus-${id}`);
    const input = personalKeyInputs.get(id);
    if (status) {
      status.textContent = saved ? "✓ API key saved on this device (value hidden)" : "Not saved on this device";
      status.style.color = saved ? "#55efc4" : "#b2bec3";
    }
    if (input) input.placeholder = saved ? "Saved — enter a new key to replace it" : `Enter ${name} API key`;
  }
  const accountSaved = Boolean(localStorage.getItem("cloudflare_account_id")?.trim());
  const accountStatus = document.getElementById("cloudflareAccountStatus");
  if (accountStatus) {
    accountStatus.textContent = accountSaved ? "✓ Account ID saved on this device" : "Not saved on this device";
    accountStatus.style.color = accountSaved ? "#55efc4" : "#b2bec3";
  }
}

function updateProviderFields() {
  const provider = aiProviderModalSelect.value;
  const isPersonalProvider = PERSONAL_AI_PROVIDERS.some(({ id }) => id === provider && !["gemini", "groq"].includes(id));
  document.getElementById("personalFallbackFields").hidden = !(provider === "personalFallback" || isPersonalProvider);
  const personalDescription = document.getElementById("personalFallbackDescription");
  if (personalDescription) {
    personalDescription.textContent = provider === "personalFallback"
      ? "Enter provider keys you own. They are saved on this device and requests go directly from the app to each provider. Keys are not uploaded to Michael or Netlify. Leave saved fields blank to keep their current keys."
      : `Enter your ${PERSONAL_AI_PROVIDERS.find(({ id }) => id === provider)?.name || "provider"} key below. The key is saved on this device only.`;
  }
  document.getElementById("geminiProviderFields").hidden = provider !== "gemini";
  document.getElementById("groqProviderFields").hidden = provider !== "groq";
  document.getElementById("ollamaProviderFields").hidden = provider !== "ollama";
}

function updateAIProviderStatus() {
  const provider = getAIProvider();
  const labels = {
    personalFallback: "My API keys (on-device fallback)",
    gemini: "Gemini",
    groq: "Qwen via Groq",
    ollama: "Ollama"
  };
  for (const { id, name, model } of PERSONAL_AI_PROVIDERS) {
    labels[id] = `${name} (${model})`;
  }
  const settings = getAIProviderSettings();
  const saved = isAIProviderConfigured(provider);
  const status = document.getElementById("aiProviderStatus");
  if (status) {
    const detail = provider === "personalFallback"
      ? saved
        ? `${getConfiguredPersonalProviders().length} personal provider key(s) saved on this device.`
        : "Add at least one personal provider API key."
      : PERSONAL_AI_PROVIDERS.some(({ id }) => id === provider)
      ? saved ? "Your API key is saved on this device." : "Add this provider's API key below."
      : provider === "ollama"
      ? `Model: ${settings.ollamaModel} at ${settings.ollamaBaseUrl}`
      : saved ? "Your key is saved on this device." : "A personal API key is needed on this device.";
    status.textContent = `${labels[provider]} selected. ${detail}`;
  }
  if (aiProviderSettingsSelect) aiProviderSettingsSelect.value = provider;
}

function openAIProviderModal() {
  const settings = getAIProviderSettings();
  const provider = getAIProvider();
  aiProviderModalSelect.value = provider;
  geminiKeyInput.value = "";
  groqKeyInput.value = "";
  ollamaUrlInput.value = settings.ollamaBaseUrl;
  for (const input of personalKeyInputs.values()) {
    input.value = "";
  }
  updatePersonalKeyIndicators();
  cloudflareAccountIdInput.value = localStorage.getItem("cloudflare_account_id") || "";
  geminiModelInput.value = settings.geminiModel;
  groqModelInput.value = settings.groqModel;
  ollamaModelInput.value = settings.ollamaModel;
  aiProviderError.textContent = "";
  pendingProviderSetup = true;
  updateProviderFields();
  saveAIProviderBtn.textContent = userInput.value.trim() || pendingVisionStart
    ? "Save & Continue"
    : "Save settings";
  aiProviderModal.style.display = "flex";
}

if (aiProviderSettingsSelect) {
  aiProviderSettingsSelect.value = getAIProvider();
  aiProviderSettingsSelect.onchange = () => {
    setAIProvider(aiProviderSettingsSelect.value);
    updateAIProviderStatus();
  };
}

aiProviderModalSelect.onchange = updateProviderFields;
document.getElementById("manageAIProviderBtn").onclick = openAIProviderModal;

saveAIProviderBtn.onclick = async () => {
  const provider = aiProviderModalSelect.value;
  const personalKeys = Object.fromEntries(
    [...personalKeyInputs].map(([id, input]) => [id, input.value])
  );
  personalKeys.cloudflareAccountId = cloudflareAccountIdInput.value;
  savePersonalProviderKeys(personalKeys);
  updatePersonalKeyIndicators();
  const settings = {
    provider,
    geminiApiKey: geminiKeyInput.value,
    groqApiKey: groqKeyInput.value,
    ollamaBaseUrl: ollamaUrlInput.value,
    geminiModel: geminiModelInput.value,
    groqModel: groqModelInput.value,
    ollamaModel: ollamaModelInput.value
  };

  if (provider === "ollama") {
    try {
      const url = new URL(settings.ollamaBaseUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error();
      }
    } catch {
      aiProviderError.textContent = "Enter a valid Ollama server URL using http:// or https://.";
      ollamaUrlInput.focus();
      return;
    }
    if (!settings.ollamaModel.trim()) {
      aiProviderError.textContent = "Enter the name of an installed Ollama vision model.";
      ollamaModelInput.focus();
      return;
    }
  }

  saveAIProviderSettings(settings);
  if (!isAIProviderConfigured(provider)) {
    if (provider === "personalFallback") {
      aiProviderError.textContent = "Enter at least one provider API key to enable personal fallback rotation.";
      personalKeyInputs.get("gemini").focus();
    } else if (PERSONAL_AI_PROVIDERS.some(({ id }) => id === provider)) {
      aiProviderError.textContent = `Enter your ${PERSONAL_AI_PROVIDERS.find(({ id }) => id === provider)?.name} API key.`;
      personalKeyInputs.get(provider).focus();
    } else {
      aiProviderError.textContent = `Enter your ${provider === "groq" ? "Groq" : "Gemini"} API key.`;
      (provider === "groq" ? groqKeyInput : geminiKeyInput).focus();
    }
    return;
  }

  pendingProviderSetup = false;
  updateAIProviderStatus();
  aiProviderModal.style.display = "none";
  if (pendingVisionStart) {
    pendingVisionStart = false;
    await startVisionStream();
  } else if (userInput.value.trim()) {
    await handleSendMessage();
  }
};

document.getElementById("clearPersonalKeysBtn").onclick = () => {
  if (!window.confirm("Remove all provider API keys saved on this device?")) return;
  clearPersonalProviderKeys();
  for (const input of personalKeyInputs.values()) input.value = "";
  cloudflareAccountIdInput.value = "";
  updatePersonalKeyIndicators();
  aiProviderError.textContent = "All personal provider keys were removed from this device.";
  updateAIProviderStatus();
};

for (const input of [
  geminiKeyInput,
  groqKeyInput,
  geminiModelInput,
  groqModelInput,
  ollamaUrlInput,
  ollamaModelInput,
  cloudflareAccountIdInput,
  ...personalKeyInputs.values()
]) {
  input.onkeydown = (event) => {
    if (event.key === "Enter") saveAIProviderBtn.click();
  };
}

document.getElementById("cancelAIProviderBtn").onclick = () => {
  if (pendingProviderSetup && !isAIProviderConfigured()) {
    userInput.value = "";
  }
  pendingProviderSetup = false;
  pendingVisionStart = false;
  aiProviderModal.style.display = "none";
};

updateProviderFields();
updateAIProviderStatus();

const micBtn = document.getElementById("micBtn");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function updateFloatingOverlayStatus() {
  if (!Capacitor.isNativePlatform()) return;
  NativeFloatingOverlay.setStatus({
    listening: microphoneListening,
    visionActive: liveVisionActive
  }).catch((error) => {
    console.error("Unable to update floating Michael status:", error);
  });
}

function setMicrophoneListening(listening) {
  microphoneListening = listening;
  micBtn.classList.toggle("listening", listening);
  micBtn.textContent = listening ? "🎙️" : "🎤";
  updateFloatingOverlayStatus();
}

if (Capacitor.isNativePlatform()) {
  let nativeListening = false;

  const stopNativeRecognition = async () => {
    if (!nativeListening) return;
    nativeListening = false;
    setMicrophoneListening(false);
    await NativeSpeechRecognition.stop().catch((err) => {
      console.error("Native speech stop failed:", err);
    });
  };

  micBtn.onclick = async () => {
    if (nativeListening) {
      await stopNativeRecognition();
      return;
    }

    try {
      const permission = await NativeSpeechRecognition.requestPermissions();
      if (permission.speechRecognition !== "granted") {
        throw new Error("Microphone permission was not granted.");
      }

      const { available } = await NativeSpeechRecognition.available();
      if (!available) {
        throw new Error("Speech recognition is not available on this device.");
      }

      nativeListening = true;
      setMicrophoneListening(true);
      const result = await NativeSpeechRecognition.start({
        language: "en-US",
        maxResults: 1,
        partialResults: false,
        popup: false
      });
      const transcript = result.matches?.[0]?.trim();
      if (transcript && !handleVoiceModeCommand(transcript)) {
        await processUserCommand(transcript);
      }
    } catch (err) {
      console.error("Native speech recognition failed:", err);
      addMessage("michael", `Microphone error: ${err.message}`);
    } finally {
      await stopNativeRecognition();
    }
  };
} else if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    setMicrophoneListening(true);
  };

  recognition.onend = () => {
    setMicrophoneListening(false);
    try {
      recognition.start();
    } catch (e) {}
  };

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    const lowerTranscript = transcript.toLowerCase();
    const isFinal = event.results[event.results.length - 1].isFinal;

    if (isFinal && handleVoiceModeCommand(transcript)) {
      recognition.stop();
      return;
    }

    if (lowerTranscript.startsWith("yo michael") || lowerTranscript.startsWith("hey michael")) {
      const command = transcript.replace(/^(yo michael|hey michael)\s*/i, "").trim();
      if (command.length > 0 && isFinal) {
        recognition.stop();
        if (!handleVoiceModeCommand(command)) processUserCommand(command);
      }
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.log("Wake word listener auto-start deferred:", e);
  }

  micBtn.onclick = () => {
    const singleRecognition = new SpeechRecognition();
    singleRecognition.continuous = false;
    singleRecognition.interimResults = false;
    singleRecognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      if (!handleVoiceModeCommand(transcript)) {
        userInput.value = transcript;
        handleSendMessage();
      }
    };
    singleRecognition.start();
  };
} else {
  micBtn.onclick = () => alert("Speech recognition unsupported in this browser.");
}

async function startVisionStream() {
  const toggleBtn = document.getElementById("toggleVisionBtn");
  const recordBtn = document.getElementById("toggleRecordBtn");
  const visionStatus = document.getElementById("visionStatus");
  const liveFeedText = document.getElementById("liveFeedText");

  if (!isAIProviderConfigured()) {
    pendingVisionStart = true;
    openAIProviderModal();
    addMessage("michael", "Set up the selected AI provider to enable live screen analysis.");
    return;
  }

  try {
    newServer();
    latestVisionFrame = null;
    let video = null;
    if (Capacitor.getPlatform() === "android") {
      await NativeScreenCapture.start();
      nativeScreenCaptureActive = true;
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("This browser does not support screen sharing.");
      }
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } }
      });
      video = document.createElement("video");
      video.srcObject = screenStream;
      await video.play();
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    liveVisionActive = true;
    updateFloatingOverlayStatus();
    if (Capacitor.getPlatform() === "android" && activeVisualTarget?.type === "pin") {
      await setNativeTargetMarker({
        visible: true,
        label: activeVisualTarget.label,
        screenX: 0.5,
        screenY: 0.5
      });
    }
    if (toggleBtn) toggleBtn.textContent = "🛑 Stop Live Vision";
    if (recordBtn) recordBtn.style.display = screenStream ? "inline-block" : "none";
    if (visionStatus) {
      visionStatus.textContent = "Live Feed: ACTIVE 🟢";
      visionStatus.style.color = "#55efc4";
    }
    if (Capacitor.getPlatform() === "android") {
      addMessage("michael", "Android screen sharing is active. To show target arrows over Roblox, allow Michael to display over other apps when prompted, or tap Floating Michael to enable that permission.");
    }

    const processFrame = async () => {
      if (!liveVisionActive) return;

      try {
        let base64Image;
        if (nativeScreenCaptureActive) {
          const frame = await NativeScreenCapture.captureFrame();
          base64Image = frame.data;
          if (!base64Image) {
            if (!frame.running) {
              liveFeedText.textContent = "Android screen sharing ended.";
              stopVisionStream();
              return;
            }
            setTimeout(processFrame, 300);
            return;
          }
        } else {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
        }

        const frameImage = new Image();
        frameImage.src = `data:image/jpeg;base64,${base64Image}`;
        await frameImage.decode();
        latestVisionFrame = base64Image;
        canvas.width = frameImage.naturalWidth;
        canvas.height = frameImage.naturalHeight;
        ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

        const activeProfile = gameProfiles[currentGameKey];
        if (activeMode === "awaken") {
          const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const evaluation = activeProfile.awakenPromptCheck(frameData);
          liveFeedText.textContent = `⚡ [${activeProfile.name.toUpperCase()}] ${evaluation.text}`;
          liveFeedText.style.color = evaluation.alert ? "#ff7675" : "#55efc4";
        }

        const visionPrompt = currentGameKey === "amongus"
          ? `Analyze this Among Us screen. Return ONLY valid JSON with this shape: {"summary":"one short update based only on visible evidence","players":[{"name":"exact visible username","confidence":0.0,"level":null,"bounty":null,"fruit":null,"fightingStyle":null,"sword":null,"gun":null,"race":null,"accessory":null,"location":null}],"campfire":{"visible":false,"screenX":null,"screenY":null},"amongUs":{"players":[{"color":"blue","room":"Navigation","confidence":0.0}],"body":{"visible":false,"color":null,"room":null,"confidence":0.0}}}. In amongUs.players, list a crewmate only when their standard game color and room are visually identifiable in this frame; set confidence from 0 to 1. For amongUs.body, set visible true only for a clearly visible dead body; report its color and room only if directly identifiable, and set confidence from 0 to 1. Never infer a killer from a single image or invent prior room visits. The app compares players it has actually seen together in a room against later body reports there. When uncertain, omit the player or set body.visible false.`
          : `Analyze this live gameplay screen for ${activeProfile.name}. Return ONLY valid JSON with this shape: {"summary":"one short actionable update based only on visible evidence","players":[{"name":"exact visible username","confidence":0.0,"level":null,"bounty":null,"fruit":null,"fightingStyle":null,"sword":null,"gun":null,"race":null,"accessory":null,"location":null}],"campfire":{"visible":false,"screenX":null,"screenY":null}}. Include a player only if their username is clearly legible. Set confidence from 0 to 1 and save only directly readable values; use null for every value that is not clearly visible. Include the campfire only if it is visibly identifiable and give its center as screenX and screenY fractions from 0 to 1. Never guess a player build, location, campfire position, strength, or travel direction.`;
        const targetPrompt = activeVisualTarget?.type === "target"
          ? ` Also return "visualTarget":{"visible":false,"name":null,"screenX":null,"screenY":null,"confidence":0.0}. Look specifically for "${activeVisualTarget.label}" in this exact frame. Set visible=true and give its center position as screenX and screenY fractions from 0 to 1 only when the requested landmark is clearly visible and identifiable. Otherwise keep visible=false and coordinates null. Do not infer its position from previous frames, map knowledge, or a similar-looking object.`
          : "";
        const response = await analyzeScreen(base64Image, `${visionPrompt}${targetPrompt}`);
        const report = parseVisionReport(response);
        if (activeVisualTarget?.type === "target") {
          const visibleTarget = report?.visualTarget;
          const requestedName = activeVisualTarget.label.toLocaleLowerCase();
          const detectedName = visibleTarget?.name.toLocaleLowerCase();
          const matchesTarget = detectedName === requestedName
            || detectedName?.includes(requestedName)
            || requestedName.includes(detectedName || "\0");
          await setNativeTargetMarker({
            visible: Boolean(visibleTarget && matchesTarget),
            label: activeVisualTarget.label,
            screenX: visibleTarget?.screenX ?? 0.5,
            screenY: visibleTarget?.screenY ?? 0.5
          });
        }
        if (report) {
          if (currentGameKey === "bloxfruits") {
            for (const player of report.players) {
              if (player.confidence >= 0.75) {
                observePlayer(player.name, "profile", player.profile);
              }
            }
          }

          if (currentGameKey === "ninetynine" && report.campfire) {
            const previous = getCampfireLocation();
            const moved = !previous
              || Math.abs(previous.screenX - report.campfire.screenX) > 0.02
              || Math.abs(previous.screenY - report.campfire.screenY) > 0.02
              || Date.now() - (previous.savedAt || 0) > 30000;
            if (moved) {
              campfireData.locationCoordinates = {
                game: currentGameKey,
                ...report.campfire,
                savedAt: Date.now()
              };
              campfireData.isLocated = true;
              saveCampfireLocation(campfireData.locationCoordinates);
              const fireText = document.getElementById("fireMeterText");
              if (fireText) fireText.textContent = "Visible";
            }
          }

          if (currentGameKey === "amongus" && report.amongUs) {
            updateAmongUsTracker(amongUsTracker, report.amongUs);
            renderAmongUsHud(report.amongUs);
          }

          liveFeedText.textContent = `👁️ [${activeProfile.name}] ${report.summary}`;
          liveFeedText.style.color = "#74b9ff";
        } else {
          liveFeedText.textContent = "The screen was captured, but Gemini could not analyze this frame. Check the saved key and connection.";
          liveFeedText.style.color = "#fdcb6e";
        }
      } catch (frameError) {
        console.error("Live screen frame processing failed:", frameError);
        liveFeedText.textContent = `Screen analysis error: ${frameError.message}`;
        liveFeedText.style.color = "#ff7675";
      } finally {
        if (liveVisionActive) {
          const interval = activeVisualTarget?.type === "target"
            ? TARGET_VISION_INTERVAL_MS
            : LIVE_VISION_INTERVAL_MS;
          setTimeout(processFrame, interval);
        }
      }
    };

    processFrame();

    if (screenStream) {
      screenStream.getVideoTracks()[0].onended = () => stopVisionStream();
    }
  } catch (err) {
    console.error("Screen vision capture failed:", err);
    addMessage("michael", `Screen sharing did not start: ${err.message} Approve Android's screen-sharing prompt if it appears.`);
    stopVisionStream();
  }
}

function stopVisionStream() {
  stopTacticalRecorder();
  liveVisionActive = false;
  latestVisionFrame = null;
  updateFloatingOverlayStatus();
  setNativeTargetMarker({ visible: false }).catch((error) => {
    console.error("Unable to hide the target marker after stopping screen sharing:", error);
  });
  isRecordingActive = false;
  if (nativeScreenCaptureActive) {
    nativeScreenCaptureActive = false;
    NativeScreenCapture.stop().catch((err) => {
      console.error("Unable to stop native screen capture:", err);
    });
  }
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  const toggleBtn = document.getElementById("toggleVisionBtn");
  const recordBtn = document.getElementById("toggleRecordBtn");
  const visionStatus = document.getElementById("visionStatus");
  const liveFeedText = document.getElementById("liveFeedText");

  if (toggleBtn) toggleBtn.textContent = "🎥 Start Live Vision";
  if (recordBtn) {
    recordBtn.style.display = "none";
    recordBtn.textContent = "🔴 Record Session";
    recordBtn.classList.remove("recording");
  }
  if (visionStatus) {
    visionStatus.textContent = "Live Feed: OFF";
    visionStatus.style.color = "#b2bec3";
  }
  if (liveFeedText) {
    liveFeedText.textContent = "Live vision feed stopped.";
    liveFeedText.style.color = "#dfe6e9";
  }
}

document.getElementById("toggleVisionBtn").onclick = () => {
  if (!liveVisionActive) startVisionStream();
  else stopVisionStream();
};

const recordBtn = document.getElementById("toggleRecordBtn");
if (recordBtn) {
  recordBtn.onclick = () => {
    if (!isRecordingActive) {
      const started = initTacticalRecorder(screenStream);
      if (started) {
        recordBtn.textContent = "⏹️ Stop Recording";
        recordBtn.classList.add("recording");
        isRecordingActive = true;
        addMessage("michael", "Tactical session recording started. Debrief video will download on stop.");
      }
    } else {
      stopTacticalRecorder();
      recordBtn.textContent = "🔴 Record Session";
      recordBtn.classList.remove("recording");
      isRecordingActive = false;
      addMessage("michael", "Tactical session recording saved and exported.");
    }
  };
}

const gameSelect = document.getElementById("gameProfileSelect");
const activeGameTitle = document.getElementById("activeGameTitle");
const gameContextDesc = document.getElementById("gameContextDesc");
const campfireHud = document.getElementById("campfireHud");
const amongUsHud = document.getElementById("amongUsHud");

function renderAmongUsHud(observation = null) {
  if (!amongUsHud) return;
  amongUsHud.hidden = currentGameKey !== "amongus";
  if (currentGameKey !== "amongus") return;

  const evidence = document.getElementById("amongUsEvidence");
  const body = observation?.body;
  if (evidence) {
    evidence.textContent = body?.visible && body.room
      ? `Body reported in ${body.room}${body.color ? ` (${body.color})` : ""}. Checking recent shared-room clues.`
      : "Watching for shared-room clues and reported bodies.";
  }

  const suspectList = document.getElementById("amongUsSuspects");
  if (!suspectList) return;
  suspectList.replaceChildren();
  const suspects = getAmongUsSuspects(amongUsTracker);
  if (suspects.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "No suspects yet. Michael needs to see players together in a room and a later body report there.";
    suspectList.appendChild(emptyState);
    return;
  }

  for (const suspect of suspects) {
    const row = document.createElement("p");
    row.className = "among-us-suspect";
    row.textContent = `${suspect.color.toUpperCase()} — ${suspect.score}% suspicion estimate · ${suspect.evidenceCount} shared-room clue${suspect.evidenceCount === 1 ? "" : "s"} (${suspect.room})`;
    suspectList.appendChild(row);
  }
}

if (gameSelect) {
  gameSelect.value = currentGameKey;
  updateGameUI(currentGameKey);

  gameSelect.onchange = (e) => {
    currentGameKey = e.target.value;
    localStorage.setItem("michael_game_profile", currentGameKey);
    recentConversation = [];
    activeVisualTarget = null;
    setNativeTargetMarker({ visible: false }).catch((error) => {
      console.error("Unable to clear the marker after switching games:", error);
    });
    updateGameUI(currentGameKey);

    if (currentGameKey === "amongus") {
      amongUsTracker = createAmongUsTracker();
      renderAmongUsHud();
    }

    const profile = gameProfiles[currentGameKey];
    const msg = `Switched game profile to ${profile.name}.`;
    addMessage("michael", msg);
    speakText(msg);
  };
}

function updateGameUI(key) {
  const profile = gameProfiles[key];
  if (activeGameTitle) activeGameTitle.textContent = profile.name;
  if (gameContextDesc) gameContextDesc.textContent = profile.levelInfo;

  if (campfireHud) {
    if (key === "ninetynine") {
      campfireHud.style.display = "block";
      const fireText = document.getElementById("fireMeterText");
      if (fireText) {
        fireText.textContent = campfireData.isLocated ? "Tracked" : "Not Found";
      }
    } else {
      campfireHud.style.display = "none";
    }
  }
  if (amongUsHud) amongUsHud.hidden = key !== "amongus";
}

const sidebar = document.getElementById("slideSidebar");
const toggleBtn = document.getElementById("sidebarToggleBtn");
const closeBtn = document.getElementById("closeSidebarBtn");

if (toggleBtn && sidebar) {
  toggleBtn.onclick = () => sidebar.classList.toggle("open");
}
if (closeBtn && sidebar) {
  closeBtn.onclick = () => sidebar.classList.remove("open");
}

const views = {
  navChat: document.getElementById("chatPage"),
  navGames: document.getElementById("gamesPage"),
  navTutorial: document.getElementById("tutorialPage"),
  navNotes: document.getElementById("notesPage"),
  navSettings: document.getElementById("settingsPage")
};

Object.keys(views).forEach(navId => {
  const navBtn = document.getElementById(navId);
  if (navBtn) {
    navBtn.onclick = () => {
      Object.keys(views).forEach(k => {
        document.getElementById(k).classList.remove("active");
        views[k].classList.remove("active");
      });
      navBtn.classList.add("active");
      views[navId].classList.add("active");
      if (sidebar) sidebar.classList.remove("open");
    };
  }
});

const notesTextarea = document.getElementById("notesTextarea");
notesTextarea.value = localStorage.getItem("michael_notes") || "";
notesTextarea.oninput = () => localStorage.setItem("michael_notes", notesTextarea.value);

const clearMemoryModal = document.getElementById("clearMemoryModal");
const openClearModalBtn = document.getElementById("openClearMemoryModalBtn");
const confirmClearBtn = document.getElementById("confirmClearMemoryBtn");
const cancelClearBtn = document.getElementById("cancelClearMemoryBtn");

if (openClearModalBtn && clearMemoryModal) {
  openClearModalBtn.onclick = () => {
    clearMemoryModal.style.display = "flex";
  };
}

if (cancelClearBtn && clearMemoryModal) {
  cancelClearBtn.onclick = () => {
    clearMemoryModal.style.display = "none";
  };
}

if (confirmClearBtn && clearMemoryModal) {
  confirmClearBtn.onclick = () => {
    clearPermanentMemoryCompletely();
    recentConversation = [];
    campfireData.isLocated = false;
    campfireData.locationCoordinates = null;
    const fireText = document.getElementById("fireMeterText");
    if (fireText) fireText.textContent = "Not Found";

    clearMemoryModal.style.display = "none";
    const msg = "Permanent memory cleared successfully.";
    addMessage("michael", msg);
    speakText(msg);
  };
}

function setupAudioUploads() {
  for (let i = 1; i <= 3; i++) {
    const savedName = localStorage.getItem(`michael_bgm_name_${i}`);
    const labelEl = document.getElementById(`bgm${i}FileName`);
    if (savedName && labelEl) labelEl.textContent = savedName;
  }

  ["regular", "serious", "awaken"].forEach(mode => {
    const savedName = localStorage.getItem(`bgm_name_${mode}`);
    const labelEl = document.getElementById(`${mode}FileName`);
    if (savedName && labelEl) labelEl.textContent = savedName;
  });

  for (let i = 1; i <= 3; i++) {
    const inputEl = document.getElementById(`bgm${i}AudioInput`);
    const labelEl = document.getElementById(`bgm${i}FileName`);

    if (inputEl) {
      inputEl.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(event) {
            try {
              localStorage.setItem(`michael_bgm_track_${i}`, event.target.result);
              localStorage.setItem(`michael_bgm_name_${i}`, file.name);
              if (labelEl) labelEl.textContent = file.name;
              if (isBGMEnabled()) setBGMMode(activeMode);
              const confirmMsg = `Saved ${file.name} as Michael-BGM${i}.`;
              addMessage("michael", confirmMsg);
              speakText(confirmMsg);
            } catch (error) {
              console.error("Unable to save background music:", error);
              addMessage("michael", `Could not save ${file.name}. The file may be too large for device storage.`);
            }
          };
          reader.readAsDataURL(file);
        }
      };
    }
  }

  ["regular", "serious", "awaken"].forEach(mode => {
    const inputEl = document.getElementById(`${mode}AudioInput`);
    const labelEl = document.getElementById(`${mode}FileName`);

    if (inputEl) {
      inputEl.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(event) {
            try {
              localStorage.setItem(`bgm_${mode}`, event.target.result);
              localStorage.setItem(`bgm_name_${mode}`, file.name);
              if (labelEl) labelEl.textContent = file.name;
              if (mode === activeMode && isBGMEnabled()) setBGMMode(mode);
              const confirmMsg = `Saved ${file.name} for ${mode.toUpperCase()} mode.`;
              addMessage("michael", confirmMsg);
              speakText(confirmMsg);
            } catch (error) {
              console.error("Unable to save mode background music:", error);
              addMessage("michael", `Could not save ${file.name}. The file may be too large for device storage.`);
            }
          };
          reader.readAsDataURL(file);
        }
      };
    }
  });

  for (let i = 1; i <= 3; i++) {
    const playButton = document.getElementById(`playBgm${i}Btn`);
    if (playButton) {
      playButton.onclick = () => {
        if (!playPlaylistTrack(i)) {
          addMessage("michael", `Upload a track for playlist slot ${i} before playing it.`);
        }
      };
    }
  }

  document.getElementById("playRegularBtn").onclick = () => switchModeWithFeedback("regular");
  document.getElementById("playSeriousBtn").onclick = () => switchModeWithFeedback("serious");
  document.getElementById("playAwakenBtn").onclick = () => switchModeWithFeedback("awaken");

  const volumeSlider = document.getElementById("bgmVolumeSlider");
  const volumeLabel = document.getElementById("volumePercentageLabel");

  if (volumeSlider) {
    volumeSlider.oninput = (e) => {
      currentVolumeLevel = parseFloat(e.target.value);
      if (volumeLabel) volumeLabel.textContent = `${Math.round(currentVolumeLevel * 100)}%`;
      setBGMVolume(currentVolumeLevel);
    };
  }

  const muteBtn = document.getElementById("muteAudioBtn");
  if (muteBtn) {
    muteBtn.textContent = isBGMEnabled() ? "Stop BGM" : "Play BGM";
    muteBtn.onclick = () => {
      const shouldEnable = !isBGMEnabled();
      const hasTrack = setBGMEnabled(shouldEnable);
      muteBtn.textContent = shouldEnable ? "Stop BGM" : "Play BGM";
      const msg = !shouldEnable
        ? "Background music stopped."
        : hasTrack
          ? "Background music started."
          : "No background music is saved yet. Upload a track in Settings.";
      addMessage("michael", msg);
      speakText(msg);
    };
  }
}

function switchModeWithFeedback(mode) {
  activeMode = mode;
  const success = setBGMMode(mode);

  const modeLatencyText = document.getElementById("visionLatency");
  if (modeLatencyText) {
    modeLatencyText.textContent = mode === "awaken" ? "Mode: REAL-TIME ZERO-DELAY" : "Mode: STANDARD";
    modeLatencyText.style.color = mode === "awaken" ? "#ff7675" : "#74b9ff";
  }

  const msg = !isBGMEnabled()
    ? `Switched to ${mode.toUpperCase()} mode. Background music is off.`
    : success
      ? `Playing ${mode.toUpperCase()} soundtrack.`
      : `Switched to ${mode.toUpperCase()} mode. Upload a track in settings to hear music.`;
  addMessage("michael", msg);
  speakText(msg);
}

setupAudioUploads();

const visionSelect = document.getElementById("visionAutoStartSelect");
const visionHint = document.getElementById("visionModeHint");

const savedVisionPref = localStorage.getItem("michael_vision_mode") || "manual";
if (visionSelect) {
  visionSelect.value = savedVisionPref;
  if (visionHint) {
    visionHint.textContent = savedVisionPref === "auto" ? "Auto-start enabled" : "Manual mode active";
  }

  visionSelect.onchange = (e) => {
    const val = e.target.value;
    localStorage.setItem("michael_vision_mode", val);
    if (visionHint) {
      visionHint.textContent = val === "auto" ? "Auto-start enabled" : "Manual mode active";
    }
    const msg = val === "auto" 
      ? "Live Vision set to Always On mode." 
      : "Live Vision set to Manual activation mode.";
    addMessage("michael", msg);
    speakText(msg);
  };
}

if (savedVisionPref === "auto") {
  startVisionStream();
}
