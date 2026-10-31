import {
  getConfiguredPersonalProviders,
  PERSONAL_AI_PROVIDERS,
  runLocalProviderFallback
} from "./localAiFallback.js";

const SYSTEM_PROMPT = `
You are Michael, a tactical AI co-pilot for the game currently selected by the player.
Speak naturally and concisely, with direct, useful advice suited to gameplay.
Use only the selected game's rules and the context supplied for the current request.
Never claim you can only help with a different game. Do not invent details that are
not visible, known, or present in the supplied context. Distinguish observations
from estimates, and say when something is uncertain. Avoid raw Markdown delimiters.
`;
const GAME_INSTRUCTIONS = {
  bloxfruits: "The selected game is Blox Fruits on Roblox. Help with its islands, leveling, fruits, builds, and combat.",
  amongus: "The selected game is Among Us. Help with tasks, roles, meetings, sabotage, and evidence-based social deduction. Never present suspicion as proof or identify a killer from a single screenshot.",
  ninetynine: "The selected game is 99 Nights in the Forest on Roblox. Help with survival, resources, and the campfire. Give a location only when it is visible or supplied by saved context; never invent coordinates."
};
const AI_PROVIDER_KEY = "michael_ai_provider";
const PROVIDER_KEYS = {
  gemini: "gemini_api_key",
  groq: "groq_api_key",
  ollama: "ollama_base_url"
};
const DEFAULTS = {
  geminiModel: "gemini-3.5-flash",
  groqModel: "qwen/qwen3.8-27b",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "qwen3-vl:8b"
};
const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

const PERSONAL_PROVIDER_IDS = new Set(PERSONAL_AI_PROVIDERS.map(({ id }) => id));
const AI_PROVIDERS = new Set([
  "personalFallback",
  ...PERSONAL_PROVIDER_IDS,
  "ollama"
]);

export function getAIProvider() {
  const provider = localStorage.getItem(AI_PROVIDER_KEY) || "personalFallback";
  if (provider === "backend") {
    localStorage.setItem(AI_PROVIDER_KEY, "personalFallback");
    return "personalFallback";
  }
  return AI_PROVIDERS.has(provider) ? provider : "personalFallback";
}

export function setAIProvider(provider) {
  if (!AI_PROVIDERS.has(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  localStorage.setItem(AI_PROVIDER_KEY, provider);
}

export function getAIProviderSettings() {
  return {
    geminiApiKey: (localStorage.getItem(PROVIDER_KEYS.gemini) || "").trim(),
    groqApiKey: (localStorage.getItem(PROVIDER_KEYS.groq) || "").trim(),
    ollamaBaseUrl: (localStorage.getItem(PROVIDER_KEYS.ollama) || DEFAULTS.ollamaBaseUrl).trim(),
    ollamaModel: (localStorage.getItem("ollama_model") || DEFAULTS.ollamaModel).trim(),
    groqModel: (localStorage.getItem("groq_model") || DEFAULTS.groqModel).trim(),
    geminiModel: (localStorage.getItem("gemini_model") || DEFAULTS.geminiModel).trim()
  };
}

export function isAIProviderConfigured(provider = getAIProvider()) {
  const settings = getAIProviderSettings();
  if (provider === "personalFallback") return getConfiguredPersonalProviders().length > 0;
  if (PERSONAL_PROVIDER_IDS.has(provider)) {
    return getConfiguredPersonalProviders().some((configuredProvider) => configuredProvider.id === provider);
  }
  if (provider === "gemini") return Boolean(settings.geminiApiKey);
  if (provider === "groq") return Boolean(settings.groqApiKey);
  if (provider === "ollama") {
    return Boolean(
      localStorage.getItem(PROVIDER_KEYS.ollama)?.trim()
      && localStorage.getItem("ollama_model")?.trim()
    );
  }
  return false;
}

export function saveAIProviderSettings(values) {
  setAIProvider(values.provider);
  if (values.geminiApiKey?.trim()) {
    localStorage.setItem(PROVIDER_KEYS.gemini, values.geminiApiKey.trim());
  }
  if (values.groqApiKey?.trim()) {
    localStorage.setItem(PROVIDER_KEYS.groq, values.groqApiKey.trim());
  }
  if (typeof values.ollamaBaseUrl === "string" && values.ollamaBaseUrl.trim()) {
    localStorage.setItem(PROVIDER_KEYS.ollama, values.ollamaBaseUrl.trim().replace(/\/+$/, ""));
  }
  if (typeof values.ollamaModel === "string" && values.ollamaModel.trim()) {
    localStorage.setItem("ollama_model", values.ollamaModel.trim());
  }
  if (typeof values.groqModel === "string" && values.groqModel.trim()) {
    localStorage.setItem("groq_model", values.groqModel.trim());
  }
  if (typeof values.geminiModel === "string" && values.geminiModel.trim()) {
    localStorage.setItem("gemini_model", values.geminiModel.trim());
  }
}

function parseGeminiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim();

  if (text) return text;
  return payload?.text || payload?.response || '';
}

function getRetryDelayMs(response, attempt) {
  const retryAfter = response.headers.get('Retry-After');
  let retryAfterMs = 0;

  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryDate = Date.parse(retryAfter);
    if (Number.isFinite(seconds)) {
      retryAfterMs = seconds * 1000;
    } else if (Number.isFinite(retryDate)) {
      retryAfterMs = Math.max(0, retryDate - Date.now());
    }
  }

  return Math.min(Math.max(1000 * 2 ** (attempt - 1), retryAfterMs), 8000);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getProviderCredential(provider, settings) {
  if (provider === "gemini") return settings.geminiApiKey;
  if (provider === "groq") return settings.groqApiKey;
  return "";
}

function getApiError(data, fallback) {
  return data?.error?.message
    || data?.error
    || data?.message
    || fallback;
}

async function requestGemini(parts, requestType, settings) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiModel)}:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`;
  const body = JSON.stringify({ contents: [{ parts }] });

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const data = await response.json();

    if (response.ok) return data;

    const errorMessage = getApiError(data, JSON.stringify(data));
    if (!GEMINI_RETRYABLE_STATUSES.has(response.status) || attempt === GEMINI_MAX_ATTEMPTS) {
      if (response.status === 503 && attempt === GEMINI_MAX_ATTEMPTS) {
        throw new Error(`Gemini is still busy after ${GEMINI_MAX_ATTEMPTS} attempts. Please wait a moment and send your message again. Details: ${errorMessage}`);
      }
      throw new Error(`Gemini ${requestType} error (${response.status}): ${errorMessage}`);
    }

    await wait(getRetryDelayMs(response, attempt));
  }

  throw new Error('Gemini request ended without a response.');
}

async function requestGroq(prompt, imageBase64, settings) {
  const model = settings.groqModel;
  const messages = [{
    role: "user",
    content: imageBase64
      ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
      : prompt
  }];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.groqApiKey}`
    },
    body: JSON.stringify({ model, messages, stream: false })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Groq ${response.status}: ${getApiError(data, JSON.stringify(data))}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => part?.text || "").join("").trim();
    if (text) return text;
  }
  throw new Error("Groq returned no text content.");
}

