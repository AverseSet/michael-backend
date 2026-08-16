import "./style.css";
import { runQuery } from "./ai.js";
import { handleCommand } from "./commands.js";
import { initBGM, setBGMMode, stopBGM } from "./bgm.js";
import { gameProfiles } from "./gamesConfig.js";
import { saveCampfireLocation, getCampfireLocation, clearPermanentMemoryCompletely } from "./memory.js";
import { initTacticalRecorder, stopTacticalRecorder } from "./recorder.js";

// --- TOKEN & AUTH HELPER ---
const TOKEN_KEY = 'michael_token';

function getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// Authenticated Fetch Wrapper matching your HTML token storage
async function fetchWithAuth(url, options = {}) {
    let token = getAccessToken();

    if (!token) {
        throw new Error("No authentication token found. Please log in.");
    }

    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const response = await fetch(url, options);
    
    if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.reload();
        throw new Error("Unauthorized access. Logging out.");
    }

    return response;
}

let liveVisionActive = false;
let screenStream = null;
let activeMode = "regular";
let currentGameKey = localStorage.getItem("michael_game_profile") || "bloxfruits";
let isRecordingActive = false;

// --- 99 NIGHTS CAMPFIRE STATE ---
let campfireData = {
  isLocated: false,
  locationCoordinates: getCampfireLocation(),
  fuelLevel: 100
};

if (campfireData.locationCoordinates) {
  campfireData.isLocated = true;
}

// --- SEQUENTIAL BGM PLAYLIST ENGINE ---
let playlistAudio = null;
let currentPlaylistIndex = 1;
const totalPlaylistTracks = 3;
let currentVolumeLevel = parseFloat(localStorage.getItem("michael_bgm_volume")) || 1.0;

function playNextPlaylistTrack() {
    const trackKey = `michael_bgm_track_${currentPlaylistIndex}`;
    const audioData = localStorage.getItem(trackKey);

    if (audioData) {
        if (playlistAudio) {
            playlistAudio.pause();
            playlistAudio = null;
        }

        playlistAudio = new Audio(audioData);
        playlistAudio.volume = currentVolumeLevel;
        
        playlistAudio.play().then(() => {
            const trackName = localStorage.getItem(`michael_bgm_name_${currentPlaylistIndex}`) || `Michael-BGM${currentPlaylistIndex}`;
            console.log(`[BGM Playlist] Playing: ${trackName}`);
        }).catch(err => {
            console.log("[BGM Playlist] Playback blocked or failed:", err);
        });

        playlistAudio.onended = () => {
            currentPlaylistIndex++;
            if (currentPlaylistIndex > totalPlaylistTracks) {
                currentPlaylistIndex = 1;
            }
            playNextPlaylistTrack();
        };
    } else {
        currentPlaylistIndex++;
        if (currentPlaylistIndex <= totalPlaylistTracks) {
            playNextPlaylistTrack();
        } else {
            currentPlaylistIndex = 1;
        }
    }
}

function initSequentialPlaylist() {
    currentPlaylistIndex = 1;
    playNextPlaylistTrack();
}

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
            <div style="display: flex; align-items: center; gap: 10px;">
              <button id="toggleVisionBtn" class="action-btn">🎥 Start Live Vision</button>
              <button id="toggleRecordBtn" class="action-btn" style="background: #d63031; display: none;">🔴 Record Session</button>
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
              <p style="color: #b2bec3; font-size: 0.9rem; line-height: 1.5;">Click <strong>Start Live Vision</strong> to stream your gameplay. Michael will poll snapshots and evaluate your session based on your active game configuration.</p>
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

          <div class="setting-group" style="background: #181824; padding: 15px; border-radius: 8px; border: 1px solid #d63031; margin-bottom: 20px;">
            <label style="color: #ff7675; font-weight: bold; display: block; margin-bottom: 5px;">⚠️ Permanent Memory Management</label>
            <p style="color: #b2bec3; font-size: 0.85rem; margin-bottom: 10px;">Wipe permanent long-term memory data (such as campfire location anchors and saved player states).</p>
            <button id="openClearMemoryModalBtn" class="action-btn" style="background: #d63031;">Clear Memory</button>
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
              <button id="muteAudioBtn" class="action-btn" style="background: #d63031;">Stop BGM</button>
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
        <button id="confirmClearMemoryBtn" style="background: #d63031; color: white; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-weight: bold;">Okay</button>
        <button id="cancelClearMemoryBtn" style="background: #475569; color: white; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer;">Cancel</button>
      </div>
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

