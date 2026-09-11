import { updateOwnProfile, getSeasonPassLevels, currentSeasonPassLevel } from "../data.js";
import { db } from "../auth.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { INSTRUMENTS, BLOCKS } from "../firebase-config.js";

export async function render(container, ctx) {
  const { user, profile } = ctx;

  const histSnap = await getDocs(query(collection(db, "seasonHistory"), where("uid", "==", user.uid)));
  const history = histSnap.docs.map(d => d.data());

  const levels = await getSeasonPassLevels();
  const myLevel = currentSeasonPassLevel(levels, profile.currentSeasonXP || 0);

  container.innerHTML = `
    <h2>${profile.displayName}</h2>
    <div class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <div class="card-title">Edit profile</div>
        <label>Display name</label>
        <input id="displayName" value="${profile.displayName || ""}" />
        <label>Block</label>
        <select id="block">
          <option value="">Not set</option>
          ${BLOCKS.map(b => `<option value="${b}" ${profile.block === b ? "selected" : ""}>${b}</option>`).join("")}
        </select>
        <label>Instruments (select all that apply)</label>
        <div class="grid grid-2" style="gap:6px">
          ${INSTRUMENTS.map(i => `
            <label style="display:flex;align-items:center;gap:8px;margin:0">
              <input type="checkbox" style="width:auto" value="${i}" ${(profile.instruments || []).includes(i) ? "checked" : ""} />
              ${i}
            </label>`).join("")}
        </div>
        <div class="section-gap"><button class="btn primary" id="saveBtn">Save changes</button></div>
        <div id="saveMsg" class="muted" style="margin-top:8px"></div>
      </div>

      <div class="card">
        <div class="card-title">Current standing</div>
        <p>RP: <strong>${profile.currentRP || 0}</strong></p>
        <p>Season XP: <strong>${profile.currentSeasonXP || 0}</strong></p>
        <p>Streak: <strong>🔥 ${profile.streak || 0} days</strong></p>
        <p>Season Pass level: <strong>${myLevel.level}</strong></p>
      </div>
    </div>

    <div class="card section-gap">
      <div class="card-title">Season history</div>
      ${history.length ? `
        <table>
          <thead><tr><th>Season</th><th>Final rank</th><th>Final RP</th><th>Division</th><th></th></tr></thead>
          <tbody>
            ${history.map(h => `
              <tr>
                <td>${h.seasonName}</td>
                <td>#${h.finalRank}</td>
                <td>${h.finalRP}</td>
                <td>Division ${h.division}</td>
                <td>${h.isChampion ? '<span class="badge div1">SEASON CHAMPION</span>' : ""}</td>
              </tr>`).join("")}
          </tbody>
        </table>` : `<p class="muted">No completed seasons yet.</p>`}
    </div>
  `;

  container.querySelector("#saveBtn").addEventListener("click", async () => {
    const displayName = container.querySelector("#displayName").value.trim();
    const block = container.querySelector("#block").value || null;
    const instruments = [...container.querySelectorAll("input[type=checkbox]:checked")].map(c => c.value);
    await updateOwnProfile(user.uid, { displayName, block, instruments });
    container.querySelector("#saveMsg").textContent = "Saved.";
    Object.assign(profile, { displayName, block, instruments });
  });
}
