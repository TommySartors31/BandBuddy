import { hasUsedRankedToday, getActiveSeason, getSeasonPassLevels, getLeaderboard } from "../data.js";

export async function render(container, ctx) {
  const { user, profile } = ctx;
  const season = await getActiveSeason();
  const usedToday = await hasUsedRankedToday(user.uid);
  const levels = await getSeasonPassLevels();
  const xp = profile.currentSeasonXP || 0;
  const currentLevel = [...levels].reverse().find(l => xp >= l.xpRequired) || levels[0];
  const nextLevel = levels.find(l => l.xpRequired > xp);

  const overall = await getLeaderboard(null);
  const mine = overall.find(s => s.id === user.uid);
  const division = mine ? mine.division : 2;
  const rank = mine ? mine.rank : "—";

  container.innerHTML = `
    <div class="hero">
      <div class="welcome">Welcome back</div>
      <div class="name">${profile.displayName}</div>
      <div class="stat-row">
        <div class="stat"><div class="label">Season</div><div class="value">${season ? season.name : "—"}</div></div>
        <div class="stat"><div class="label">Rank</div><div class="value gold">#${rank}</div></div>
        <div class="stat"><div class="label">RP</div><div class="value">${profile.currentRP || 0}</div></div>
        <div class="stat"><div class="label">Division</div><div class="value">${division}</div></div>
        <div class="stat"><div class="label">Streak</div><div class="value">🔥 ${profile.streak || 0}</div></div>
        <div class="stat"><div class="label">Season XP</div><div class="value">${xp}${nextLevel ? " / " + nextLevel.xpRequired : ""}</div></div>
      </div>
    </div>

    <div class="grid grid-3">
      <a class="card" href="#/ranked" style="text-decoration:none">
        <div class="card-title">🎵 Ranked</div>
        <h3>${usedToday ? "Attempt complete" : "Attempt available"}</h3>
        <p class="muted" style="font-size:0.85rem;margin-top:6px">${usedToday ? "You can still practice." : "Submit today's official performance."}</p>
      </a>
      <a class="card" href="#/streakwars" style="text-decoration:none">
        <div class="card-title">🔥 StreakWars</div>
        <h3>${profile.streak || 0} day streak</h3>
        <p class="muted" style="font-size:0.85rem;margin-top:6px">Keep it alive with today's Ranked attempt.</p>
      </a>
      <a class="card" href="#/seasonpass" style="text-decoration:none">
        <div class="card-title">🎟️ Season Pass</div>
        <h3>Level ${currentLevel.level}</h3>
        <p class="muted" style="font-size:0.85rem;margin-top:6px">${nextLevel ? `${nextLevel.xpRequired - xp} XP to Level ${nextLevel.level}` : "Max level reached"}</p>
      </a>
      <a class="card" href="#/guessthenote" style="text-decoration:none">
        <div class="card-title">🎯 Guess The Note</div>
        <h3>Play now</h3>
        <p class="muted" style="font-size:0.85rem;margin-top:6px">Sharpen your note-reading. Earns XP only.</p>
      </a>
      <a class="card" href="#/tournaments" style="text-decoration:none">
        <div class="card-title">🏆 Tournaments</div>
        <h3>View open events</h3>
        <p class="muted" style="font-size:0.85rem;margin-top:6px">Includes BMCS qualifying events when posted.</p>
      </a>
      <a class="card" href="#/leaderboards" style="text-decoration:none">
        <div class="card-title">📊 Leaderboards</div>
        <h3>See the standings</h3>
        <p class="muted" style="font-size:0.85rem;margin-top:6px">Overall, Block 6, Block 4.</p>
      </a>
    </div>
  `;
}