initSequentialPlaylist();
initBGM();

function speakText(text) {
  try {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => 
      (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Neural')) && 
      v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }
    
    utterance.rate = 1.65;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Speech Synthesis Error:", err);
  }
}

const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const userInput = document.getElementById("userInput");

function addMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;
  
  const senderSpan = document.createElement("span");
  senderSpan.className = "sender";
  senderSpan.textContent = sender === "user" ? "You:" : "Michael:";

  const textP = document.createElement("p");
  textP.textContent = text;

  msgDiv.appendChild(senderSpan);
  msgDiv.appendChild(textP);
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function processUserCommand(text) {
  if (!text) return;

  addMessage("user", text);

  if (text.toLowerCase().startsWith("!mode ")) {
    const requestedMode = text.split(" ")[1].toLowerCase();
    switchModeWithFeedback(requestedMode);
    return;
  }

  const commandResult = handleCommand(text);
  if (commandResult) {
    addMessage("michael", commandResult);
    speakText(commandResult);
    return;
  }

  const response = await runQuery(text);
  
  addMessage("michael", response);
  speakText(response);
}

async function handleSendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  userInput.value = "";
  await processUserCommand(text);
}

sendBtn.onclick = handleSendMessage;
userInput.onkeydown = (e) => { if (e.key === "Enter") handleSendMessage(); };

const micBtn = document.getElementById("micBtn");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    micBtn.classList.add("listening");
    micBtn.textContent = "🎙️";
  };

  recognition.onend = () => {
    micBtn.classList.remove("listening");
    micBtn.textContent = "🎤";
    try {
      recognition.start();
    } catch (e) {}
  };

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    const lowerTranscript = transcript.toLowerCase();

    if (lowerTranscript.startsWith("yo michael") || lowerTranscript.startsWith("hey michael")) {
      const command = transcript.replace(/^(yo michael|hey michael)\s*/i, "").trim();
      if (command.length > 0 && event.results[event.results.length - 1].isFinal) {
        recognition.stop();
        processUserCommand(command);
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
      userInput.value = e.results[0][0].transcript;
      handleSendMessage();
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

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 } }
    });

    const video = document.createElement("video");
    video.srcObject = screenStream;
    await video.play();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    liveVisionActive = true;
    if (toggleBtn) toggleBtn.textContent = "🛑 Stop Live Vision";
    if (recordBtn) recordBtn.style.display = "inline-block";
    if (visionStatus) {
      visionStatus.textContent = "Live Feed: ACTIVE 🟢";
      visionStatus.style.color = "#55efc4";
    }

    const processFrame = async () => {
      if (!liveVisionActive) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const activeProfile = gameProfiles[currentGameKey];

      if (currentGameKey === "ninetynine") {
        if (!campfireData.isLocated && Math.random() < 0.05) {
          const simulatedCoords = { x: Math.floor(Math.random() * 500), y: Math.floor(Math.random() * 500) };
          saveCampfireLocation(simulatedCoords);
          campfireData.isLocated = true;
          campfireData.locationCoordinates = simulatedCoords;
          campfireData.fuelLevel = 100;
          
          const fireText = document.getElementById("fireMeterText");
          if (fireText) fireText.textContent = "Tracked (100%)";
        }
      }

      if (activeMode === "awaken") {
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const evaluation = activeProfile.awakenPromptCheck(frameData);

        if (evaluation.alert) {
          liveFeedText.textContent = `⚡ [${activeProfile.name.toUpperCase()}] ${evaluation.text}`;
          liveFeedText.style.color = "#ff7675";
        } else {
          liveFeedText.textContent = `⚡ [${activeProfile.name.toUpperCase()}] ${evaluation.text}`;
          liveFeedText.style.color = "#55efc4";
        }
        requestAnimationFrame(processFrame);
      } else {
        liveFeedText.textContent = `📷 [${activeProfile.name}] Polling snapshot...`;
        liveFeedText.style.color = "#74b9ff";
        
        setTimeout(() => {
          if (liveVisionActive && activeMode !== "awaken") {
            liveFeedText.textContent = `👁️ Sector Scan: ${activeProfile.name} tracking operational.`;
            requestAnimationFrame(processFrame);
          }
        }, 1000);
      }
    };

    processFrame();

    screenStream.getVideoTracks()[0].onended = () => stopVisionStream();
  } catch (err) {
    console.error("Screen vision capture failed:", err);
    stopVisionStream();
  }
}

