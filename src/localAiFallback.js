const MAX_OUTPUT_TOKENS = 300;
const PROVIDER_TIMEOUT_MS = 15000;

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google AI Studio",
    storageKey: "gemini_api_key",
    model: "gemini-3.5-flash",
    supportsImages: true,
    endpoint: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(key)}`
  },
  {
    id: "groq",
    name: "Groq Cloud",
    storageKey: "groq_api_key",
    model: "llama-3.1-8b-instant",
    endpoint: () => "https://api.groq.com/openai/v1/chat/completions"
  },
  {
    id: "cerebras",
    name: "Cerebras Inference",
    storageKey: "cerebras_api_key",
    model: "llama3.1-8b",
    endpoint: () => "https://api.cerebras.ai/v1/chat/completions"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    storageKey: "openrouter_api_key",
    model: "meta-llama/llama-3.2-3b-instruct:free",
    endpoint: () => "https://openrouter.ai/api/v1/chat/completions"
  },
  {
    id: "mistral",
    name: "Mistral AI",
    storageKey: "mistral_api_key",
    model: "mistral-small-latest",
    endpoint: () => "https://api.mistral.ai/v1/chat/completions"
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    storageKey: "nvidia_api_key",
    model: "meta/llama-3.1-8b-instruct",
    endpoint: () => "https://integrate.api.nvidia.com/v1/chat/completions"
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    storageKey: "cloudflare_api_key",
    model: "@cf/meta/llama-3-8b-instruct",
    endpoint: () => {
      const accountId = localStorage.getItem("cloudflare_account_id")?.trim();
      if (!accountId) throw new Error("Cloudflare also requires an account ID in AI Settings.");
      return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;
    }
  },
  {
    id: "cohere",
    name: "Cohere",
    storageKey: "cohere_api_key",
    model: "command-light",
    endpoint: () => "https://api.cohere.com/v2/chat"
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    storageKey: "huggingface_api_key",
    model: "Qwen/Qwen2.5-7B-Instruct",
    endpoint: () => "https://router.huggingface.co/v1/chat/completions"
  },
  {
    id: "alibaba",
    name: "Alibaba Model Studio",
    storageKey: "alibaba_api_key",
    model: "qwen-turbo",
    endpoint: () => "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
  }
];

function readResponseText(provider, data) {
  if (provider.id === "gemini") {
    return data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim() || "";
  }
  if (provider.id === "cohere") {
    const content = data?.message?.content;
    if (typeof content === "string") return content.trim();
    return Array.isArray(content) ? content.map((part) => part?.text || "").join("").trim() : "";
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  return Array.isArray(content) ? content.map((part) => part?.text || "").join("").trim() : "";
}

function createRequest(provider, key, prompt, imageBase64) {
  if (provider.id === "gemini") {
    const parts = [{ text: prompt }];
    if (imageBase64) parts.push({ inline_data: { mime_type: "image/jpeg", data: imageBase64 } });
    return {
      url: provider.endpoint(key),
      headers: { "Content-Type": "application/json" },
      body: {
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS }
      }
    };
  }

  if (imageBase64 && !provider.supportsImages) {
    throw new Error(`${provider.name} model does not accept screenshots.`);
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  if (provider.id === "cohere") {
    return {
      url: provider.endpoint(),
      headers,
      body: {
        model: provider.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_OUTPUT_TOKENS
      }
    };
  }

  return {
    url: provider.endpoint(),
    headers,
    body: {
      model: provider.model,
      messages: [{
        role: "user",
        content: prompt
      }],
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: false
    }
  };
}

async function requestProvider(provider, key, prompt, imageBase64, fetchImpl, timeoutMs) {
  const request = createRequest(provider, key, prompt, imageBase64);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal
    });
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { message: raw };
    }

    if (!response.ok) {
      const message = typeof data?.error === "string"
        ? data.error
        : data?.error?.message || data?.message || `Request failed (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const result = readResponseText(provider, data);
    if (!result) throw new Error(`${provider.name} returned no text content.`);
    return result;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${provider.name} timed out.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function classifyError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (error?.status === 429 || /rate.?limit|too many requests/.test(message)) return "rate limit";
  if (/timed out|timeout/.test(message)) return "timeout";
  if (/quota|credit|billing/.test(message)) return "quota";
  return "request failure";
}

export function getConfiguredPersonalProviders({ local = globalThis.localStorage } = {}) {
  return PROVIDERS.filter((provider) => Boolean(local.getItem(provider.storageKey)?.trim()));
}

export function savePersonalProviderKeys(values, { local = globalThis.localStorage } = {}) {
  for (const provider of PROVIDERS) {
    const value = values[provider.id];
    if (typeof value === "string" && value.trim()) {
      local.setItem(provider.storageKey, value.trim());
    }
  }
  if (typeof values.cloudflareAccountId === "string" && values.cloudflareAccountId.trim()) {
    local.setItem("cloudflare_account_id", values.cloudflareAccountId.trim());
  }
}

export function clearPersonalProviderKeys({ local = globalThis.localStorage } = {}) {
  for (const provider of PROVIDERS) local.removeItem(provider.storageKey);
  local.removeItem("cloudflare_account_id");
}

export async function runLocalProviderFallback(prompt, {
  imageBase64 = null,
  local = globalThis.localStorage,
  fetchImpl = globalThis.fetch,
  logger = console,
  timeoutMs = PROVIDER_TIMEOUT_MS,
  providerIds = null
} = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("A prompt is required.");
  if (typeof fetchImpl !== "function") throw new Error("Fetch is not available in this browser.");
  const selectedProviders = providerIds
    ? PROVIDERS.filter((provider) => providerIds.includes(provider.id))
    : PROVIDERS;
  const configuredProviders = selectedProviders.filter((provider) => Boolean(local.getItem(provider.storageKey)?.trim()));
  const providers = imageBase64
    ? configuredProviders.filter((provider) => provider.supportsImages)
    : configuredProviders;

  if (providers.length === 0) {
    if (imageBase64) {
      throw new Error("Live screenshots require a configured image-capable provider. Add a Gemini API key or switch to Ollama.");
    }
    if (providerIds?.length === 1) {
      const provider = PROVIDERS.find((candidate) => candidate.id === providerIds[0]);
      throw new Error(`Add your ${provider?.name || "selected provider"} API key in Settings.`);
    }
    throw new Error("Add at least one personal provider API key in Settings to use personal fallback rotation.");
  }

  const failures = [];
  for (const provider of providers) {
    try {
      const response = await requestProvider(
        provider,
        local.getItem(provider.storageKey).trim(),
        prompt,
        imageBase64,
        fetchImpl,
        timeoutMs
      );
      return { provider: provider.name, response };
    } catch (error) {
      const category = classifyError(error);
      failures.push(`${provider.name}: ${category}`);
      logger.warn(`[Personal AI fallback] ${provider.name} ${category}; moving to next configured provider.`);
    }
  }

  throw new Error(`All configured personal AI providers failed. ${failures.join("; ")}`);
}

export const PERSONAL_AI_PROVIDERS = PROVIDERS.map(({ id, name, model }) => ({ id, name, model }));
