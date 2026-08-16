let currentServerId = "Server-1";
let serverMemory = {};
let permanentMemory = JSON.parse(localStorage.getItem("michael_perm_memory") || "{}");

export function newServer(serverId) {
    currentServerId = serverId || `Server-${Date.now()}`;
    serverMemory[currentServerId] = {};
}

export function observePlayer(player, field, value) {
    const key = player.toLowerCase();
    if (!serverMemory[currentServerId]) serverMemory[currentServerId] = {};
    if (!serverMemory[currentServerId][key]) {
        serverMemory[currentServerId][key] = { history: [], lastSeen: new Date().toLocaleTimeString() };
    }

    const currentData = serverMemory[currentServerId][key];
    currentData[field] = value;
    currentData.lastSeen = new Date().toLocaleTimeString();
    currentData.history.push({ time: currentData.lastSeen, field, value });
}

export function getObservedPlayer(player) {
    return serverMemory[currentServerId]?.[player.toLowerCase()] || null;
}

export function getObservedPlayers() {
    return Object.keys(serverMemory[currentServerId] || {});
}

export function forgetObservedPlayer(player) {
    if (serverMemory[currentServerId]?.[player.toLowerCase()]) {
        delete serverMemory[currentServerId][player.toLowerCase()];
    }
}

export function rememberPlayer(player, data) {
    const key = player.toLowerCase();
    permanentMemory[key] = { ...(permanentMemory[key] || {}), ...data };
    localStorage.setItem("michael_perm_memory", JSON.stringify(permanentMemory));
}

export function getPlayer(player) {
    return permanentMemory[player.toLowerCase()] || null;
}

// --- 99 NIGHTS CAMPFIRE & CLEAR PERMANENT MEMORY INTEGRATION ---

const CAMPFIRE_KEY = 'michael_campfire_location';

/**
 * Saves the campfire coordinates into permanent memory.
 * @param {Object} coords - The { x, y } coordinates of the campfire.
 */
export function saveCampfireLocation(coords) {
    try {
        localStorage.setItem(CAMPFIRE_KEY, JSON.stringify(coords));
    } catch (err) {
        console.error("[Memory] Failed to save campfire location:", err);
    }
}

/**
 * Retrieves the saved campfire coordinates from permanent memory.
 * @returns {Object|null} - The coordinates object or null if not found.
 */
export function getCampfireLocation() {
    try {
        const saved = localStorage.getItem(CAMPFIRE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (err) {
        console.error("[Memory] Failed to retrieve campfire location:", err);
        return null;
    }
}

/**
 * Completely clears all permanent memory structures, including campfire markers and player data.
 */
export function clearPermanentMemoryCompletely() {
    try {
        localStorage.removeItem(CAMPFIRE_KEY);
        localStorage.removeItem("michael_perm_memory");
        permanentMemory = {};
    } catch (err) {
        console.error("[Memory] Error clearing permanent memory:", err);
    }
}