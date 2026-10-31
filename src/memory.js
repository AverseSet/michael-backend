const SERVER_MEMORY_KEY = "michael_server_memory";
const PERMANENT_MEMORY_KEY = "michael_perm_memory";
const CAMPFIRE_KEY = "michael_campfire_location";
const MAX_PLAYER_HISTORY = 30;

function readStoredObject(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : {};
    } catch (error) {
        console.error(`[Memory] Failed to read ${key}:`, error);
        return {};
    }
}

let currentServerId = "Server-1";
const serverMemory = readStoredObject(SERVER_MEMORY_KEY);
let permanentMemory = readStoredObject(PERMANENT_MEMORY_KEY);

function normalizePlayer(player) {
    return player.trim().toLowerCase();
}

function saveServerMemory() {
    localStorage.setItem(SERVER_MEMORY_KEY, JSON.stringify(serverMemory));
}

function savePermanentMemory() {
    localStorage.setItem(PERMANENT_MEMORY_KEY, JSON.stringify(permanentMemory));
}

export function newServer(serverId) {
    currentServerId = serverId || `Server-${Date.now()}`;
    if (!serverMemory[currentServerId]) {
        serverMemory[currentServerId] = {};
        saveServerMemory();
    }
}

export function observePlayer(player, field, value) {
    const key = normalizePlayer(player);
    if (!key || !field) return;
    if (!serverMemory[currentServerId]) serverMemory[currentServerId] = {};
    if (!serverMemory[currentServerId][key]) {
        serverMemory[currentServerId][key] = { history: [] };
    }

    const currentData = serverMemory[currentServerId][key];
    if (JSON.stringify(currentData[field]) === JSON.stringify(value)) {
        currentData.lastSeen = new Date().toISOString();
        return;
    }
    currentData[field] = value;
    currentData.lastSeen = new Date().toISOString();
    currentData.history.push({ time: currentData.lastSeen, field, value });
    currentData.history = currentData.history.slice(-MAX_PLAYER_HISTORY);
    saveServerMemory();
}

export function getObservedPlayer(player) {
    return serverMemory[currentServerId]?.[normalizePlayer(player)] || null;
}

export function getObservedPlayers() {
    return Object.keys(serverMemory[currentServerId] || {});
}

export function forgetObservedPlayer(player) {
    const key = normalizePlayer(player);
    if (serverMemory[currentServerId]?.[key]) {
        delete serverMemory[currentServerId][key];
        saveServerMemory();
    }
}

export function rememberPlayer(player, data) {
    const key = normalizePlayer(player);
    if (!key || !data || typeof data !== "object") return;

    const current = permanentMemory[key] || {};
    const next = { ...current, ...data };
    if (Array.isArray(current.facts) || Array.isArray(data.facts)) {
        const existingFacts = Array.isArray(current.facts) ? current.facts : [];
        const addedFacts = Array.isArray(data.facts) ? data.facts : [];
        next.facts = [...new Set([...existingFacts, ...addedFacts])];
    }
    permanentMemory[key] = next;
    savePermanentMemory();
}

export function rememberFact(player, fact) {
    const normalizedFact = fact.trim();
    if (!normalizedFact) return;
    rememberPlayer(player, { facts: [normalizedFact], updatedAt: new Date().toISOString() });
}

export function getPlayer(player) {
    const key = normalizePlayer(player);
    const saved = permanentMemory[key] || null;
    const observed = getObservedPlayer(key);
    if (!saved && !observed) return null;
    const combined = { ...(saved || {}), ...(observed || {}) };
    if (saved?.profile && typeof saved.profile === "object") {
        Object.assign(combined, saved.profile);
    }
    if (observed?.profile && typeof observed.profile === "object") {
        Object.assign(combined, observed.profile);
    }
    return combined;
}

