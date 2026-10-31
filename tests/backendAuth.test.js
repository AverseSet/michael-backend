import test from "node:test";
import assert from "node:assert/strict";
import { issueAccessToken, verifyAccessToken } from "../backendAuth.js";

const env = {
  MICHAEL_JWT_SECRET: "unit-test-signing-secret-with-enough-entropy",
  MICHAEL_ADMIN_ACCESS_KEY: "private-admin-key"
};

test("AA issues a 24-hour consumer token", () => {
  const result = issueAccessToken("AA", env);
  assert.equal(result.role, "consumer");
  assert.equal(result.permanent, false);
  assert.ok(result.expiresAt > Date.now());
  assert.deepEqual(verifyAccessToken(`Bearer ${result.token}`, env), { role: "consumer" });
});

test("private admin key issues an admin token without using the consumer key", () => {
  const result = issueAccessToken("private-admin-key", env);
  assert.equal(result.role, "admin");
  assert.equal(result.permanent, false);
  assert.ok(result.expiresAt > Date.now());
  assert.deepEqual(verifyAccessToken(`Bearer ${result.token}`, env), { role: "admin" });
  assert.throws(() => issueAccessToken("wrong-key", env), { status: 401 });
});

test("rejects tokens signed by another server secret and missing bearer tokens", () => {
  const { token } = issueAccessToken("AA", env);
  assert.equal(verifyAccessToken(`Bearer ${token}`, { ...env, MICHAEL_JWT_SECRET: "different-secret" }), null);
  assert.equal(verifyAccessToken(token, env), null);
  assert.throws(() => issueAccessToken("AA", {}), { status: 503 });
  assert.throws(
    () => issueAccessToken("AA", { ...env, MICHAEL_JWT_SECRET: "too-short" }),
    { status: 503 }
  );
  assert.throws(
    () => issueAccessToken("AA", { ...env, MICHAEL_ADMIN_ACCESS_KEY: "AA" }),
    { status: 503 }
  );
});
