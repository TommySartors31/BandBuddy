# BandBuddy

A competitive music-learning platform for Chaminade's band program: Ranked daily performances, monthly seasons, a free 150-level Season Pass, StreakWars, Guess The Note, tournaments with leaderboards, assignments, and teacher/dev admin panels.

No build step — plain HTML/CSS/JS. Uses Firebase for Auth + the database, and Cloudinary for file storage (audio recordings and sheet music PDFs). Deploys via GitHub Pages (or Firebase Hosting).

## What's new in v3

- **Assignments tab added to the Teacher Panel** (previously Dev-only) — teachers can now assign a piece to everyone/a block/an instrument directly, same as Devs
- **File upload for recordings** — Ranked, Practice, and Tournament attempts can now be submitted either by recording in-browser or by uploading an existing audio file (e.g. a higher-quality Voice Memos take from an iPhone); both paths go through the same Cloudinary upload
- **Cosmetics now actually work** — new Dev Panel → Cosmetics tab lets a Dev create profile decorations (an emoji) and banners (a color or CSS gradient), each tied to a Season Pass level. Students automatically "own" everything up to their current level (no separate grant step) and equip it from Profile → Cosmetics. Equipped decorations/banners show on the Profile page and on leaderboard rows. **You'll want to add a few from Dev → Cosmetics before students see anything there** — the schema existed before but had no creation or equip UI.
- **New opening animation** — replaced with a cleaner, recompressed version of the Horizon Studios logo intro (same file path, same play/skip/fallback behavior)
- **Minor UI polish** — dark-themed native file pickers and checkboxes, a left accent bar on the active sidebar link, subtle card hover states

## What's new in this rewrite

