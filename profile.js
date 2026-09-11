import { updateOwnProfile, getSeasonPassLevels, currentSeasonPassLevel, listCosmetics, listBanners } from "../data.js";
import { db } from "../auth.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { INSTRUMENTS, BLOCKS } from "../firebase-config.js";

export async function render(container, ctx) {
  const { user, profile } = ctx;

  const histSnap = await getDocs(query(collection(db, "seasonHistory"), where("uid", "==", user.uid)));
  const history = histSnap.docs.map(d => d.data());

  const levels = await getSeasonPassLevels();
  const myLevel = currentSeasonPassLevel(levels, profile.currentSeasonXP || 0);
  const [allCosmetics, allBanners] = await Promise.all([listCosmetics(), listBanners()]);
  const ownedCosmetics = allCosmetics.filter(c => c.level <= myLevel.level).sort((a, b) => a.level - b.level);
  const ownedBanners = allBanners.filter(b => b.level <= myLevel.level).sort((a, b) => a.level - b.level);
  const equippedBannerObj = ownedBanners.find(b => b.id === profile.equippedBanner);

  container.innerHTML = `
    ${equippedBannerObj ? `<div style="height:56px;border-radius:10px;margin-bottom:14px;background:${equippedBannerObj.color}"></div>` : ""}
    <h2>${profile.displayName} ${profile.equippedDecoration ? `<span style="font-size:1.3rem">${profile.equippedDecoration}</span>` : ""}</h2>
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
      <div class="card-title">Cosmetics</div>
      <p class="muted">Unlocked through the Season Pass (currently Level ${myLevel.level}). Tap one to equip it, or unequip to clear it.</p>
      <p style="font-weight:600;margin-top:12px">Profile decorations</p>
      <div id="decoWrap" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${ownedCosmetics.length ? ownedCosmetics.map(c => `
          <button class="btn decoBtn ${profile.equippedDecoration === c.icon ? "primary" : ""}" data-icon="${c.icon}" title="${c.name} (Level ${c.level})" style="font-size:1.2rem">${c.icon}</button>
        `).join("") + `<button class="btn decoBtn" data-icon="">Unequip</button>` : `<p class="muted">None unlocked yet — keep earning XP.</p>`}
      </div>
      <p style="font-weight:600;margin-top:16px">Banners</p>
      <div id="bannerWrap" style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${ownedBanners.length ? ownedBanners.map(b => `
          <button class="btn bannerBtn ${profile.equippedBanner === b.id ? "primary" : ""}" data-id="${b.id}" style="display:flex;align-items:center;gap:10px;justify-content:flex-start">
            <span style="width:40px;height:16px;border-radius:4px;background:${b.color};display:inline-block"></span> ${b.name} <span class="muted" style="margin-left:auto">Lvl ${b.level}</span>
          </button>
        `).join("") + `<button class="btn bannerBtn" data-id="">Unequip banner</button>` : `<p class="muted">None unlocked yet — keep earning XP.</p>`}
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

  container.querySelectorAll(".decoBtn").forEach(btn => btn.addEventListener("click", async () => {
    await updateOwnProfile(user.uid, { equippedDecoration: btn.dataset.icon || null });
    profile.equippedDecoration = btn.dataset.icon || null;
    render(container, ctx);
  }));

  container.querySelectorAll(".bannerBtn").forEach(btn => btn.addEventListener("click", async () => {
    await updateOwnProfile(user.uid, { equippedBanner: btn.dataset.id || null });
    profile.equippedBanner = btn.dataset.id || null;
    render(container, ctx);
  }));
}
