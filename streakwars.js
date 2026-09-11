import { getStreakLeaderboard } from "../data.js";

export async function render(container, ctx) {
  const entries = await getStreakLeaderboard();
  container.innerHTML = `
    <h2>StreakWars</h2>
    <p class="muted">A year-round consistency competition, completely separate from Ranked. Streaks never affect RP.</p>
    <div class="card section-gap">
      <div class="card-title">Your streak</div>
      <div class="display" style="font-size:1.8rem">🔥 ${ctx.profile.streak || 0} days</div>
    </div>
    <div class="card section-gap">
      ${entries.map(e => `
        <div class="lb-row ${e.rank <= 3 ? "top3" : ""}">
          <div class="lb-rank ${e.rank <= 3 ? "gold-txt" : ""}">#${e.rank}</div>
          <div class="lb-name">${e.displayName}</div>
          <div class="lb-rp">🔥 ${e.streak || 0}</div>
        </div>`).join("") || `<p class="muted">No streaks yet.</p>`}
    </div>
  `;
}
