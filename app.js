import { watchAuth, logOut } from "./auth.js";
import * as LoginView from "./views/login.js";
import * as DashboardView from "./views/dashboard.js";
import * as RankedView from "./views/ranked.js";
import * as LeaderboardsView from "./views/leaderboards.js";
import * as ProfileView from "./views/profile.js";
import * as StreakWarsView from "./views/streakwars.js";
import * as SeasonPassView from "./views/seasonpass.js";
import * as GuessTheNoteView from "./views/guessthenote.js";
import * as TournamentsView from "./views/tournaments.js";
import * as TeacherView from "./views/teacher.js";
import * as DevView from "./views/dev.js";

const appEl = document.getElementById("app");
let currentUser = null;
let currentProfile = null;

const ROUTES = [
  { path: "dashboard", label: "Home", view: DashboardView, roles: ["student", "teacher", "dev"] },
  { path: "ranked", label: "Ranked", view: RankedView, roles: ["student"] },
  { path: "leaderboards", label: "Leaderboards", view: LeaderboardsView, roles: ["student", "teacher", "dev"] },
  { path: "streakwars", label: "StreakWars", view: StreakWarsView, roles: ["student"] },
  { path: "guessthenote", label: "Guess The Note", view: GuessTheNoteView, roles: ["student"] },
  { path: "seasonpass", label: "Season Pass", view: SeasonPassView, roles: ["student"] },
  { path: "tournaments", label: "Tournaments", view: TournamentsView, roles: ["student", "teacher", "dev"] },
  { path: "profile", label: "Profile", view: ProfileView, roles: ["student", "teacher", "dev"] },
  { path: "teacher", label: "Teacher Panel", view: TeacherView, roles: ["teacher", "dev"] },
  { path: "dev", label: "Dev Panel", view: DevView, roles: ["dev"] },
];

function parseHash() {
  const raw = (location.hash || "#/dashboard").slice(2);
  const [path, tab] = raw.split("/");
  return { path: path || "dashboard", params: { tab } };
}

function renderShell() {
  const { path } = parseHash();
  const role = currentProfile.role;
  const visible = ROUTES.filter(r => r.roles.includes(role));

  appEl.innerHTML = `
    <div class="shell">
      <nav class="sidebar">
        <div class="brand">
          <img src="assets/chaminade-logo.png" alt="Chaminade College Prep" class="brand-logo" />
          <div class="brand-name">BandBuddy</div>
          <div class="brand-tagline">Chaminade Bands × Horizon Studios</div>
        </div>
        ${visible.map(r => `<a class="nav-link ${r.path === path ? "active" : ""}" href="#/${r.path}">${r.label}</a>`).join("")}
        <div class="nav-section-label">Signed in as</div>
        <div class="nav-link" style="color:var(--text)">${currentProfile.displayName}</div>
        <a class="nav-link" href="#" id="logoutLink">Log out</a>
      </nav>
      <main class="main" id="main"></main>
    </div>
  `;
  document.getElementById("logoutLink").addEventListener("click", (e) => { e.preventDefault(); logOut(); });
  routeToView();
}

async function routeToView() {
  const { path, params } = parseHash();
  const route = ROUTES.find(r => r.path === path) || ROUTES[0];
  if (!route.roles.includes(currentProfile.role)) {
    document.getElementById("main").innerHTML = `<p class="muted">You don't have access to that section.</p>`;
    return;
  }
  document.querySelectorAll(".nav-link").forEach(a => a.classList.remove("active"));
  const activeLink = [...document.querySelectorAll(".nav-link")].find(a => a.getAttribute("href") === `#/${route.path}`);
  activeLink?.classList.add("active");
  const main = document.getElementById("main");
  main.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    await route.view.render(main, { user: currentUser, profile: currentProfile }, params);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<p class="error-text">Something went wrong loading this page. Please try again.</p>`;
  }
}

window.addEventListener("hashchange", () => {
  if (currentUser) routeToView();
});

watchAuth((user, profile) => {
  currentUser = user;
  currentProfile = profile;
  if (!user || !profile) {
    LoginView.render(appEl);
    return;
  }
  renderShell();
});
