// Quick reference data for Blox Fruits commands

const seaGuides = {
  first: {
    name: "First Sea (Sea 1)",
    levels: "1 – 700",
    keyIslands: [
      "Starter Island (Lv. 0 - 10)",
      "Jungle (Lv. 15 - 30) -> Gorilla King",
      "Pirate Village (Lv. 30 - 60) -> Bobby",
      "Desert (Lv. 60 - 90)",
      "Middle Town (Lv. 100) -> Saw Boss",
      "Frozen Village (Lv. 90 - 120) -> Learn Aura/Flash Step/Double Jump",
      "Marine Fortress (Lv. 120 - 150)",
      "Skypiea (Lv. 150 - 200)",
      "Prison (Lv. 190 - 275) -> Warden & Doflamingo",
      "Magma Village (Lv. 300 - 375)",
      "Underwater City (Lv. 375 - 450)",
      "Fountain City (Lv. 625 - 700) -> Cyborg"
    ],
    bestFruits: "Light (Best for grinding), Buddha, Ice, Flame"
  },
  second: {
    name: "Second Sea (Sea 2)",
    levels: "700 – 1500",
    keyIslands: [
      "Kingdom of Rose (Lv. 700 - 850) -> Diamond & Jeremy",
      "Green Zone (Lv. 875 - 925) -> Fajita",
      "Graveyard (Lv. 950 - 1000)",
      "Snow Mountain (Lv. 1000 - 1100)",
      "Hot and Cold (Lv. 1100 - 1250) -> Raid NPC / Smoke Admiral",
      "Cursed Ship (Lv. 1250 - 1350) -> Ectoplasm / Ghoul Race",
      "Ice Castle (Lv. 1350 - 1425) -> Rengoku Key",
      "Forgotten Island (Lv. 1425 - 1500) -> Tide Keeper"
    ],
    bestFruits: "Awakened Buddha (King of Sea 2), Magma, Blizzard"
  },
  third: {
    name: "Third Sea (Sea 3)",
    levels: "1500 – 2550+",
    keyIslands: [
      "Port Town (Lv. 1500 - 1575) -> Stone",
      "Hydra Island (Lv. 1575 - 1700) -> Island Empress / V3/V4 Quests",
      "Great Tree (Lv. 1700 - 1775) -> Kilo Admiral",
      "Floating Turtle (Lv. 1775 - 2000) -> Musketeer Pirate / Electric Claw",
      "Castle on the Sea (Lv. 2000+) -> Raid Bosses / Dough King / Rip Indra",
      "Haunted Castle (Lv. 2000 - 2125) -> Soul Reaper / Death King",
      "Sea of Treats (Lv. 2125 - 2450) -> Cake Prince / Dough King",
      "Tiki Outpost (Lv. 2450+) -> Leviathan / Sanguine Art"
    ],
    bestFruits: "Dough (Awakened), Portal, Kitsune, Dragon, Buddha"
  }
};

const comboGuides = {
  dough: "Dough (Awakened) PvP Combo: C (Restless Dough Fist) -> X (Popping Dough) -> Z (Missile Fist) -> Godhuman Z -> C -> Subhuman/Soul Guitar X.",
  portal: "Portal Mobility & One-Shot Combo: Portal X (World Warp) -> Soul Guitar Z -> Portal Z -> Cursed Dual Katana (CDK) Z -> CDK X -> Godhuman Z -> C -> X.",
  kitsune: "Kitsune Aggro Combo: Transformation C -> Z -> X -> Godhuman Z -> C -> Soul Guitar Z -> Kitsune F (Chase).",
  ice: "Ice Stun Lock Combo: Ice V (Absolute Zero) -> Ice C -> Godhuman Z -> Godhuman C -> CDK Z -> CDK X -> Ice Z.",
  buddha: "Buddha PvE Spam: Transform into Buddha -> Hold Melee/Sword (CDK or Shark Anchor) -> Auto-Click / M1 Spam."
};

/**
 * Main command entry point
 * @param {string} input - User typed string
 * @returns {string|null} - Command output text or null if not a command
 */
export function handleCommand(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("!")) return null;

  const args = trimmed.slice(1).split(" ");
  const command = args[0].toLowerCase();

  switch (command) {
    case "threat":
      return getThreatLevel(args.slice(1));

    case "sea":
      return getSeaInfo(args[1]);

    case "combo":
      return getComboInfo(args[1]);

    case "help":
    case "commands":
      return "Available Tactical Commands:\n• !threat [player count] [bounty/lvl]\n• !sea [1|2|3|first|second|third]\n• !combo [dough|portal|kitsune|ice|buddha]\n• !help";

    default:
      return `Unknown command '!${command}'. Type !help to view all tactical commands.`;
  }
}

// Threat Calculator Logic
function getThreatLevel(args) {
  const players = parseInt(args[0]) || Math.floor(Math.random() * 8) + 4;
  const bounty = parseInt(args[1]) || Math.floor(Math.random() * 10) + 1; // In Millions

  let threat = "LOW";
  let status = "Clear sailing, Captain. Minimal aggressive activity detected.";

  if (players >= 8 || bounty >= 15) {
    threat = "HIGH";
    status = "WARNING: Heavy bounty hunters or active max-level PvP players in this sector. Proceed with caution!";
  } else if (players >= 5 || bounty >= 5) {
    threat = "MEDIUM";
    status = "MODERATE RISK: Standard server activity. Keep your eyes open when farming bosses.";
  }

  return `[SERVER THREAT ASSESSMENT]\n• Estimated Players Nearby: ${players}\n• Max Bounty Profile: ~${bounty}M\n• Threat Rating: ${threat}\n• Operational Note: ${status}`;
}

// Sea Guide Lookup
function getSeaInfo(targetSea) {
  if (!targetSea) {
    return "Please specify a Sea level (e.g., !sea 1, !sea 2, or !sea 3).";
  }

  const query = targetSea.toLowerCase();
  let data = null;

  if (query === "1" || query === "first") data = seaGuides.first;
  else if (query === "2" || query === "second") data = seaGuides.second;
  else if (query === "3" || query === "third") data = seaGuides.third;

  if (!data) {
    return `Invalid Sea choice '${targetSea}'. Use: !sea 1, !sea 2, or !sea 3.`;
  }

  return `[${data.name.toUpperCase()}]\n• Level Range: ${data.levels}\n• Recommended Fruits: ${data.bestFruits}\n• Key Locations:\n  - ${data.keyIslands.join("\n  - ")}`;
}

// Combo Lookup
function getComboInfo(fruitKey) {
  if (!fruitKey) {
    return "Specify a fruit or weapon for combo execution. Available: !combo dough, !combo portal, !combo kitsune, !combo ice, !combo buddha.";
  }

  const key = fruitKey.toLowerCase();
  if (comboGuides[key]) {
    return `[PVP/PVE COMBO MATRIX - ${key.toUpperCase()}]\n${comboGuides[key]}`;
  }

  return `No premade combo found for '${fruitKey}'. Try: dough, portal, kitsune, ice, or buddha.`;
}