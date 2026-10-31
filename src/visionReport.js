const PLAYER_FIELDS = ["level", "bounty", "fruit", "fightingStyle", "sword", "gun", "race", "accessory", "location"];

function parseJsonReport(response) {
  const firstBrace = response.indexOf("{");
  const lastBrace = response.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  try {
    return JSON.parse(response.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function normalizePlayer(player) {
  if (!player || typeof player !== "object" || typeof player.name !== "string") return null;
  const name = player.name.trim();
  if (!/^[A-Za-z0-9_]{1,20}$/.test(name)) return null;

  const confidence = player.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;

  const profile = {};
  for (const field of PLAYER_FIELDS) {
    const value = player[field];
    if ((typeof value === "string" && value.trim()) || (typeof value === "number" && Number.isFinite(value))) {
      profile[field] = typeof value === "string" ? value.trim() : value;
    }
  }
  return { name, confidence, profile };
}

function normalizeCampfire(campfire) {
  if (!campfire || campfire.visible !== true) return null;
  const screenX = campfire.screenX;
  const screenY = campfire.screenY;
  if (typeof screenX !== "number" || typeof screenY !== "number") return null;
  if (screenX < 0 || screenX > 1 || screenY < 0 || screenY > 1) return null;
  return { screenX, screenY };
}

function normalizeAmongUs(data) {
  if (!data || typeof data !== "object") return null;
  const players = Array.isArray(data.players)
    ? data.players.flatMap((player) => {
      if (!player || typeof player.color !== "string" || typeof player.room !== "string") return [];
      const confidence = player.confidence;
      if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return [];
      return [{ color: player.color.trim(), room: player.room.trim(), confidence }];
    })
    : [];
  const body = data.body && typeof data.body === "object"
    ? {
      visible: data.body.visible === true
        && typeof data.body.confidence === "number"
        && Number.isFinite(data.body.confidence)
        && data.body.confidence >= 0.65
        && data.body.confidence <= 1,
      color: typeof data.body.color === "string" ? data.body.color.trim() : null,
      room: typeof data.body.room === "string" ? data.body.room.trim() : null,
      confidence: typeof data.body.confidence === "number" ? data.body.confidence : null
    }
    : { visible: false, color: null, room: null, confidence: null };
  return { players, body };
}

export function parseVisionReport(response) {
  if (typeof response !== "string" || !response.trim()) return null;
  const data = parseJsonReport(response);
  if (!data || typeof data !== "object") {
    return { summary: response.trim(), players: [], campfire: null, amongUs: null };
  }

  const players = Array.isArray(data.players)
    ? data.players.map(normalizePlayer).filter(Boolean)
    : [];
  const summary = typeof data.summary === "string" && data.summary.trim()
    ? data.summary.trim()
    : "Screen analyzed. No clear tactical update was detected.";

  return {
    summary,
    players,
    campfire: normalizeCampfire(data.campfire),
    amongUs: normalizeAmongUs(data.amongUs),
    visualTarget: normalizeVisualTarget(data.visualTarget)
  };
}

function normalizeVisualTarget(target) {
  if (!target || target.visible !== true) return null;
  if (typeof target.name !== "string" || !target.name.trim()) return null;
  const { screenX, screenY, confidence } = target;
  if (
    typeof screenX !== "number" || !Number.isFinite(screenX) || screenX < 0 || screenX > 1
    || typeof screenY !== "number" || !Number.isFinite(screenY) || screenY < 0 || screenY > 1
    || typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0.65 || confidence > 1
  ) return null;
  return { name: target.name.trim().slice(0, 40), screenX, screenY, confidence };
}
