import { getSeasonPassLevels, currentSeasonPassLevel } from "../data.js";

export async function render(container, ctx) {
  const { profile } = ctx;
  const xp = profile.currentSeasonXP || 0;
  const levels = (await getSeasonPassLevels()).sort((a, b) => a.level - b.level);

  const unlocked = levels.filter(l => xp >= l.xpRequired);
  const currentLevel = currentSeasonPassLevel(levels, xp);
  const nextLevel = levels[unlocked.length];
  const progressPct = nextLevel
    ? Math.round(((xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100)
    : 100;

  const upcoming = levels.slice(unlocked.length, unlocked.length + 5);
  const recentUnlocked = unlocked.slice(-5).reverse();

  function rowHTML(l, isUnlocked) {
    const rewardDisplay = l.reward;
    return `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;${isUnlocked ? "" : "opacity:0.55"}">
        <div>
          <div class="card-title">Level ${l.level}</div>
          <div style="font-weight:600">${rewardDisplay}</div>
        </div>
        <div>
          ${isUnlocked
            ? `<span class="badge graded">UNLOCKED</span>`
            : `<span class="badge">${l.xpRequired - xp} XP to go</span>`}
        </div>
      </div>`;
  }

  container.innerHTML = `
    <h2>Season Pass</h2>
    <p class="muted">Free for everyone, ${levels.length} levels this season. Earn XP to unlock rewards — nothing here affects your Ranked score, and everything you unlock is yours permanently.</p>

    <div class="hero section-gap">
      <div class="stat-row">
        <div class="stat"><div class="label">Current level</div><div class="value gold">${currentLevel.level}</div></div>
        <div class="stat"><div class="label">Season XP</div><div class="value">${xp}</div></div>
        <div class="stat"><div class="label">Next level</div><div class="value">${nextLevel ? nextLevel.level : "Max"}</div></div>
      </div>
      ${nextLevel ? `
        <div style="margin-top:16px;background:var(--surface-raised);border-radius:8px;height:10px;overflow:hidden">
          <div style="width:${progressPct}%;background:var(--red);height:100%"></div>
        </div>
        <p class="muted" style="margin-top:8px;font-size:0.85rem">${nextLevel.xpRequired - xp} XP to Level ${nextLevel.level}</p>
      ` : `<p class="muted" style="margin-top:16px">Max level reached — nice work.</p>`}
    </div>

    <h3 class="section-gap">Coming up</h3>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
      ${upcoming.map(l => rowHTML(l, false)).join("") || `<p class="muted">You've unlocked every level.</p>`}
    </div>

    <h3 class="section-gap">Recently unlocked</h3>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
      ${recentUnlocked.map(l => rowHTML(l, true)).join("") || `<p class="muted">Nothing unlocked yet — play Ranked or Guess The Note to start earning XP.</p>`}
    </div>

    <div class="section-gap"><button class="btn" id="showAll">Show full level list (${levels.length})</button></div>
    <div id="fullList" style="margin-top:14px;display:none;flex-direction:column;gap:8px"></div>
  `;

  container.querySelector("#showAll").addEventListener("click", () => {
    const el = container.querySelector("#fullList");
    if (el.style.display === "none") {
      el.style.display = "flex";
      el.innerHTML = levels.map(l => rowHTML(l, xp >= l.xpRequired)).join("");
      container.querySelector("#showAll").textContent = "Hide full level list";
    } else {
      el.style.display = "none";
      container.querySelector("#showAll").textContent = `Show full level list (${levels.length})`;
    }
  });
}
