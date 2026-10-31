import test from "node:test";
import assert from "node:assert/strict";
import {
  getAIProvider,
  isAIProviderConfigured,
  runQuery,
  setAIProvider
} from "../src/ai.js";

function useLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  return values;
}

test("defaults to device-owned key rotation without requiring a backend", () => {
  useLocalStorage();
  assert.equal(getAIProvider(), "personalFallback");
  assert.equal(isAIProviderConfigured(), false);
});

test("sends chat directly to the selected provider with the user's saved key", async () => {
  useLocalStorage({
    michael_ai_provider: "gemini",
    gemini_api_key: "my-device-key",
    michael_role: "admin"
  });
  let requestedUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    requestOptions = options;
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Direct provider reply" }] } }]
      })
    };
  };

  const result = await runQuery("What do you see?", "Current game context", null, "amongus");

  assert.match(requestedUrl, /^https:\/\/generativelanguage\.googleapis\.com\//);
  assert.match(requestedUrl, /key=my-device-key/);
  assert.equal(requestOptions.headers.Authorization, undefined);
  assert.match(JSON.parse(requestOptions.body).contents[0].parts[0].text, /What do you see\?/);
  assert.match(JSON.parse(requestOptions.body).contents[0].parts[0].text, /Current game context/);
  assert.match(JSON.parse(requestOptions.body).contents[0].parts[0].text, /selected game is Among Us/i);
  assert.equal(result, "Direct provider reply");
});

test("migrates a previously selected backend to personal fallback", () => {
  const values = useLocalStorage({
    michael_ai_provider: "backend",
    michael_role: "admin"
  });
  assert.equal(getAIProvider(), "personalFallback");
  assert.equal(values.get("michael_ai_provider"), "personalFallback");
  assert.throws(() => setAIProvider("backend"), /Unsupported AI provider/);
});

test("allows users to select an individual personal provider", () => {
  useLocalStorage();
  setAIProvider("mistral");
  assert.equal(getAIProvider(), "mistral");
  assert.equal(isAIProviderConfigured(), false);
});
