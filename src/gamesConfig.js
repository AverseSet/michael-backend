// src/gamesConfig.js
export const gameProfiles = {
  "bloxfruits": {
    name: "Blox Fruits (Roblox)",
    levelInfo: "Sea 1: 1-700 | Sea 2: 700-1500 | Sea 3: 1500+",
    awakenPromptCheck: (frameData) => {
      let redPixels = 0;
      for (let i = 0; i < frameData.length; i += 16) {
        // Scan for health/combat red warning frames
        if (frameData[i] > 200 && frameData[i + 1] < 50 && frameData[i + 2] < 50) {
          redPixels++;
        }
      }
      return redPixels > 1500 
        ? { alert: true, text: "CRITICAL THREAT: Enemy combat target or low health in view!" } 
        : { alert: false, text: "Zero-delay tracking active. Sector clear." };
    }
  },
  "amongus": {
    name: "Among Us",
    levelInfo: "Roles: Crewmate / Impostor | Objective: Task completion & Sabotage defense",
    awakenPromptCheck: (frameData) => {
      let alertPixels = 0;
      for (let i = 0; i < frameData.length; i += 16) {
        // Scan for high red/orange emergency meeting triggers or kill flash indicators
        if (frameData[i] > 220 && frameData[i + 1] > 40 && frameData[i + 1] < 130) {
          alertPixels++;
        }
      }
      return alertPixels > 2000 
        ? { alert: true, text: "🚨 EMERGENCY MEETING OR CRITICAL EVENT DETECTED!" } 
        : { alert: false, text: "Task monitoring active. Watch your vents." };
    }
  }
};