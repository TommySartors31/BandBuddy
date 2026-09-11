import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";
import { gradeToRP, gradeToBMCS, DEFAULT_CONFIG, generateSeasonPassCurve } from "./firebase-config.js";

const todayStr = () => new Date().toISOString().slice(0, 10);

// ---------- config ----------
export async function getConfig() {
  const snap = await getDoc(doc(db, "config", "global"));
  return snap.exists() ? snap.data() : DEFAULT_CONFIG;
}

// ---------- seasons ----------
export async function getActiveSeason() {
  const q = query(collection(db, "seasons"), where("active", "==", true), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function createSeason(data, actorUid) {
  const ref = await addDoc(collection(db, "seasons"), {
    ...data, active: false, createdAt: serverTimestamp()
  });
  await logAudit(actorUid, "season_created", ref.id, null, data);
  return ref.id;
}

// Ends the current season: archives every student's result, resets RP,
// crowns the #1 Overall as Season Champion (auto Major Qualifier entry).
export async function endSeasonAndReset(seasonId, actorUid) {
  const season = await getDoc(doc(db, "seasons", seasonId));
  if (!season.exists()) throw new Error("Season not found");

  const usersSnap = await getDocs(collection(db, "users"));
  const students = usersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.role === "student")
    .sort((a, b) => (b.currentRP || 0) - (a.currentRP || 0));

  const champion = students[0];

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    await setDoc(doc(db, "seasonHistory", `${s.id}_${seasonId}`), {
      uid: s.id,
      seasonId,
      seasonName: season.data().name,
      finalRank: i + 1,
      finalRP: s.currentRP || 0,
      division: i < DEFAULT_CONFIG.overallDivision1Size ? 1 : 2,
      isChampion: i === 0
    });
    await updateDoc(doc(db, "users", s.id), { currentRP: 0 });
  }

  if (champion) {
    await addDoc(collection(db, "qualifications"), {
      uid: champion.id,
      type: "major_qualifier",
      reason: `Season Champion — ${season.data().name}`,
      seasonId,
      grantedAt: serverTimestamp()
    });
  }

  await updateDoc(doc(db, "seasons", seasonId), { active: false, endedAt: serverTimestamp() });
  await logAudit(actorUid, "season_ended", seasonId, null, { championUid: champion?.id });
}

