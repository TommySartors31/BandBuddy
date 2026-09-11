import { getLeaderboard, getStreakLeaderboard } from "../data.js";

function rowHTML(entry, isStreak) {
  const value = isStreak ? `🔥 ${entry.streak || 0}` : (entry.currentRP || 0);
  return `
    <div class="lb-row ${entry.rank <= 3 ? "top3" : ""}">
      <div class="lb-rank ${entry.rank <= 3 ? "gold-txt" : ""}">#${entry.rank}</div>
      <div>
        <div class="lb-name">${entry.displayName}</div>
        <div class="lb-sub">${(entry.instruments || []).join(", ") || "—"} · ${entry.block || "—"}
          ${entry.division ? `<span class="badge ${entry.division === 1 ? "div1" : ""}" style="margin-left:6px">DIV ${entry.division}</span>` : ""}
        </div>
      </div>
      <div class="lb-rp">${value}</div>
    </div>`;
}

export async function render(container, ctx, params) {
  const tab = params?.tab || "overall";

  container.innerHTML = `
    <h2>Leaderboards</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0">
      ${["overall", "block6", "block4", "streakwars"].map(t => `
        <a class="btn ${tab === t ? "primary" : ""}" href="#/leaderboards/${t}">
          ${t === "overall" ? "Overall" : t === "block6" ? "Block 6" : t === "block4" ? "Block 4" : "StreakWars"}
        </a>`).join("")}
    </div>
    <div class="card" id="lbList"><p class="muted">Loading…</p></div>
  `;

  const list = container.querySelector("#lbList");
  let entries;
  if (tab === "streakwars") {
    entries = await getStreakLeaderboard();
  } else if (tab === "block6") {
    entries = await getLeaderboard("Block 6");
  } else if (tab === "block4") {
    entries = await getLeaderboard("Block 4");
  } else {
    entries = await getLeaderboard(null);
  }
  list.innerHTML = entries.length
    ? entries.map(e => rowHTML(e, tab === "streakwars")).join("")
    : `<p class="muted">No students yet.</p>`;
}
