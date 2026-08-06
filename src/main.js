import "./style.css";
import { runQuery } from "./ai.js";
import { handleCommand } from "./commands.js";
import { initBGM, setBGMMode, stopBGM } from "./bgm.js";
import { gameProfiles } from "./gamesConfig.js";

// --- TOKEN MANAGEMENT CONFIG & FUNCTIONS ---
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// 1. Save Tokens securely to localStorage
function saveTokens(accessToken, refreshToken) {
    if (accessToken) {
        localStorage.setItem(TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    console.log("Tokens saved successfully.");
}

// 2. Retrieve Access Token
function getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// 3. Decode JWT Token payload (to check expiration without libraries)
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Failed to parse JWT:", error);
        return null;
    }
}

// 4. Check if the token is expired
function isTokenExpired(token) {
    const decoded = parseJwt(token);
    if (!decoded || !decoded.exp) {
        return true; // Treat invalid/unparseable tokens as expired
    }
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
}

// 5. Refresh Token Logic
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    try {
        const response = await fetch('http://localhost:5000/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) return false;

        const data = await response.json();
        saveTokens(data.accessToken, data.refreshToken);
        return true;
    } catch (error) {
        console.error("Error refreshing token:", error);
        return false;
    }
}

// 6. Clear tokens and show login modal
function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    console.log("Logged out. Tokens cleared.");
    showLoginModal();
}

// 7. Authenticated Fetch Wrapper
async function fetchWithAuth(url, options = {}) {
    let token = getAccessToken();

    if (!token || isTokenExpired(token)) {
        console.warn("Token expired or missing. Attempting refresh...");
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            handleLogout();
            throw new Error("Session expired. Please log in again.");
        }
        token = getAccessToken();
    }

    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const response = await fetch(url, options);
    
    if (response.status === 401) {
        handleLogout();
        throw new Error("Unauthorized access. Logging out.");
    }

    return response;
}
// --- END OF TOKEN MANAGEMENT ---

let currentPlayingAudio = null;
let liveVisionActive = false;
let screenStream = null;
let activeMode = "regular";
let currentGameKey = localStorage.getItem("michael_game_profile") || "bloxfruits";

// 1. 20 UNIQUE DEPLOYMENT GREETINGS ROTATION
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
  "Network stable, co-pilot ready. What's our first objective?",
  "Combat assistance online. Let's clear out the opposition.",
  "Readiness check complete. Michael standing by for tactical command.",
  "Power levels nominal. Let's conquer the match, Captain."
];

const randomGreeting = deploymentGreetings[Math.floor(Math.random() * deploymentGreetings.length)];

