import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";

const ISSUER = "michael-backend";
const CONSUMER_TTL_SECONDS = 24 * 60 * 60;
const ADMIN_TTL_SECONDS = 30 * 24 * 60 * 60;

function secureEquals(value, expected) {
  if (typeof value !== "string" || typeof expected !== "string") return false;
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

export function issueAccessToken(accessKey, env = process.env) {
  const jwtSecret = env.MICHAEL_JWT_SECRET;
  if (typeof jwtSecret !== "string" || jwtSecret.length < 32) {
    const error = new Error("Authentication is not configured on the server.");
    error.status = 503;
    throw error;
  }

  const adminAccessKey = env.MICHAEL_ADMIN_ACCESS_KEY || env.MICHAEL_PERMANENT_ACCESS_KEY;
  if (adminAccessKey === "AA") {
    const error = new Error("The admin access key must be different from the consumer code.");
    error.status = 503;
    throw error;
  }
  const isAdmin = Boolean(adminAccessKey) && secureEquals(accessKey, adminAccessKey);
  const isConsumer = secureEquals(accessKey, "AA");
  if (!isAdmin && !isConsumer) {
    const error = new Error("Invalid access code.");
    error.status = 401;
    throw error;
  }

  const role = isAdmin ? "admin" : "consumer";
  const expiresIn = isAdmin ? ADMIN_TTL_SECONDS : CONSUMER_TTL_SECONDS;
  const token = jwt.sign({ role }, jwtSecret, {
    algorithm: "HS256",
    expiresIn,
    issuer: ISSUER
  });

  return {
    token,
    role,
    permanent: false,
    expiresAt: Date.now() + expiresIn * 1000
  };
}

export function verifyAccessToken(authorization, env = process.env) {
  const jwtSecret = env.MICHAEL_JWT_SECRET;
  const token = typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!jwtSecret || !token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
      issuer: ISSUER
    });
    if (payload.role !== "admin" && payload.role !== "consumer") return null;
    return { role: payload.role };
  } catch {
    return null;
  }
}
