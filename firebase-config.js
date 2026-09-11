// ============================================================
// BandBuddy — Firebase configuration
// ============================================================
// 1. Go to https://console.firebase.google.com
// 2. Create a project (free "Spark" plan is fine)
// 3. Add a Web App inside that project
// 4. Firebase will show you a config object — paste its values below
// 5. Enable these in the Firebase console:
//      - Authentication -> Sign-in method -> Email/Password
//      - Firestore Database -> Create database (start in production mode)
//      - Storage -> Get started
// 6. Deploy firestore.rules and storage.rules (see README.md)
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyA_SNrj5O0k_XXEqvHqDHtkksJGgcO3HJU",
  authDomain: "bandbuddy-288b6.firebaseapp.com",
  projectId: "bandbuddy-288b6",
  storageBucket: "bandbuddy-288b6.firebasestorage.app",
  messagingSenderId: "85587385254",
  appId: "1:85587385254:web:4b90994b872987b488cd67"
};

// These two accounts get elevated roles the FIRST time they sign up.
// (See js/auth.js — role is only ever auto-granted on account creation,
// never on later logins, and can only be changed after that by an
// existing dev/teacher through the app.)
export const DEV_EMAIL = "spgcookie@gmail.com";
export const TEACHER_EMAIL = "gbrown@chaminade-stl.org";

// Global tunables the Dev can also edit live from the Dev Panel
// (this file is just the shipped default the very first time the app runs).
export const DEFAULT_CONFIG = {
  rpToXpRatio: 1,              // +20 RP -> +20 XP by default
  recordingRetentionDays: 5,   // normal recordings auto-expire after this
  archiveBmcsRecordings: true, // BMCS recordings skip the 5-day deletion
  streakRequirement: "ranked_attempt", // what counts toward a StreakWars day
  overallDivision1Size: 10     // Top N Overall = Division 1
};

export const RP_TABLE = [
  { min: 95, max: 100, rp: 25 },
  { min: 90, max: 94, rp: 20 },
  { min: 85, max: 89, rp: 15 },
  { min: 80, max: 84, rp: 10 },
  { min: 75, max: 79, rp: 7 },
  { min: 70, max: 74, rp: 5 },
  { min: 60, max: 69, rp: 2 },
  { min: 50, max: 59, rp: 0 },
  { min: 0, max: 49, rp: -5 }
];

export const BMCS_TABLE = [
  { min: 90, max: 100, pts: 50 },
  { min: 75, max: 89, pts: 30 },
  { min: 50, max: 74, pts: 10 },
  { min: 0, max: 49, pts: -10 }
];

export function gradeToRP(grade) {
  const row = RP_TABLE.find(r => grade >= r.min && grade <= r.max);
  return row ? row.rp : 0;
}

export function gradeToBMCS(grade) {
  const row = BMCS_TABLE.find(r => grade >= r.min && grade <= r.max);
  return row ? row.pts : 0;
}

export const INSTRUMENTS = [
  "Flute", "Clarinet", "Trumpet", "Tenor Sax", "Alto Sax", "Percussion",
  "French Horn", "Euphonium", "Trombone", "Tuba", "String Bass"
];

export const BLOCKS = ["Block 6", "Block 4"];

// ---------------------------------------------------------------
// Season Pass level curve. Levels get cheaper to compute (a smooth
// curve) rather than one flat cost per level, so early levels feel
// fast and later levels feel earned.
//
// Tuning: assuming a reasonably active student earns somewhere around
// 400–600 XP across a typical month-long season (Ranked grades + some
// Guess The Note practice), this curve is calibrated so that lands
// them around Level 100–150 by season's end. If real usage data ends
// up producing a different average, adjust SEASON_CURVE_K below —
// smaller K = faster leveling, larger K = slower.
// ---------------------------------------------------------------
const SEASON_CURVE_K = 5.6;
const SEASON_MAX_LEVEL = 150;

function rewardForLevel(level, maxLevel) {
  if (level === 1) return "Starter PFP Frame";
  if (level === maxLevel) return "Season-Exclusive Cosmetic";
  if (level % 25 === 0) return "Major Cosmetic";
  if (level % 10 === 0) return "Rare Banner";
  if (level % 5 === 0) return "Profile Decoration";
  return "PFP Frame Variant";
}

export function generateSeasonPassCurve(maxLevel = SEASON_MAX_LEVEL, k = SEASON_CURVE_K) {
  const levels = [];
  for (let level = 1; level <= maxLevel; level++) {
    const xpRequired = level === 1 ? 0 : Math.round(Math.pow(level / k, 2));
    levels.push({ level, xpRequired, reward: rewardForLevel(level, maxLevel) });
  }
  return levels;
}