// 2. RENDER FULL APPLICATION UI WITH FULL-SCREEN BLACK DUAL-INPUT LOGIN MODAL
document.querySelector("#app").innerHTML = `
  <div id="loader">
    <div class="spinner"></div>
    <p id="loaderText">Initializing Michael AI Systems...</p>
  </div>

  <!-- FULL-SCREEN BLACK LOGIN MODAL OVERLAY -->
  <div id="loginModal" class="login-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000000; z-index: 9999; justify-content: center; align-items: center;">
    <div class="login-modal-box" style="background: #181824; border: 1px solid #6c5ce7; padding: 35px; border-radius: 12px; width: 380px; text-align: center; box-shadow: 0 8px 32px rgba(108, 92, 231, 0.4);">
      <h2 style="color: #fff; margin-bottom: 10px;">🛡️ Authentication Required</h2>
      <p style="color: #b2bec3; font-size: 0.9rem; margin-bottom: 20px;">Enter your username and key to establish neural link with Michael AI.</p>
      <input type="text" id="usernameInput" placeholder="Enter username..." style="width: 100%; padding: 10px; background: #0f0f17; border: 1px solid #2d2d42; color: #fff; border-radius: 6px; margin-bottom: 12px; box-sizing: border-box;" />
      <input type="password" id="authKeyInput" placeholder="Enter key..." style="width: 100%; padding: 10px; background: #0f0f17; border: 1px solid #2d2d42; color: #fff; border-radius: 6px; margin-bottom: 15px; box-sizing: border-box;" />
      <button id="submitTokenBtn" style="width: 100%; padding: 10px; background: #6c5ce7; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Connect Protocol</button>
    </div>
  </div>

  <div class="app-container">
    <!-- SLIDING TASKBAR / SIDEBAR -->
    <aside id="slideSidebar" class="slide-sidebar">
      <div class="sidebar-header">
        <h3>⚔️ Menu</h3>
        <button id="closeSidebarBtn" style="background:none; border:none; color:#fff; cursor:pointer; font-size:1.2rem;">✕</button>
      </div>
      <nav class="sidebar-nav">
        <button id="navChat" class="active">💬 Chat & Vision</button>
        <button id="navGames">🎮 Game Profiles</button>
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
        <!-- CHAT VIEW -->
        <div id="chatPage" class="page-view active">
          <!-- REAL-TIME VISION HUD -->
          <div class="live-vision-bar" style="display: flex; justify-content: space-between; align-items: center; background: #181824; padding: 10px 15px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #2d2d42;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <button id="toggleVisionBtn" class="action-btn">🎥 Start Live Vision</button>
              <span id="visionStatus" style="color: #b2bec3; font-weight: bold; font-size: 0.9rem;">Live Feed: OFF</span>
            </div>
            <span id="visionLatency" style="color: #74b9ff; font-size: 0.85rem; font-family: monospace;">Mode: STANDARD</span>
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

          <div class="input-area">
            <input type="text" id="userInput" placeholder="Ask Michael or speak your command..." />
            <button id="micBtn" title="Speak to Michael">🎤</button>
            <button id="sendBtn" class="action-btn">Send</button>
          </div>
        </div>

        <!-- GAMES VIEW -->
        <div id="gamesPage" class="page-view">
          <h2>🎮 Active Game Context</h2>
          <div class="setting-group" style="margin-top: 15px;">
            <label>Select Active Game Profile:</label>
            <select id="gameProfileSelect" class="custom-select" style="margin-top: 5px; width: 100%;">
              <option value="bloxfruits">Blox Fruits (Roblox)</option>
              <option value="amongus">Among Us</option>
            </select>
          </div>
          <div id="gameContextDetails" style="margin-top: 20px; background: #1e1e2f; padding: 20px; border-radius: 8px;">
            <p>Currently tracking: <strong id="activeGameTitle">Blox Fruits (Roblox)</strong></p>
            <p id="gameContextDesc" style="color: #b2bec3; margin-top: 10px; line-height: 1.6;">Sea 1: 1-700 | Sea 2: 700-1500 | Sea 3: 1500+</p>
          </div>
        </div>

        <!-- NOTES VIEW -->
        <div id="notesPage" class="page-view">
          <h2>📝 Captain's Notes</h2>
          <p style="color: #b2bec3;">Jot down strategies, task lists, or trade plans:</p>
          <textarea id="notesTextarea" placeholder="Type your tactical notes here..."></textarea>
        </div>

        <!-- SETTINGS VIEW -->
        <div id="settingsPage" class="page-view">
          <h2>⚙️ System & Audio Settings</h2>

          <!-- VISION STARTUP PREFERENCE -->
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

          <!-- GLOBAL BGM MUTE -->
          <div class="setting-group" style="margin-top: 20px;">
            <label>🔊 Global Sound Control:</label>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px;">
              <button id="muteAudioBtn" class="action-btn" style="background: #d63031;">Stop BGM</button>
            </div>
          </div>

          <!-- REGULAR MODE -->
          <div class="setting-group">
            <label>🎵 Regular Mode Sound:</label>
            <div class="custom-file-row">
              <input type="file" id="regularAudioInput" accept="audio/*" />
              <button id="playRegularBtn" class="action-btn">▶️ Play Regular</button>
              <span id="regularFileName" class="file-name-label">No track selected</span>
            </div>
          </div>

          <!-- SERIOUS MODE -->
          <div class="setting-group">
            <label>⚡ Serious Mode Sound:</label>
            <div class="custom-file-row">
              <input type="file" id="seriousAudioInput" accept="audio/*" />
              <button id="playSeriousBtn" class="action-btn">▶️ Play Serious</button>
              <span id="seriousFileName" class="file-name-label">No track selected</span>
            </div>
          </div>

          <!-- AWAKEN MODE -->
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
    </div>
  </div>
`;

// 3. INITIALIZATION & AUTH CHECK
function checkAuthAndStart() {
    const token = getAccessToken();
    if (!token) {
        showLoginModal();
    }
    initBGM();
}

function showLoginModal() {
    const modal = document.getElementById("loginModal");
    if (modal) modal.style.display = "flex";
}

function hideLoginModal() {
    const modal = document.getElementById("loginModal");
    if (modal) modal.style.display = "none";
}

// Handle login submission with username and key
document.addEventListener("DOMContentLoaded", () => {
    const submitBtn = document.getElementById("submitTokenBtn");
    const usernameInput = document.getElementById("usernameInput");
    const authKeyInput = document.getElementById("authKeyInput");

    if (submitBtn && usernameInput && authKeyInput) {
        submitBtn.onclick = async () => {
            const username = usernameInput.value.trim();
            const key = authKeyInput.value.trim();

            if (!username || !key) {
                alert("Please enter both username and key.");
                return;
            }

            try {
                const response = await fetch('http://localhost:5000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, key })
                });

                if (!response.ok) {
                    throw new Error("Invalid credentials");
                }

                const data = await response.json();
                saveTokens(data.accessToken, data.refreshToken);
                hideLoginModal();
                usernameInput.value = "";
                authKeyInput.value = "";
            } catch (error) {
                console.error("Login authentication error:", error);
                alert("Authentication failed. Please check your username and key.");
            }
        };
    }
});

checkAuthAndStart();

