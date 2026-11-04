import { issueAccessToken } from "../../backendAuth.js";

const MOBILE_APP_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return {};

  const headers = { Vary: "Origin" };
  if (MOBILE_APP_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(statusCode, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export default async function handler(request) {
  const headers = corsHeaders(request);

  if (request.method === "OPTIONS") {
    if (!headers["Access-Control-Allow-Origin"]) {
      return jsonResponse(403, { error: "Origin not allowed." }, headers);
    }
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON request body." }, headers);
  }

  try {
    return jsonResponse(200, issueAccessToken(body?.accessKey), headers);
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Login failed."
    }, headers);
  }
}
