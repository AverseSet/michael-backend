import test from "node:test";
import assert from "node:assert/strict";
import {
  clearPersonalProviderKeys,
  getConfiguredPersonalProviders,
  runLocalProviderFallback,
  savePersonalProviderKeys
} from "../src/localAiFallback.js";
import { isAIProviderConfigured, runQuery, setAIProvider } from "../src/ai.js";

function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  };
}

test("saves supplied keys locally and keeps blank existing fields", () => {
  const local = createLocalStorage({ gemini_api_key: "old-gemini" });
  savePersonalProviderKeys({
    gemini: "",
    groq: " new-groq ",
    cloudflareAccountId: " account-123 "
  }, { local });

  assert.equal(local.getItem("gemini_api_key"), "old-gemini");
  assert.equal(local.getItem("groq_api_key"), "new-groq");
  assert.equal(local.getItem("cloudflare_account_id"), "account-123");
  assert.deepEqual(
    getConfiguredPersonalProviders({ local }).map(({ id }) => id),
    ["gemini", "groq"]
  );
});

test("rotates through configured personal keys and caps each chat response at 300 tokens", async () => {
  const local = createLocalStorage({
    gemini_api_key: "personal-gemini",
    groq_api_key: "personal-groq"
  });
  const calls = [];
  const warnings = [];
  const result = await runLocalProviderFallback("hello", {
    local,
    logger: { warn: (...args) => warnings.push(args.join(" ")) },
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      if (calls.length === 1) return response(429, { error: { message: "rate limit" } });
      return response(200, { choices: [{ message: { content: "reply from fallback" } }] });
    }
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
  assert.equal(calls[0].body.generationConfig.maxOutputTokens, 300);
  assert.equal(calls[1].body.model, "llama-3.1-8b-instant");
  assert.equal(calls[1].body.max_tokens, 300);
  assert.equal(result.provider, "Groq Cloud");
  assert.equal(result.response, "reply from fallback");
  assert.match(warnings[0], /rate limit; moving to next configured provider/);
});

test("does not send a screenshot to text-only models", async () => {
  const local = createLocalStorage({
    gemini_api_key: "",
    groq_api_key: "personal-groq"
  });
  let callCount = 0;

  await assert.rejects(
    runLocalProviderFallback("Analyze this screen", {
      imageBase64: "screen-image",
      local,
      logger: { warn() {} },
      fetchImpl: async () => {
        callCount += 1;
        return response(200, {});
      }
    }),
    /Live screenshots require a configured image-capable provider/
  );
  assert.equal(callCount, 0);
});

test("clears all personal API keys from device storage", () => {
  const local = createLocalStorage({
    gemini_api_key: "g",
    groq_api_key: "q",
    cloudflare_api_key: "c",
    cloudflare_account_id: "account"
  });
  clearPersonalProviderKeys({ local });
  assert.equal(getConfiguredPersonalProviders({ local }).length, 0);
  assert.equal(local.getItem("cloudflare_account_id"), null);
});

test("allows a specific personal provider to be selected and uses its own key", async () => {
  const local = createLocalStorage({ mistral_api_key: "my-mistral-key" });
  globalThis.localStorage = local;
  let requestedUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    requestBody = JSON.parse(options.body);
    return response(200, { choices: [{ message: { content: "Mistral response" } }] });
  };

  setAIProvider("mistral");
  assert.equal(isAIProviderConfigured(), true);
  assert.equal(await runQuery("Give me advice.", "", null, "amongus"), "Mistral response");
  assert.equal(requestedUrl, "https://api.mistral.ai/v1/chat/completions");
  assert.equal(requestBody.model, "mistral-small-latest");
  assert.equal(requestBody.max_tokens, 300);
});
