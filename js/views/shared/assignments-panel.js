import { listMusic, listAssignments, createAssignment } from "../../data.js";
import { INSTRUMENTS, BLOCKS } from "../../firebase-config.js";

// Renders the "assign a piece to a group" panel into `body`, and wires up
// its own event listeners. Used identically by the Teacher Panel and the
// Dev Panel so assigning music works the same way from either.
export async function renderAssignmentsPanel(body, ctx, onChange) {
  const music = await listMusic();
  const assignments = await listAssignments();

  body.innerHTML = `
    <div class="card">
      <div class="card-title">Assign a piece</div>
      <label>Music piece</label>
      <select id="aMusic">${music.map(m => `<option value="${m.id}">${m.title} (${m.instrument})</option>`).join("") || `<option value="">Add music first</option>`}</select>
      <label>Due date</label>
      <input id="aDue" type="date" />
      <label>Assign to</label>
      <select id="aTargetType">
        <option value="all">Everyone</option>
        <option value="block">A specific block</option>
        <option value="instrument">A specific instrument</option>
      </select>
      <div id="aTargetValueWrap"></div>
      <div class="section-gap"><button class="btn primary" id="aCreate">Create assignment</button></div>
      <div id="aErr" class="error-text"></div>
    </div>
    <div class="card section-gap">
      <div class="card-title">Current assignments</div>
      <table>
        <thead><tr><th>Piece</th><th>Assigned to</th><th>Due</th></tr></thead>
        <tbody>${assignments.map(a => {
          const m = music.find(x => x.id === a.musicId);
          const target = a.targetType === "all" ? "Everyone" : a.targetType === "block" ? a.targetValue : `Instrument: ${a.targetValue}`;
          return `<tr><td>${m ? m.title : "Unknown piece"}</td><td>${target}</td><td>${a.dueDate || "—"}</td></tr>`;
        }).join("") || `<tr><td colspan="3" class="muted">No assignments yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;

  function renderTargetValue() {
    const type = body.querySelector("#aTargetType").value;
    const wrap = body.querySelector("#aTargetValueWrap");
    if (type === "block") {
      wrap.innerHTML = `<label>Block</label><select id="aTargetValue">${BLOCKS.map(b => `<option>${b}</option>`).join("")}</select>`;
    } else if (type === "instrument") {
      wrap.innerHTML = `<label>Instrument</label><select id="aTargetValue">${INSTRUMENTS.map(i => `<option>${i}</option>`).join("")}</select>`;
    } else {
      wrap.innerHTML = "";
    }
  }
  renderTargetValue();
  body.querySelector("#aTargetType").addEventListener("change", renderTargetValue);

  body.querySelector("#aCreate").addEventListener("click", async () => {
    const musicId = body.querySelector("#aMusic").value;
    const dueDate = body.querySelector("#aDue").value;
    const targetType = body.querySelector("#aTargetType").value;
    const targetValue = body.querySelector("#aTargetValue")?.value || null;
    if (!musicId) { body.querySelector("#aErr").textContent = "Add a music piece first."; return; }
    await createAssignment({ musicId, dueDate: dueDate || null, targetType, targetValue }, ctx.user.uid);
    onChange ? onChange() : renderAssignmentsPanel(body, ctx, onChange);
  });
}
