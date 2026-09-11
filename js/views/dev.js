import {
  getActiveSeason, createSeason, endSeasonAndReset, listAllUsers, setUserRole, adjustRP,
  addMusic, getAuditLog, getSeasonPassLevels, regenerateSeasonPassCurve,
  listCosmetics, addCosmetic, listBanners, addBanner
} from "../data.js";
import { db } from "../auth.js";
import { collection, getDocs, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { INSTRUMENTS } from "../firebase-config.js";
import { uploadSheetMusic } from "../storage.js";
import { renderAssignmentsPanel } from "./shared/assignments-panel.js";

export async function render(container, ctx, params) {
  const tab = params?.tab || "seasons";
  container.innerHTML = `
    <h2>Dev Panel</h2>
    <div style="display:flex;gap:8px;margin:16px 0;flex-wrap:wrap">
      ${["seasons", "users", "music", "seasonpass", "cosmetics", "assignments", "audit"].map(t => `
        <a class="btn ${tab === t ? "primary" : ""}" href="#/dev/${t}">${t === "seasonpass" ? "Season Pass" : t[0].toUpperCase() + t.slice(1)}</a>`).join("")}
    </div>
    <div id="body"><p class="muted">Loading…</p></div>
  `;
  const body = container.querySelector("#body");

  if (tab === "seasons") {
    const active = await getActiveSeason();
    const allSnap = await getDocs(collection(db, "seasons"));
    const all = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    body.innerHTML = `
      <div class="card">
        <div class="card-title">Active season</div>
        <h3>${active ? active.name : "None — create and activate one below"}</h3>
        ${active ? `<button class="btn danger" id="endSeason" style="margin-top:10px">End season & reset RP</button>` : ""}
      </div>
      <div class="card section-gap">
        <div class="card-title">Create a season</div>
        <label>Name</label><input id="sName" placeholder="Season 1 — September 2026" />
        <label>Starting RP</label><input id="sStart" type="number" value="0" />
        <div class="section-gap"><button class="btn primary" id="createSeasonBtn">Create</button></div>
      </div>
      <div class="card section-gap">
        <div class="card-title">All seasons</div>
        <table><thead><tr><th>Name</th><th>Active</th></tr></thead>
        <tbody>${all.map(s => `<tr><td>${s.name}</td><td>${s.active ? "Yes" : "No"}
          ${!s.active ? `<button class="btn activateBtn" data-id="${s.id}" style="margin-left:8px">Activate</button>` : ""}
        </td></tr>`).join("")}</tbody></table>
      </div>
    `;
    body.querySelector("#createSeasonBtn")?.addEventListener("click", async () => {
      const name = body.querySelector("#sName").value.trim();
      if (!name) return;
      await createSeason({ name, startingRP: Number(body.querySelector("#sStart").value) || 0 }, ctx.user.uid);
      render(container, ctx, params);
    });
    body.querySelector("#endSeason")?.addEventListener("click", async () => {
      if (!confirm("End the season, archive results, and reset everyone's RP to 0?")) return;
      await endSeasonAndReset(active.id, ctx.user.uid);
      render(container, ctx, params);
    });
    body.querySelectorAll(".activateBtn").forEach(b => b.addEventListener("click", async () => {
      // deactivate all, activate selected
      for (const s of all) await updateDoc(doc(db, "seasons", s.id), { active: s.id === b.dataset.id });
      render(container, ctx, params);
    }));
    return;
  }

  if (tab === "users") {
    const students = await listAllUsers();
    body.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>RP</th><th>Adjust RP</th></tr></thead>
        <tbody>${students.map(s => `
          <tr>
            <td>${s.displayName}</td><td>${s.email}</td>
            <td>
              <select class="roleSel" data-id="${s.id}">
                <option value="student" ${s.role === "student" ? "selected" : ""}>Student</option>
                <option value="teacher" ${s.role === "teacher" ? "selected" : ""}>Teacher</option>
                <option value="dev" ${s.role === "dev" ? "selected" : ""}>Dev</option>
              </select>
            </td>
            <td>${s.currentRP || 0}</td>
            <td><input type="number" class="rpAdjust" data-id="${s.id}" placeholder="+/- RP" style="width:100px;display:inline-block"/>
                <button class="btn applyRp" data-id="${s.id}">Apply</button></td>
          </tr>`).join("")}</tbody>
      </table>`;
    body.querySelectorAll(".roleSel").forEach(sel => sel.addEventListener("change", async () => {
      await setUserRole(sel.dataset.id, sel.value, ctx.user.uid);
    }));
    body.querySelectorAll(".applyRp").forEach(btn => btn.addEventListener("click", async () => {
      const input = body.querySelector(`.rpAdjust[data-id="${btn.dataset.id}"]`);
      const delta = Number(input.value);
      if (!delta) return;
      await adjustRP(btn.dataset.id, delta, "Manual dev adjustment", ctx.user.uid);
      render(container, ctx, params);
    }));
    return;
  }

  if (tab === "music") {
    body.innerHTML = `
      <div class="card">
        <div class="card-title">Add music</div>
        <label>Title</label><input id="mTitle" />
        <label>Instrument</label>
        <select id="mInstr">${INSTRUMENTS.map(i => `<option>${i}</option>`).join("")}</select>
        <label>Difficulty</label><input id="mDiff" placeholder="e.g. Grade 2" />
        <label>Sheet music (PDF or image)</label>
        <input id="mFile" type="file" accept=".pdf,image/*" />
        <div id="mProgress" class="muted" style="margin-top:6px"></div>
        <div class="section-gap"><button class="btn primary" id="addMusicBtn">Add</button></div>
        <div id="mErr" class="error-text"></div>
      </div>`;
    body.querySelector("#addMusicBtn").addEventListener("click", async () => {
      const btn = body.querySelector("#addMusicBtn");
      const file = body.querySelector("#mFile").files[0];
      btn.disabled = true;
      body.querySelector("#mErr").textContent = "";
      try {
        let pdfURL = null;
        if (file) {
          pdfURL = await uploadSheetMusic(file, (pct) => {
            body.querySelector("#mProgress").textContent = `Uploading… ${pct}%`;
          });
        }
        await addMusic({
          title: body.querySelector("#mTitle").value,
          instrument: body.querySelector("#mInstr").value,
          difficulty: body.querySelector("#mDiff").value,
          pdfURL
        }, ctx.user.uid);
        render(container, ctx, params);
      } catch (e) {
        body.querySelector("#mErr").textContent = e.message;
        btn.disabled = false;
      }
    });
    return;
  }

  if (tab === "seasonpass") {
    const levels = await getSeasonPassLevels();
    const preview = levels.filter(l => l.level === 1 || l.level % 5 === 0 || l.level === levels.length);
    body.innerHTML = `
      <div class="card">
        <div class="card-title">Season Pass curve</div>
        <p class="muted">${levels.length} levels total. Calibrated so a typically-active student lands around Level 100–150 by season's end.</p>
        <button class="btn" id="regenBtn">Regenerate default curve</button>
        <table class="section-gap"><thead><tr><th>Level</th><th>XP required</th><th>Reward</th></tr></thead>
          <tbody>${preview.map(l => `<tr><td>${l.level}</td><td>${l.xpRequired}</td><td>${l.reward}</td></tr>`).join("")}</tbody>
        </table>
        <p class="muted" style="font-size:0.8rem">Showing every 5th level as a preview.</p>
        <p class="muted section-gap">Add a custom one-off level:</p>
        <label>Level number</label><input id="lvNum" type="number" />
        <label>XP required</label><input id="lvXp" type="number" />
        <label>Reward name</label><input id="lvReward" />
        <div class="section-gap"><button class="btn primary" id="addLevelBtn">Add level</button></div>
      </div>`;
    body.querySelector("#regenBtn").addEventListener("click", async () => {
      if (!confirm("Replace the current Season Pass levels with the auto-scaled 150-level curve? Custom levels you've added will be overwritten.")) return;
      await regenerateSeasonPassCurve(ctx.user.uid);
      render(container, ctx, params);
    });
    body.querySelector("#addLevelBtn").addEventListener("click", async () => {
      const newLevels = [...levels, {
        level: Number(body.querySelector("#lvNum").value),
        xpRequired: Number(body.querySelector("#lvXp").value),
        reward: body.querySelector("#lvReward").value
      }].sort((a, b) => a.level - b.level);
      await setDoc(doc(db, "config", "seasonPass"), { levels: newLevels });
      render(container, ctx, params);
    });
    return;
  }

  if (tab === "assignments") {
    await renderAssignmentsPanel(body, ctx, () => render(container, ctx, params));
    return;
  }

  if (tab === "cosmetics") {
    const [cosmetics, banners] = await Promise.all([listCosmetics(), listBanners()]);
    body.innerHTML = `
      <p class="muted">Tie a decoration or banner to a Season Pass level. Students automatically own everything up to their current level — no separate "grant" step — and equip it from their Profile page.</p>
      <div class="grid grid-2 section-gap">
        <div class="card">
          <div class="card-title">Add profile decoration</div>
          <label>Name</label><input id="cName" placeholder="Trumpet Star" />
          <label>Icon (an emoji)</label><input id="cIcon" placeholder="🎺" maxlength="4" />
          <label>Unlocks at Season Pass level</label><input id="cLevel" type="number" min="1" value="5" />
          <div class="section-gap"><button class="btn primary" id="addCosmeticBtn">Add decoration</button></div>
          <div id="cErr" class="error-text"></div>
        </div>
        <div class="card">
          <div class="card-title">Add banner</div>
          <label>Name</label><input id="bName" placeholder="Sunset Red" />
          <label>Color or CSS gradient</label><input id="bColor" placeholder="linear-gradient(90deg,#8B0000,#1a1a1a)" />
          <label>Unlocks at Season Pass level</label><input id="bLevel" type="number" min="1" value="10" />
          <div class="section-gap"><button class="btn primary" id="addBannerBtn">Add banner</button></div>
          <div id="bErr" class="error-text"></div>
        </div>
      </div>
      <div class="card section-gap">
        <div class="card-title">Decorations (${cosmetics.length})</div>
        <table><thead><tr><th>Level</th><th>Icon</th><th>Name</th></tr></thead>
          <tbody>${cosmetics.sort((a, b) => a.level - b.level).map(c => `<tr><td>${c.level}</td><td style="font-size:1.3rem">${c.icon}</td><td>${c.name}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">None yet.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="card section-gap">
        <div class="card-title">Banners (${banners.length})</div>
        <table><thead><tr><th>Level</th><th>Preview</th><th>Name</th></tr></thead>
          <tbody>${banners.sort((a, b) => a.level - b.level).map(b => `<tr><td>${b.level}</td><td><div style="width:60px;height:18px;border-radius:4px;background:${b.color}"></div></td><td>${b.name}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">None yet.</td></tr>`}</tbody>
        </table>
      </div>
    `;
    body.querySelector("#addCosmeticBtn").addEventListener("click", async () => {
      const name = body.querySelector("#cName").value.trim();
      const icon = body.querySelector("#cIcon").value.trim();
      const level = Number(body.querySelector("#cLevel").value);
      if (!name || !icon || !level) { body.querySelector("#cErr").textContent = "Fill in name, icon, and level."; return; }
      await addCosmetic({ name, icon, level }, ctx.user.uid);
      render(container, ctx, params);
    });
    body.querySelector("#addBannerBtn").addEventListener("click", async () => {
      const name = body.querySelector("#bName").value.trim();
      const color = body.querySelector("#bColor").value.trim();
      const level = Number(body.querySelector("#bLevel").value);
      if (!name || !color || !level) { body.querySelector("#bErr").textContent = "Fill in name, color, and level."; return; }
      await addBanner({ name, color, level }, ctx.user.uid);
      render(container, ctx, params);
    });
    return;
  }

  if (tab === "audit") {
    const log = await getAuditLog();
    body.innerHTML = `
      <table>
        <thead><tr><th>Who</th><th>Action</th><th>Target</th><th>Old</th><th>New</th></tr></thead>
        <tbody>${log.map(l => `<tr><td>${l.who}</td><td>${l.action}</td><td>${l.target}</td>
          <td>${JSON.stringify(l.oldValue)}</td><td>${JSON.stringify(l.newValue)}</td></tr>`).join("")}</tbody>
      </table>`;
  }
}
