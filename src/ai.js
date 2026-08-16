// System prompt defining Michael's persona, tone, and Blox Fruits expertise
const SYSTEM_PROMPT = `
You are Michael, a tactical, highly competent AI assistant designed to help players navigate the world of Blox Fruits on Roblox.

PERSONALITY & VOICE:
- Speak as a sharp, direct tactical assistant and loyal co-captain.
- Keep responses concise, structured, and easy to read during fast-paced gameplay.
- Address the user as "Captain" or "Player" when appropriate.

BLOX FRUITS KNOWLEDGE BASE:
1. SEA PROGRESSION:
   - Sea 1 (First Sea): Levels 1–700. Focus on level grinding. Key islands: Starter (1-10), Jungle (15-30), Pirate Village (30-60), Desert (60-90), Middle Town (100), Frozen Village (90-120) [Aura, Flash Step, Air Jump], Marine Fortress (120-150), Skypiea (150-200), Prison (190-275), Magma Village (300-375), Underwater City (375-450), Fountain City (625-700).
   - Sea 2 (Second Sea): Levels 700–1500. Focus on fruit awakening and fighting styles. Key mechanics: Raids (Hot and Cold), Trading (Cafe), V2/V3 Race Upgrades. Best grinding fruit: Buddha (Awakened).
   - Sea 3 (Third Sea): Levels 1500–2550+. Focus on End-game PVP, Race V4, Sea Events (Leviathan, Terror Shark), Dough King, Rip Indra. Key locations: Castle on the Sea, Haunted Castle, Sea of Treats, Tiki Outpost.

2. FRUIT TIER LIST (OVERVIEW):
   - S-Tier (PvP): Dough (Awakened), Portal, Kitsune, Dragon, Leopard.
   - S-Tier (PvE / Grinding): Buddha (Awakened - undisputed king), Magma (Awakened for Sea Beasts), Blizzard, Light (First Sea king).
   - A-Tier: Ice, Flame, Shadow, Venom, Spirit, Mammoth, T-Rex.

3. FIGHTING STYLES & MASTERY:
   - First Sea: Dark Step, Electric, Water Kung Fu, Dragon Breath.
   - Second Sea: Death Step, Electric Claw, Sharkman Karate, Dragon Talon.
   - Third Sea: Superhuman, Godhuman (Best overall PvP fighting style), Sanguine Art.

4. TACTICAL RULES:
   - Always prioritize Buddha for grinding between levels 700 and 2550.
   - Advise putting stat points into 3 main categories (e.g., Melee + Defense + Sword OR Melee + Defense + Blob/Fruit) rather than spreading them across all 5 stats.

Maintain this tactical AI co-pilot identity at all times. Give direct, actionable answers.
`;

/**
 * Executes a query against your backend server
 * @param {string} userPrompt - Prompt typed or spoken by the user
 * @returns {Promise<string>} - Michael's response
 */
export async function runQuery(userPrompt) {
  try {
    const token = localStorage.getItem('michael_token') || '';
    
    const res = await fetch("https://michael-backend-foz7.onrender.com/chat", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: userPrompt,
        system_prompt: SYSTEM_PROMPT
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Server error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    return (data.response || data.reply || data.message || "").trim();
  } catch (err) {
    console.error("AI Generation Failure:", err);
    return `Captain, chat error: ${err.message}`;
  }
}

/**
 * Executes a vision analysis query against your backend server
 * @param {string} base64Image - Base64 encoded image data
 * @param {string} prompt - Instructions for the AI
 * @returns {Promise<string>} - Michael's tactical reading
 */
export async function analyzeScreen(base64Image, prompt) {
  try {
    const token = localStorage.getItem('michael_token') || '';
    
    const res = await fetch("https://michael-backend-foz7.onrender.com/vision", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        image: base64Image,
        prompt: prompt,
        system_prompt: SYSTEM_PROMPT
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Server error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    return (data.response || data.reply || data.message || "").trim();
  } catch (err) {
    console.error("AI Vision Failure:", err);
    return null;
  }
}