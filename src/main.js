import "./style.css";
import { runQuery } from "./ai.js";
import { handleCommand } from "./commands.js";
import { initBGM, setBGMMode, stopBGM } from "./bgm.js";
import { gameProfiles } from "./gamesConfig.js";

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

// 2. RENDER FULL APPLICATION UI INSIDE #app (INCLUDING LOADER)
document.querySelector("#app").innerHTML = `
  <div id="loader">
    <div class="spinner"></div>
    <p id="loaderText">Initializing Michael AI Systems...</p>
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

          <!-- INPUT AREA -->
          <div class="input-area" style="display: flex; align-items: center; gap: 10px;">
            <input type="text" id="userInput" placeholder="Ask Michael or speak your command..." style="flex: 1;" />
            <button id="micBtn" title="Speak to Michael" style="width: 45px; height: 42px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; border-radius: 8px; background: #1e293b; border: 1px solid #475569; color: #fff; cursor: pointer;">🎤</button>
            <button id="sendBtn" class="action-btn" style="width: 80px; height: 42px; padding: 0; font-size: 0.95rem; border-radius: 8px;">Send</button>
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

        <!-- TUTORIAL VIEW -->
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
              <p style="color: #b2bec3; font-size: 0.9rem; line-height: 1.5;">Configure background audio tracks (Regular, Serious, and Awaken mode) in Settings. Use <code>!mode awaken</code> for real-time zero-delay visual alerts.</p>
            </div>
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

          <!-- CONTACT US ON DISCORD -->
          <div class="setting-group" style="background: #181824; padding: 15px; border-radius: 8px; border: 1px solid #6c5ce7; margin-bottom: 20px;">
            <label style="color: #38bdf8; font-weight: bold; display: block; margin-bottom: 5px;">💬 Contact Us on Discord</label>
            <p style="color: #b2bec3; font-size: 0.85rem; margin-bottom: 10px;">Join our community server to get support, share feedback, and connect with other captains!</p>
            <a href="https://discord.gg/cRXk3Pz8S" target="_blank" style="display: inline-block; padding: 8px 16px; background: #5865F2; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">Open Discord Invite</a>
          </div>

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

// Loader Animation Sequence
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

initBGM();

// 3. PIPER TTS ENGINE (Updated with Render Cloud Backend URL)
async function speakText(text) {
  try {
    if (currentPlayingAudio) {
      currentPlayingAudio.pause();
      currentPlayingAudio.currentTime = 0;
    }

    const response = await fetchWithAuth(`https://michael-backend-foz7.onrender.com/api/tts?t=${Date.now()}`, {
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

// 4. CHAT AND COMMAND LOGIC
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

  addMessage("michael", "Thinking...");
  const response = await runQuery(text);
  
  chatBox.lastElementChild.remove();
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

// 5. STT (SPEECH-TO-TEXT) MICROPHONE CONTROL & WAKE WORD LISTENER ("Yo Michael")
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
    // Auto-restart continuous listening loop
    try {
      recognition.start();
    } catch (e) {}
  };

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    const lowerTranscript = transcript.toLowerCase();

    // Check if wake word is uttered ("yo michael" or "hey michael")
    if (lowerTranscript.startsWith("yo michael") || lowerTranscript.startsWith("hey michael")) {
      const command = transcript.replace(/^(yo michael|hey michael)\s*/i, "").trim();
      if (command.length > 0 && event.results[event.results.length - 1].isFinal) {
        recognition.stop();
        processUserCommand(command);
      }
    }
  };

  // Start continuous wake-word listening on boot
  try {
    recognition.start();
  } catch (e) {
    console.log("Wake word listener auto-start deferred:", e);
  }

  // Manual button click fallback
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

// 6. REAL-TIME & ZERO-DELAY DYNAMIC VISION ENGINE
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

// 7. GAME PROFILE SWITCHER LOGIC
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

// 8. SIDEBAR & VIEW NAVIGATION CONTROLS
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

// 9. SOUNDTRACK & AUDIO CONTROLS
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

// 10. VISION AUTO-START PREFERENCE LOGIC
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

export { getAccessToken, fetchWithAuth };
window.fetchWithAuth = fetchWithAuth;