const loaderText = document.getElementById("loaderText");
setTimeout(() => { if (loaderText) loaderText.textContent = "Loading speech engine..."; }, 1000);
setTimeout(() => { if (loaderText) loaderText.textContent = "Connecting vision protocols..."; }, 2000);

const hideLoader = () => {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.style.opacity = "0";
    setTimeout(() => { loader.style.display = "none"; }, 400);
  }
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => setTimeout(hideLoader, 3000));
} else {
  setTimeout(hideLoader, 3000);
}

// 4. PIPER TTS ENGINE (Updated with fetchWithAuth)
async function speakText(text) {
  try {
    if (currentPlayingAudio) {
      currentPlayingAudio.pause();
      currentPlayingAudio.currentTime = 0;
    }

    const response = await fetchWithAuth(`http://localhost:5000/api/tts?t=${Date.now()}`, {
      method: "POST",
      body: JSON.stringify({ text })
    });

    if (!response.ok) throw new Error("TTS bridge server error");

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    currentPlayingAudio = new Audio(audioUrl);
    await currentPlayingAudio.play();
  } catch (err) {
    console.error("Piper Speech Error:", err);
  }
}

// 5. CHAT AND COMMAND LOGIC
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

async function handleSendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  userInput.value = "";

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

  addMessage("michael", "Thinking...");
  const response = await runQuery(text);
  
  chatBox.lastElementChild.remove();
  addMessage("michael", response);
  speakText(response);
}

sendBtn.onclick = handleSendMessage;
userInput.onkeydown = (e) => { if (e.key === "Enter") handleSendMessage(); };

// 6. STT (SPEECH-TO-TEXT) MICROPHONE CONTROL
const micBtn = document.getElementById("micBtn");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    micBtn.classList.add("listening");
    micBtn.textContent = "🎙️ Listening...";
  };

  recognition.onend = () => {
    micBtn.classList.remove("listening");
    micBtn.textContent = "🎤";
  };

  recognition.onresult = (event) => {
    userInput.value = event.results[0][0].transcript;
    handleSendMessage();
  };

  micBtn.onclick = () => recognition.start();
} else {
  micBtn.onclick = () => alert("Speech recognition unsupported in this browser.");
}

// 7. REAL-TIME & ZERO-DELAY DYNAMIC VISION ENGINE
async function startVisionStream() {
  const toggleBtn = document.getElementById("toggleVisionBtn");
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
        }, 3000);
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
  liveVisionActive = false;
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  const toggleBtn = document.getElementById("toggleVisionBtn");
  const visionStatus = document.getElementById("visionStatus");
  const liveFeedText = document.getElementById("liveFeedText");

  if (toggleBtn) toggleBtn.textContent = "🎥 Start Live Vision";
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

// 8. GAME PROFILE SWITCHER LOGIC
const gameSelect = document.getElementById("gameProfileSelect");
const activeGameTitle = document.getElementById("activeGameTitle");
const gameContextDesc = document.getElementById("gameContextDesc");

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
}

// 9. SIDEBAR & VIEW NAVIGATION CONTROLS
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

// 10. SOUNDTRACK & AUDIO CONTROLS
function setupAudioUploads() {
  const audioInputs = {
    regularAudioInput: { mode: "regular", labelId: "regularFileName" },
    seriousAudioInput: { mode: "serious", labelId: "seriousFileName" },
    awakenAudioInput: { mode: "awaken", labelId: "awakenFileName" }
  };

  Object.values(audioInputs).forEach(({ mode, labelId }) => {
    const savedName = localStorage.getItem(`bgm_name_${mode}`);
    const labelEl = document.getElementById(labelId);
    if (savedName && labelEl) labelEl.textContent = savedName;
  });

  Object.entries(audioInputs).forEach(([inputId, { mode, labelId }]) => {
    const inputEl = document.getElementById(inputId);
    const labelEl = document.getElementById(labelId);

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

  document.getElementById("playRegularBtn").onclick = () => switchModeWithFeedback("regular");
  document.getElementById("playSeriousBtn").onclick = () => switchModeWithFeedback("serious");
  document.getElementById("playAwakenBtn").onclick = () => switchModeWithFeedback("awaken");

  const muteBtn = document.getElementById("muteAudioBtn");
  if (muteBtn) {
    muteBtn.onclick = () => {
      stopBGM();
      const msg = "Background music stopped.";
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

  const msg = success 
    ? `Playing ${mode.toUpperCase()} soundtrack.` 
    : `Switched to ${mode.toUpperCase()} mode. Upload a track in settings to hear custom sound.`;
  addMessage("michael", msg);
  speakText(msg);
}

setupAudioUploads();

// 11. VISION AUTO-START PREFERENCE LOGIC
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
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      startVisionStream();
    }, 3500);
  });
}

// Export token utilities if needed elsewhere in your app
export { saveTokens, getAccessToken, fetchWithAuth, isTokenExpired, handleLogout };
window.fetchWithAuth = fetchWithAuth;