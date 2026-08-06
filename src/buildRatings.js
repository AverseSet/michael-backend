export const ratings = {
    fruits: {
        kitsune: 10, dragon: 10, leopard: 9.5, dough: 10, spirit: 8,
        venom: 8, portal: 8, rumble: 8, buddha: 8, magma: 9, ice: 9.5,
        light: 6, flame: 5, sand: 4, falcon: 1, spin: 1
    },
    styles: {
        godhuman: 10, sanguine: 10, dragontalon: 9, electricclaw: 9,
        sharkman: 8.5, superhuman: 8.5, deathstep: 7, darkstep: 4, combat: 1
    },
    swords: {
        cdk: 10, ttk: 10, sharkanchor: 10, gravitycane: 10,
        rengoku: 6, saber: 6.5, katana: 1
    },
    guns: {
        soulguitar: 10, acidum: 7.5, kabucha: 8.5, serpentbow: 7, musket: 1
    },
    races: {
        ghoul: 10, cyborg: 10, angel: 9.5, shark: 10, human: 8.5, rabbit: 7
    },
    accessories: {
        leviathanshield: 10, palescarf: 8.5, valkyriehelmet: 7,
        hunterscape: 7.5, swanglasses: 7.5
    }
};

export const buildTips = {
    kitsune: {
        strengths: ["Excellent mobility", "Huge combo potential", "Very high damage"],
        weaknesses: ["Predictable spam", "Can be punished by skilled players"]
    },
    dragon: {
        strengths: ["Massive damage", "Excellent pressure", "Strong transformations"],
        weaknesses: ["Large hitbox", "High mastery required"]
    },
    leopard: {
        strengths: ["Fast attacks", "Great mobility", "Strong close combat"],
        weaknesses: ["Short range", "Predictable against experienced players"]
    },
    dough: {
        strengths: ["Amazing stun combos", "Excellent PvP", "High combo damage"],
        weaknesses: ["Needs combo skill", "Easy to escape if combo misses"]
    },
    portal: {
        strengths: ["Best mobility", "Excellent escapes", "Great support"],
        weaknesses: ["Lower damage", "Requires smart play"]
    },
    buddha: {
        strengths: ["Huge survivability", "Excellent grinding", "Very tanky"],
        weaknesses: ["Poor mobility", "Weak against air fighters"]
    }
};

export function getThreat(score) {
    if (score >= 55) return { name: "☠️ Extremely Dangerous", color: "red" };
    if (score >= 50) return { name: "🔥 Very Dangerous", color: "orange" };
    if (score >= 45) return { name: "⚔️ Dangerous", color: "yellow" };
    if (score >= 35) return { name: "⚡ Average Fighter", color: "green" };
    return { name: "🙂 Low Threat", color: "gray" };
}

export function calculateBuildScore(info) {
    const fruitScore = ratings.fruits[info.fruit?.toLowerCase()] || 0;
    const styleScore = ratings.styles[info.fightingStyle?.toLowerCase()] || 0;
    const swordScore = ratings.swords[info.sword?.toLowerCase()] || 0;
    const gunScore = ratings.guns[info.gun?.toLowerCase()] || 0;
    const accessoryScore = ratings.accessories[info.accessory?.toLowerCase()] || 0;
    const raceScore = ratings.races[info.race?.toLowerCase()] || 0;

    const total = fruitScore + styleScore + swordScore + gunScore + accessoryScore + raceScore;
    
    let grade = "D";
    if (total >= 55) grade = "S+";
    else if (total >= 50) grade = "S";
    else if (total >= 45) grade = "A";
    else if (total >= 35) grade = "B";
    else if (total >= 25) grade = "C";

    return { total, grade, fruitScore, styleScore, swordScore, gunScore, accessoryScore, raceScore };
}

export function calculateWinChance(myScore, enemyScore) {
    const diff = myScore - enemyScore;
    if (diff >= 15) return "95%";
    if (diff >= 10) return "85%";
    if (diff >= 5) return "70%";
    if (diff >= -5) return "50%";
    if (diff >= -10) return "30%";
    return "15%";
}