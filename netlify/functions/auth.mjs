import { issueAccessToken } from "../../backendAuth.js";

function jsonResponse(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON request body." });
  }

  try {
    return jsonResponse(200, issueAccessToken(body?.accessKey));
  } catch (error) {
    return jsonResponse(error.status || 500, { error: error.message || "Login failed." });
  }
}
