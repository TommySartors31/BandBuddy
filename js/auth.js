import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig, DEV_EMAIL, TEACHER_EMAIL } from "./firebase-config.js";

// Note: no Firebase Storage here — recordings upload to Cloudinary instead
// (see js/storage.js and js/cloudinary-config.js) since Firebase Storage
// now requires the paid Blaze plan even for zero-cost usage.
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Role is decided ONLY at account-creation time, server-truth lives in
// Firestore (users/{uid}.role) and every security rule keys off that
// document — never off the client thinking it knows who's logged in.
function roleForEmail(email) {
  const e = (email || "").toLowerCase();
  if (e === DEV_EMAIL.toLowerCase()) return "dev";
  if (e === TEACHER_EMAIL.toLowerCase()) return "teacher";
  return "student";
}

export async function signUp(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const role = roleForEmail(email);
  await setDoc(doc(db, "users", cred.user.uid), {
    email,
    displayName: displayName || email.split("@")[0],
    role,
    block: null,
    instruments: [],
    profilePicUrl: null,
    equippedBanner: null,
    equippedDecoration: null,
    currentRP: 0,
    currentSeasonXP: 0,
    seasonPassLevel: 1,
    streak: 0,
    lastStreakDate: null,
    createdAt: serverTimestamp()
  });
  return cred.user;
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function logOut() {
  return signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null, null);
    const snap = await getDoc(doc(db, "users", user.uid));
    callback(user, snap.exists() ? snap.data() : null);
  });
}
