const ROOM_EVIDENCE_TTL_MS = 120_000;
const COLORS = new Set([
  "red", "blue", "green", "pink", "orange", "yellow", "black", "white",
  "purple", "brown", "cyan", "lime", "maroon", "rose", "banana", "gray",
  "tan", "coral"
]);

export function createAmongUsTracker() {
  return {
    coVisits: new Map(),
    suspicion: new Map(),
    bodyVisible: false,
    latestBody: null
  };
}

function normalizeColor(color) {
  if (typeof color !== "string") return null;
  const normalized = color.trim().toLowerCase();
  return COLORS.has(normalized) ? normalized : null;
}

function normalizeRoom(room) {
  if (typeof room !== "string") return null;
  const normalized = room.trim().replace(/\s+/g, " ");
  return normalized.length > 0 && normalized.length <= 40 ? normalized : null;
}

function pairKey(first, second) {
  return [first, second].sort().join(":");
}

function suspicionFromEvidence(ageMs, candidateCount) {
  const clueStrength = ageMs <= 30_000 ? 80 : ageMs <= 60_000 ? 60 : 40;
  return Math.round(clueStrength / Math.max(1, candidateCount));
}

export function updateAmongUsTracker(tracker, observation, now = Date.now()) {
  if (!observation || !Array.isArray(observation.players)) return tracker;

  const playersByRoom = new Map();
  for (const player of observation.players) {
    if (typeof player?.confidence !== "number" || player.confidence < 0.65 || player.confidence > 1) continue;
    const color = normalizeColor(player?.color);
    const room = normalizeRoom(player?.room);
    if (!color || !room) continue;
    if (!playersByRoom.has(room)) playersByRoom.set(room, new Set());
    playersByRoom.get(room).add(color);
  }

  for (const [room, colors] of playersByRoom) {
    const visibleColors = [...colors];
    for (let first = 0; first < visibleColors.length; first += 1) {
      for (let second = first + 1; second < visibleColors.length; second += 1) {
        tracker.coVisits.set(`${room.toLowerCase()}|${pairKey(visibleColors[first], visibleColors[second])}`, now);
      }
    }
  }

  const body = observation.body;
  if (body?.visible !== true) {
    tracker.bodyVisible = false;
    return tracker;
  }

  const victim = normalizeColor(body.color);
  const room = normalizeRoom(body.room);
  if (!victim || !room) {
    tracker.bodyVisible = false;
    return tracker;
  }

  if (tracker.bodyVisible) return tracker;
  tracker.bodyVisible = true;
  tracker.latestBody = { color: victim, room, foundAt: now };

  const candidates = [];
  for (const color of COLORS) {
    if (color === victim) continue;
    const seenAt = tracker.coVisits.get(
      `${room.toLowerCase()}|${pairKey(victim, color)}`
    );
    if (seenAt !== undefined && now >= seenAt && now - seenAt <= ROOM_EVIDENCE_TTL_MS) {
      candidates.push({ color, ageMs: now - seenAt });
    }
  }

  for (const candidate of candidates) {
    const evidenceScore = suspicionFromEvidence(candidate.ageMs, candidates.length);
    const existing = tracker.suspicion.get(candidate.color);
    const score = existing
      ? Math.min(95, Math.round(100 * (1 - (1 - existing.score / 100) * (1 - evidenceScore / 100))))
      : evidenceScore;
    tracker.suspicion.set(candidate.color, {
      color: candidate.color,
      score,
      room,
      evidenceCount: (existing?.evidenceCount || 0) + 1,
      updatedAt: now
    });
  }

  return tracker;
}

export function getAmongUsSuspects(tracker) {
  return [...tracker.suspicion.values()].sort((first, second) => second.score - first.score);
}
