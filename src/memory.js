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