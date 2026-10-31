import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/auth.mjs";

const originalEnv = {
  MICHAEL_JWT_SECRET: process.env.MICHAEL_JWT_SECRET,
  MICHAEL_ADMIN_ACCESS_KEY: process.env.MICHAEL_ADMIN_ACCESS_KEY
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("Netlify auth function issues a consumer session for AA", async () => {
  process.env.MICHAEL_JWT_SECRET = "test-signing-secret-that-is-at-least-32-chars";
  process.env.MICHAEL_ADMIN_ACCESS_KEY = "private-admin-key";

  try {
    const response = await handler(new Request("https://example.netlify.app/.netlify/functions/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey: "AA" })
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.role, "consumer");
    assert.equal(body.permanent, false);
    assert.ok(body.expiresAt > Date.now());
    assert.equal(typeof body.token, "string");
  } finally {
    restoreEnvironment();
  }
});

test("Netlify auth function accepts the private admin key and rejects other input", async () => {
  process.env.MICHAEL_JWT_SECRET = "test-signing-secret-that-is-at-least-32-chars";
  process.env.MICHAEL_ADMIN_ACCESS_KEY = "private-admin-key";

  try {
    const adminResponse = await handler(new Request("https://example.netlify.app/.netlify/functions/auth", {
      method: "POST",
      body: JSON.stringify({ accessKey: "private-admin-key" })
    }));
    const adminBody = await adminResponse.json();
    assert.equal(adminResponse.status, 200);
    assert.equal(adminBody.role, "admin");

    const invalidResponse = await handler(new Request("https://example.netlify.app/.netlify/functions/auth", {
      method: "POST",
      body: JSON.stringify({ accessKey: "wrong-key" })
    }));
    assert.equal(invalidResponse.status, 401);
  } finally {
    restoreEnvironment();
  }
});

test("Netlify auth function rejects unsupported methods and malformed bodies", async () => {
  const getResponse = await handler(new Request("https://example.netlify.app/.netlify/functions/auth"));
  assert.equal(getResponse.status, 405);

  const malformedResponse = await handler(new Request("https://example.netlify.app/.netlify/functions/auth", {
    method: "POST",
    body: "not-json"
  }));
  assert.equal(malformedResponse.status, 400);
});