async function requestOllamaChat(prompt, imageBase64, settings) {
  const messages = [{ role: "user", content: prompt }];
  if (imageBase64) messages[0].images = [imageBase64];

  const response = await fetch(`${settings.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: settings.ollamaModel, messages, stream: false })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${getApiError(data, JSON.stringify(data))}`);
  }
  const content = data?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama returned no text content.");
  }
  return content.trim();
}

async function requestProvider(prompt, imageBase64, requestType) {
  const provider = getAIProvider();
  const settings = getAIProviderSettings();
  if (provider === "personalFallback" || (PERSONAL_PROVIDER_IDS.has(provider) && !["gemini", "groq"].includes(provider))) {
    const result = await runLocalProviderFallback(prompt, {
      imageBase64,
      providerIds: provider === "personalFallback" ? null : [provider]
    });
    return result.response;
  }
  const credential = getProviderCredential(provider, settings);
  if (provider !== "ollama" && !credential) {
    throw new Error(`Add your ${provider === "groq" ? "Groq" : "Gemini"} API key in Settings.`);
  }
  if (provider === "ollama" && (!settings.ollamaBaseUrl || !settings.ollamaModel)) {
    throw new Error("Set your Ollama server address and installed model in Settings.");
  }

  try {
    if (provider === "gemini") {
      const parts = [{ text: prompt }];
      if (imageBase64) {
        parts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: imageBase64
          }
        });
      }
      const data = await requestGemini(parts, requestType, settings);
      const text = parseGeminiText(data);
      if (!text) throw new Error("Gemini returned no text content.");
      return text;
    }
    if (provider === "groq") return await requestGroq(prompt, imageBase64, settings);
    if (provider === "ollama") {
      return await requestOllamaChat(prompt, imageBase64, settings);
    }
  } catch (error) {
    if (provider === "ollama" && error instanceof TypeError) {
      throw new Error("Could not reach Ollama. Check that it is running, the server URL is reachable, and Ollama allows requests from Michael (CORS). On Android, localhost refers to the phone, not your computer.");
    }
    throw error;
  }
  throw new Error("The selected AI provider is not supported.");
}

/**
 * Executes a query against the selected AI provider.
 * @param {string} userPrompt - Prompt typed or spoken by the user
 * @returns {Promise<string>} - Michael's response
 */
export async function runQuery(userPrompt, memoryContext = "", screenImage = null, gameKey = "") {
  try {
    const gameInstructions = GAME_INSTRUCTIONS[gameKey]
      || "No game-specific profile is selected. Ask which game the player means when that matters.";
    const prompt = `${SYSTEM_PROMPT}

SELECTED GAME INSTRUCTIONS:\n${gameInstructions}
${memoryContext ? `CURRENT GAME AND RELEVANT CONTEXT:\n${memoryContext}\nUse saved facts when answering questions about remembered players. Separate observed facts from estimates.` : ""}
${screenImage ? "A current live gameplay screenshot is attached. Inspect it to answer the user's question. Never claim you cannot see the shared screen; describe only what is visible and say when something is unclear." : ""}

User: ${userPrompt}`;
    return await requestProvider(prompt, screenImage, "chat");
  } catch (err) {
    console.error('AI Generation Failure:', err);
    return `Captain, AI error: ${err.message}`;
  }
}

/**
 * Executes a vision analysis query against the selected AI provider.
 * @param {string} base64Image - Base64 encoded image data
 * @param {string} prompt - Instructions for the AI
 * @returns {Promise<string>} - Michael's tactical reading
 */
export async function analyzeScreen(base64Image, prompt) {
  return await requestProvider(prompt || "Analyze this game screen:", base64Image, "vision");
}