// ---------- ranked / performances ----------
// Enforces "one official Ranked attempt per day" server-side-equivalent:
// we check for an existing today's-dated ranked performance before allowing
// a new one. Firestore security rules additionally block a second create.
export async function hasUsedRankedToday(uid) {
  const q = query(
    collection(db, "performances"),
    where("uid", "==", uid),
    where("type", "==", "ranked"),
    where("dateStr", "==", todayStr())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function submitPerformance({ uid, type, instrument, musicId, recordingURL, seasonId, tournamentId, attemptNumber }) {
  if (type === "ranked") {
    const used = await hasUsedRankedToday(uid);
    if (used) throw new Error("Your Ranked attempt has already been used today.");
  }
  const ref = await addDoc(collection(db, "performances"), {
    uid, type, instrument: instrument || null, musicId: musicId || null,
    recordingURL: recordingURL || null,
    seasonId: seasonId || null,
    tournamentId: tournamentId || null,
    attemptNumber: attemptNumber || 1,
    dateStr: todayStr(),
    status: "pending",
    grade: null,
    rpAwarded: null,
    xpAwarded: null,
    feedback: null,
    submittedAt: serverTimestamp()
    // Recordings are kept permanently — no expiration field, nothing deletes them.
  });
  return ref.id;
}

export async function getPendingGrades() {
  const q = query(collection(db, "performances"), where("status", "==", "pending"), orderBy("submittedAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// The only place a grade ever turns into RP/XP. Only reachable from the
// Teacher/Dev panel in the UI, and Firestore rules double-check the actor's
// role server-side before allowing this write to succeed.
export async function gradePerformance(perfId, grade, feedback, actorUid) {
  const perfRef = doc(db, "performances", perfId);
  const perfSnap = await getDoc(perfRef);
  if (!perfSnap.exists()) throw new Error("Performance not found");
  const perf = perfSnap.data();
  const config = await getConfig();

  let rpAwarded = 0, xpAwarded = 0, bmcsPts = 0;
  if (perf.type === "ranked") {
    rpAwarded = gradeToRP(grade);
    xpAwarded = Math.round(rpAwarded * (config.rpToXpRatio ?? 1));
  } else if (perf.type === "bmcs") {
    bmcsPts = gradeToBMCS(grade);
  } else if (perf.type === "practice" || perf.type === "tournament") {
    xpAwarded = Math.max(0, Math.round(grade / 5));
  }

  await updateDoc(perfRef, {
    grade, feedback: feedback || null, status: "graded",
    rpAwarded, xpAwarded, bmcsPts, gradedBy: actorUid, gradedAt: serverTimestamp()
  });

  if (rpAwarded || xpAwarded) {
    await updateDoc(doc(db, "users", perf.uid), {
      currentRP: increment(rpAwarded),
      currentSeasonXP: increment(xpAwarded)
    });
  }
  if (perf.type === "ranked") {
    await bumpStreak(perf.uid);
  }
  await logAudit(actorUid, "grade_submitted", perfId, null, { grade, rpAwarded, xpAwarded });
}

// ---------- streaks ----------
async function bumpStreak(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const u = snap.data();
  const today = todayStr();
  if (u.lastStreakDate === today) return; // already counted today
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = u.lastStreakDate === yesterday ? (u.streak || 0) + 1 : 1;
  await updateDoc(userRef, { streak: newStreak, lastStreakDate: today });
}

// ---------- leaderboards ----------
export async function getLeaderboard(block) {
  const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
  let students = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (block) students = students.filter(s => s.block === block);
  students.sort((a, b) => (b.currentRP || 0) - (a.currentRP || 0));
  return students.map((s, i) => ({ ...s, rank: i + 1, division: i < DEFAULT_CONFIG.overallDivision1Size ? 1 : 2 }));
}

export async function getStreakLeaderboard() {
  const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
  const students = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  students.sort((a, b) => (b.streak || 0) - (a.streak || 0));
  return students.map((s, i) => ({ ...s, rank: i + 1 }));
}

// ---------- guess the note ----------
export async function recordGuessResult(uid, clef, correct) {
  const ref = doc(db, "guessTheNoteResults", uid);
  const field = clef === "treble" ? "treble" : "bass";
  let result;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const treble = data.treble && typeof data.treble === "object"
      ? data.treble : { total: 0, correct: 0 };
    const bass = data.bass && typeof data.bass === "object"
      ? data.bass : { total: 0, correct: 0 };
    const updated = {
      treble: { total: Number(treble.total) || 0, correct: Number(treble.correct) || 0 },
      bass: { total: Number(bass.total) || 0, correct: Number(bass.correct) || 0 }
    };
    updated[field].total += 1;
    if (correct) updated[field].correct += 1;
    result = updated;
    tx.set(ref, updated);
  });
  return result;
}

export async function getGuessResults(uid) {
  const snap = await getDoc(doc(db, "guessTheNoteResults", uid));
  return snap.exists() ? snap.data() : { treble: { total: 0, correct: 0 }, bass: { total: 0, correct: 0 } };
}

export async function resetGuessResults(uid, clefOnly) {
  const ref = doc(db, "guessTheNoteResults", uid);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : { treble: { total: 0, correct: 0 }, bass: { total: 0, correct: 0 } };
  if (clefOnly) {
    current[clefOnly] = { total: 0, correct: 0 };
  } else {
    current.treble = { total: 0, correct: 0 };
    current.bass = { total: 0, correct: 0 };
  }
  await setDoc(ref, current);
  return current;
}

// ---------- tournaments ----------
export async function createTournament(data, actorUid) {
  const ref = await addDoc(collection(db, "tournaments"), { ...data, createdAt: serverTimestamp() });
  await logAudit(actorUid, "tournament_created", ref.id, null, data);
  return ref.id;
}

export async function listTournaments() {
  const snap = await getDocs(collection(db, "tournaments"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function isEligible(tournament, student) {
  const e = tournament.eligibility || {};
  if (e.divisions?.length && !e.divisions.includes(student.division)) return false;
  if (e.instruments?.length && !e.instruments.some(i => (student.instruments || []).includes(i))) return false;
  if (e.studentIds?.length && !e.studentIds.includes(student.id)) return false;
  return true;
}

export async function getTournamentAttempts(tournamentId, uid) {
  const q = query(collection(db, "performances"),
    where("tournamentId", "==", tournamentId), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Sums each student's graded attempt scores for a tournament (Section 29:
// "the final tournament score is the SUM of all three attempts").
export async function getTournamentLeaderboard(tournamentId) {
  const q = query(collection(db, "performances"),
    where("tournamentId", "==", tournamentId), where("status", "==", "graded"));
  const snap = await getDocs(q);
  const totals = {};
  const attemptCounts = {};
  snap.docs.forEach(d => {
    const p = d.data();
    totals[p.uid] = (totals[p.uid] || 0) + (p.grade || 0);
    attemptCounts[p.uid] = (attemptCounts[p.uid] || 0) + 1;
  });
  const usersSnap = await getDocs(collection(db, "users"));
  const nameFor = {};
  usersSnap.docs.forEach(d => nameFor[d.id] = d.data().displayName);
  return Object.entries(totals)
    .map(([uid, total]) => ({ uid, total, attempts: attemptCounts[uid], name: nameFor[uid] || "Unknown" }))
    .sort((a, b) => b.total - a.total)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ---------- music library ----------
export async function listMusic() {
  const snap = await getDocs(collection(db, "music"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addMusic(data, actorUid) {
  const ref = await addDoc(collection(db, "music"), { ...data, active: true, createdAt: serverTimestamp() });
  await logAudit(actorUid, "music_added", ref.id, null, data);
  return ref.id;
}

// ---------- assignments ----------
// "maybe add assigning with due dates" — a lightweight layer on top of the
// music library: a teacher/dev points at a piece, sets who it's for and a
// due date, and it shows up on the assigned students' Ranked page.
export async function createAssignment(data, actorUid) {
  const ref = await addDoc(collection(db, "assignments"), { ...data, createdAt: serverTimestamp() });
  await logAudit(actorUid, "assignment_created", ref.id, null, data);
  return ref.id;
}

export async function listAssignments() {
  const snap = await getDocs(collection(db, "assignments"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Filters the full assignment list down to what applies to this student
// (everyone / their block / one of their instruments / them by name).
export function assignmentsForStudent(assignments, student) {
  return assignments.filter(a => {
    if (a.targetType === "all") return true;
    if (a.targetType === "block") return a.targetValue === student.block;
    if (a.targetType === "instrument") return (student.instruments || []).includes(a.targetValue);
    if (a.targetType === "student") return a.targetValue === student.id;
    return false;
  });
}

// ---------- users ----------
export async function updateOwnProfile(uid, fields) {
  // allow-list — never lets currentRP/currentSeasonXP/role pass through from here
  const allowed = ["displayName", "block", "instruments", "profilePicUrl", "equippedBanner", "equippedDecoration"];
  const clean = {};
  for (const k of allowed) if (k in fields) clean[k] = fields[k];
  await updateDoc(doc(db, "users", uid), clean);
}

export async function listStudents() {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Every account regardless of role — used by the Dev Panel's Users tab so
// a Dev can promote/demote teachers and other devs, not just students.
export async function listAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function setUserRole(uid, role, actorUid) {
  await updateDoc(doc(db, "users", uid), { role });
  await logAudit(actorUid, "role_changed", uid, null, { role });
}

export async function adjustRP(uid, delta, reason, actorUid) {
  const before = (await getDoc(doc(db, "users", uid))).data().currentRP || 0;
  await updateDoc(doc(db, "users", uid), { currentRP: increment(delta) });
  await logAudit(actorUid, "rp_manual_adjust", uid, before, before + delta, reason);
}

// ---------- season pass ----------
export async function getSeasonPassLevels() {
  const snap = await getDoc(doc(db, "config", "seasonPass"));
  return snap.exists() ? snap.data().levels : generateSeasonPassCurve();
}

// Given the level list and a student's XP, returns the level object they're
// currently on. Shared by seasonpass.js and profile.js so both agree on
// exactly which level (and therefore which cosmetics) a student has reached.
export function currentSeasonPassLevel(levels, xp) {
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  const unlocked = sorted.filter(l => xp >= l.xpRequired);
  return unlocked[unlocked.length - 1] || sorted[0];
}

// ---------- cosmetics & banners ----------
// A Dev creates these and ties each one to a Season Pass level. Ownership
// isn't stored separately — a student "owns" every cosmetic/banner whose
// level is <= their current Season Pass level, computed live off XP. Once
// XP only ever goes up (it does — see endSeasonAndReset, which resets RP
// but not currentSeasonXP), so this is permanent in practice, matching the
// "everything you unlock is yours permanently" promise on the Season Pass
// page, with no extra writes needed.
export async function listCosmetics() {
  const snap = await getDocs(collection(db, "cosmetics"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCosmetic(data, actorUid) {
  const ref = await addDoc(collection(db, "cosmetics"), { ...data, createdAt: serverTimestamp() });
  await logAudit(actorUid, "cosmetic_added", ref.id, null, data);
  return ref.id;
}

export async function listBanners() {
  const snap = await getDocs(collection(db, "banners"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addBanner(data, actorUid) {
  const ref = await addDoc(collection(db, "banners"), { ...data, createdAt: serverTimestamp() });
  await logAudit(actorUid, "banner_added", ref.id, null, data);
  return ref.id;
}

// Overwrites the Season Pass with the auto-scaled curve (see
// generateSeasonPassCurve in firebase-config.js) — lets a Dev reset back to
// the default 150-level curve in one click instead of hand-adding levels.
export async function regenerateSeasonPassCurve(actorUid) {
  const levels = generateSeasonPassCurve();
  await setDoc(doc(db, "config", "seasonPass"), { levels });
  await logAudit(actorUid, "seasonpass_curve_regenerated", "config/seasonPass", null, { count: levels.length });
  return levels;
}

// ---------- audit log ----------
export async function logAudit(who, action, target, oldValue, newValue, note) {
  await addDoc(collection(db, "auditLog"), {
    who, action, target, oldValue: oldValue ?? null, newValue: newValue ?? null,
    note: note || null, timestamp: serverTimestamp()
  });
}

export async function getAuditLog() {
  const q = query(collection(db, "auditLog"), orderBy("timestamp", "desc"), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