function stopVisionStream() {
  stopTacticalRecorder();
  liveVisionActive = false;
  isRecordingActive = false;
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
    recordBtn.style.background = "#d63031";
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
        recordBtn.style.background = "#e17055";
        isRecordingActive = true;
        addMessage("michael", "Tactical session recording started. Debrief video will download on stop.");
      }
    } else {
      stopTacticalRecorder();
      recordBtn.textContent = "🔴 Record Session";
      recordBtn.style.background = "#d63031";
      isRecordingActive = false;
      addMessage("michael", "Tactical session recording saved and exported.");
    }
  };
}

const gameSelect = document.getElementById("gameProfileSelect");
const activeGameTitle = document.getElementById("activeGameTitle");
const gameContextDesc = document.getElementById("gameContextDesc");
const campfireHud = document.getElementById("campfireHud");

if (gameSelect) {
  gameSelect.value = currentGameKey;
  updateGameUI(currentGameKey);

  gameSelect.onchange = (e) => {
    currentGameKey = e.target.value;
    localStorage.setItem("michael_game_profile", currentGameKey);
    updateGameUI(currentGameKey);

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
            localStorage.setItem(`michael_bgm_track_${i}`, event.target.result);
            localStorage.setItem(`michael_bgm_name_${i}`, file.name);
            if (labelEl) labelEl.textContent = file.name;

            const confirmMsg = `Saved ${file.name} as Michael-BGM${i}.`;
            addMessage("michael", confirmMsg);
            speakText(confirmMsg);
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
            localStorage.setItem(`bgm_${mode}`, event.target.result);
            localStorage.setItem(`bgm_name_${mode}`, file.name);
            if (labelEl) labelEl.textContent = file.name;
            
            const confirmMsg = `Saved ${file.name} for ${mode.toUpperCase()} mode.`;
            addMessage("michael", confirmMsg);
            speakText(confirmMsg);
          };
          reader.readAsDataURL(file);
        }
      };
    }
  });

  document.getElementById("playBgm1Btn").onclick = () => { currentPlaylistIndex = 1; playNextPlaylistTrack(); };
  document.getElementById("playBgm2Btn").onclick = () => { currentPlaylistIndex = 2; playNextPlaylistTrack(); };
  document.getElementById("playBgm3Btn").onclick = () => { currentPlaylistIndex = 3; playNextPlaylistTrack(); };

  document.getElementById("playRegularBtn").onclick = () => switchModeWithFeedback("regular");
  document.getElementById("playSeriousBtn").onclick = () => switchModeWithFeedback("serious");
  document.getElementById("playAwakenBtn").onclick = () => switchModeWithFeedback("awaken");

  const volumeSlider = document.getElementById("bgmVolumeSlider");
  const volumeLabel = document.getElementById("volumePercentageLabel");

  if (volumeSlider) {
    volumeSlider.oninput = (e) => {
      currentVolumeLevel = parseFloat(e.target.value);
      localStorage.setItem("michael_bgm_volume", currentVolumeLevel);
      if (volumeLabel) volumeLabel.textContent = `${Math.round(currentVolumeLevel * 100)}%`;

      if (playlistAudio) {
        playlistAudio.volume = currentVolumeLevel;
      }
    };
  }

  const muteBtn = document.getElementById("muteAudioBtn");
  if (muteBtn) {
    muteBtn.onclick = () => {
      if (playlistAudio) {
        playlistAudio.pause();
        playlistAudio = null;
      }
      stopBGM();
      const msg = "Background music stopped.";
      addMessage("michael", msg);
      speakText(msg);
    };
  }
}

function switchModeWithFeedback(mode) {
  activeMode = mode;
  if (playlistAudio) {
    playlistAudio.pause();
    playlistAudio = null;
  }
  const success = setBGMMode(mode);

  const modeLatencyText = document.getElementById("visionLatency");
  if (modeLatencyText) {
    modeLatencyText.textContent = mode === "awaken" ? "Mode: REAL-TIME ZERO-DELAY" : "Mode: STANDARD";
    modeLatencyText.style.color = mode === "awaken" ? "#ff7675" : "#74b9ff";
  }

  const msg = success 
    ? `Playing ${mode.toUpperCase()} soundtrack.` 
    : `Switched to ${mode.toUpperCase()} mode. Upload a track in settings to hear custom sound.`;
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

export { getAccessToken, fetchWithAuth };
window.fetchWithAuth = fetchWithAuth;