function formatPlayerMemory(player, data) {
    const details = [];
    if (Array.isArray(data.facts)) details.push(...data.facts);
    for (const field of ["level", "bounty", "fruit", "fightingStyle", "sword", "gun", "race", "accessory", "location"]) {
        const value = data[field];
        if (value !== undefined && value !== null && value !== "") {
            details.push(`${field}: ${value}`);
        }
    }
    if (data.lastSeen) details.push(`last seen ${new Date(data.lastSeen).toLocaleString()}`);
    if (details.length === 0) return null;
    return `${player}: ${[...new Set(details)].join("; ")}`;
}

export function getPlayerMemoryAnswer(player) {
    const data = getPlayer(player);
    if (!data) return null;
    const details = [];
    if (Array.isArray(data.facts)) details.push(...data.facts);
    for (const field of ["level", "bounty", "fruit", "fightingStyle", "sword", "gun", "race", "accessory", "location"]) {
        const value = data[field];
        if (value !== undefined && value !== null && value !== "") {
            details.push(`${field}: ${value}`);
        }
    }
    if (details.length === 0) return null;
    return `${player} — ${[...new Set(details)].join("; ")}`;
}

export function buildMemoryContext(query = "") {
    const normalizedQuery = query.toLowerCase();
    const knownPlayers = new Set([
        ...Object.keys(permanentMemory),
        ...Object.keys(serverMemory[currentServerId] || {})
    ]);
    const namedPlayers = [...knownPlayers].filter((player) => normalizedQuery.includes(player));
    const asksForRanking = /\b(strongest|highest level|most powerful|best build|highest chance|who would win|players|server)\b/i.test(query);
    const relevantPlayers = namedPlayers.length > 0 || asksForRanking
        ? (namedPlayers.length > 0
            ? namedPlayers
            : [...knownPlayers].slice(0, 20))
        : [];
    const entries = relevantPlayers
        .map((player) => {
            const data = getPlayer(player);
            return formatPlayerMemory(player, data);
        })
        .filter(Boolean);

    const context = [];
    if (entries.length > 0) {
        context.push(`Remembered game information from this device (use as evidence, not guesses):\n${entries.map((entry) => `- ${entry}`).join("\n")}`);
    }
    if (asksForRanking) {
        context.push("These observations may not cover the whole server. Compare only recorded levels, bounty, and builds; explain what evidence supports a ranking. Do not invent a win percentage or label a player weak without observed combat evidence.");
    }
    if (/\bcampfire\b/i.test(query)) {
        const campfire = getCampfireLocation();
        if (campfire?.game === "ninetynine" && typeof campfire.screenX === "number" && typeof campfire.screenY === "number") {
            context.push(`The 99 Nights campfire was last visibly detected on-screen at x=${Math.round(campfire.screenX * 100)}%, y=${Math.round(campfire.screenY * 100)}% (${new Date(campfire.savedAt).toLocaleString()}). This is a last-seen screen position, not a world coordinate or a reliable off-screen direction.`);
        }
    }
    return context.join("\n\n");
}

/**
 * Saves a visible-screen location marker. Coordinates must come from actual game evidence.
 */
export function saveCampfireLocation(location) {
    if (!location || typeof location !== "object") {
        throw new Error("Campfire location must contain observed game-location data.");
    }
    localStorage.setItem(CAMPFIRE_KEY, JSON.stringify(location));
}

export function getCampfireLocation() {
    try {
        const saved = localStorage.getItem(CAMPFIRE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (error) {
        console.error("[Memory] Failed to retrieve campfire location:", error);
        return null;
    }
}

export function clearPermanentMemoryCompletely() {
    localStorage.removeItem(CAMPFIRE_KEY);
    localStorage.removeItem(PERMANENT_MEMORY_KEY);
    localStorage.removeItem(SERVER_MEMORY_KEY);
    localStorage.removeItem("michael_campfire_route");
    permanentMemory = {};
    for (const serverId of Object.keys(serverMemory)) delete serverMemory[serverId];
}