- **Red and black UI** matching Chaminade's colors, replacing the earlier gold theme
- **Chaminade seal logo** in the sidebar and login screen (`assets/chaminade-logo.png`)
- **"Chaminade Bands × Horizon Studios"** branding in the sidebar and on login
- **Opening animation** (`assets/opening-animation.mp4`) plays full-screen every time the site loads, with a Skip button and safe fallbacks if autoplay is blocked or the video fails
- **PDF/image upload for sheet music** — the Dev Panel's music form now has a real file picker that uploads to Cloudinary and stores the resulting link; students see a "View sheet music" link on the Ranked page, teachers see one in the Teacher Panel's music list
- **Tournament-specific leaderboards** — each tournament card has a "View leaderboard" toggle showing every student's summed graded score, ranked
- **Guess The Note bug fix** — the note-to-staff-position mapping was wrong (e.g. it thought the bottom line of treble clef was "A" instead of "E"); this is corrected for both clefs, plus a **Reset stats** button was added
- **Assignments with due dates** — Dev Panel has an Assignments tab to assign a music piece (to everyone, a block, or an instrument) with a due date; assigned students see it at the top of their Ranked page
- **Season Pass redesigned as a 150-level curve** — see below
- **No daily XP cap** — there never was one in this codebase; Guess The Note and graded performances both award XP with no ceiling. Ranked RP is still limited to one official attempt per day by design (that's a competitive-integrity rule, not an XP cap)

## Season Pass curve, explained

Instead of a short hand-written list of levels, `js/firebase-config.js` now has `generateSeasonPassCurve()`, which produces 150 levels with XP costs following `xpRequired = (level / 5.6)²`. That constant (`SEASON_CURVE_K`) is tuned assuming a typically-active student earns somewhere around 400–600 XP across a month-long season (from Ranked grades plus some Guess The Note practice) — which lands them around **Level 100–150** by season's end, per your request.

This is a calibrated *estimate*, not a guarantee — actual XP totals depend entirely on how much students play. Once you have a real month of data, check the Dev Panel's Season Pass tab to see where students actually landed:
- If the average is well above 150, **increase** `SEASON_CURVE_K` in `js/firebase-config.js` (bigger number = slower leveling).
- If it's well below 100, **decrease** it.
- Then have a Dev click **"Regenerate default curve"** in the Season Pass tab to apply the new curve going forward (this doesn't affect already-earned XP, just how many levels it now buys).

Rewards cycle automatically: Level 1 is a starter frame, every 5th level a Profile Decoration, every 10th a Rare Banner, every 25th a Major Cosmetic, and the final level (150) is a Season-Exclusive Cosmetic. A Dev can still hand-add one-off custom levels/rewards from the same tab.

## What's implemented right now

- Email/password auth, with role (`student` / `teacher` / `dev`) decided at sign-up by matching the special emails in `js/firebase-config.js` (roles can also be changed later by an existing Dev, either from the Dev Panel's Users tab or directly in the Firestore console)
- Student profile (instruments, block, editable fields) with a locked-down allow-list so students can't touch their own RP/XP/role
- Ranked: one official attempt per day, in-browser audio recording, upload to Cloudinary, recordings kept permanently
- Automatic RP calculation from your exact grade table once a teacher/dev grades a performance
- XP tracked separately from RP, feeding the 150-level Season Pass
- StreakWars streak tracking tied to daily Ranked participation, its own leaderboard
- Guess The Note (treble + bass, correct now, with ledger lines, live accuracy stats, and a reset button), XP-only — never touches RP
- Overall / Block 6 / Block 4 leaderboards with automatic Division 1 (Top 10 Overall) / Division 2 assignment
- Tournaments: teacher/dev creation form with division + instrument eligibility, solo/duos format, 3-attempt sum scoring, student recording/submission flow, and a per-tournament leaderboard
- Assignments: music piece + due date, targeted at everyone / a block / an instrument, shown to matching students on their Ranked page
- Teacher grading queue (listen, enter grade, feedback, submit → RP/XP auto-applied)
- Dev panel: seasons, all-user role management, manual RP adjustment, music library with PDF upload, Season Pass curve + custom levels, assignments, audit log
- Season-end archival, RP reset, Season Champion auto-qualification
- Audit logging on grade/RP/role changes and season/tournament/music/assignment creation
- Firestore security rules enforcing all of the above server-side

## What still needs backend configuration

- **Hardened role assignment.** The two special emails get their role client-side at sign-up, checked against `firestore.rules` so nobody can grant themselves a role later — but the very first sign-up moment trusts the client. For extra hardening, add a Cloud Function that sets an auth custom claim for those two exact emails on account creation.
- **BMCS.** Intentionally left out per your request — post BMCS events through the Tournaments form; grading a performance as `type: 'bmcs'` already applies your 50/30/10/-10 point table instead of RP.
- **Minor/Major Qualifier tracking UI.** The `qualifications` collection and auto Season-Champion qualification already exist; there's no dedicated screen listing who's qualified yet.
- **Duos tournament team-pairing.** The `format: 'duos'` field exists; team creation/joining UI isn't wired up.

## Setup — Firebase (Auth + database, free Spark plan)

1. https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** → production mode → a nearby region.
4. Project settings → **Your apps → Add app → Web** → copy the `firebaseConfig` object into `js/firebase-config.js`.
5. Confirm `DEV_EMAIL` / `TEACHER_EMAIL` match the two real accounts.
6. **Do not set up Firebase Storage** — not used, and it now requires the paid Blaze plan.

## Setup — Cloudinary (file storage, free, no card)

1. https://cloudinary.com/users/register/free → create a free account.
2. Copy your **Cloud name** from the Dashboard.
3. **Settings → Upload → Upload presets** → use the default `ml_default` preset (must be **Unsigned**) or create your own, restricted to reasonable file types/sizes.
4. Paste your Cloud name and preset name into `js/cloudinary-config.js`.

## Deploy

Simplest path with no terminal: push to GitHub, then turn on **GitHub Pages** in the repo's Settings → Pages (deploy from `main` / root). Then paste the contents of `firestore.rules` into the Firebase console's Firestore → Rules tab and click Publish — that's what actually makes the security rules take effect.

If you do have terminal access: `npm install -g firebase-tools`, `firebase login`, `firebase init` (select Firestore + Hosting, not Storage), `firebase deploy`.

## First login

Sign up once with each of the two special emails to grant `teacher`/`dev` role. Everyone else who signs up becomes a regular student.

## Data model

See `js/data.js` for the full read/write surface. Firestore collections: `users`, `seasons`, `seasonHistory`, `performances`, `music`, `tournaments`, `assignments`, `qualifications`, `cosmetics`, `banners`, `guessTheNoteResults`, `config`, `announcements`, `auditLog`.

## Known limitations

- No offline support / PWA install prompt.
- No automated tests.
