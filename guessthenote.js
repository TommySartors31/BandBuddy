import { recordGuessResult, getGuessResults, resetGuessResults } from "../data.js";

// Staff position 0 = bottom line. Each step = one line/space (a diatonic step).
const TREBLE_NOTES = [
  { name: "C", pos: -2 }, { name: "D", pos: -1 }, { name: "E", pos: 0 }, { name: "F", pos: 1 },
  { name: "G", pos: 2 }, { name: "A", pos: 3 }, { name: "B", pos: 4 }, { name: "C", pos: 5 },
  { name: "D", pos: 6 }, { name: "E", pos: 7 }, { name: "F", pos: 8 }, { name: "G", pos: 9 }
];
const BASS_NOTES = [
  { name: "E", pos: -2 }, { name: "F", pos: -1 }, { name: "G", pos: 0 }, { name: "A", pos: 1 },
  { name: "B", pos: 2 }, { name: "C", pos: 3 }, { name: "D", pos: 4 }, { name: "E", pos: 5 },
  { name: "F", pos: 6 }, { name: "G", pos: 7 }, { name: "A", pos: 8 }, { name: "B", pos: 9 }
];

function renderStaff(clef, note) {
  const lineY = (i) => 40 + i * 12; // 5 lines, top to bottom
  let lines = "";
  for (let i = 0; i < 5; i++) {
    lines += `<line x1="20" y1="${lineY(i)}" x2="280" y2="${lineY(i)}" stroke="#8992a6" stroke-width="1.5"/>`;
  }
  // bottom staff line = position 0, each pos = 6px (half a line gap)
  const bottomLineY = lineY(4);
  const noteY = bottomLineY - note.pos * 6;

  let ledgers = "";
  if (note.pos < 0) {
    for (let p = -2; p >= note.pos; p -= 2) {
      const y = bottomLineY - p * 6;
      ledgers += `<line x1="140" y1="${y}" x2="164" y2="${y}" stroke="#8992a6" stroke-width="1.5"/>`;
    }
  } else if (note.pos > 8) {
    for (let p = 10; p <= note.pos; p += 2) {
      const y = bottomLineY - p * 6;
      ledgers += `<line x1="140" y1="${y}" x2="164" y2="${y}" stroke="#8992a6" stroke-width="1.5"/>`;
    }
  }

  const clefGlyph = clef === "treble"
    ? `<text x="26" y="${lineY(3) + 14}" font-size="46" fill="#e0bd6a" font-family="serif">𝄞</text>`
    : `<text x="26" y="${lineY(1) + 10}" font-size="30" fill="#e0bd6a" font-family="serif">𝄢</text>`;

  return `
    <svg viewBox="0 0 300 100" width="300" height="100" role="img" aria-label="Musical note on ${clef} clef staff">
      ${lines}
      ${clefGlyph}
      ${ledgers}
      <ellipse cx="152" cy="${noteY}" rx="8" ry="6" fill="#edeff3" transform="rotate(-15 152 ${noteY})"/>
    </svg>`;
}

export async function render(container, ctx) {
  let clef = null;
  let current = null;
  let stats = await getGuessResults(ctx.user.uid);

  function pickNote() {
    const pool = clef === "treble" ? TREBLE_NOTES : BASS_NOTES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function statBlock() {
    const s = stats[clef] || { total: 0, correct: 0 };
    const acc = s.total ? Math.round((s.correct / s.total) * 100) : 0;
    return `
      <div class="grid grid-3" style="margin-top:16px">
        <div class="card"><div class="card-title">Answered</div><div class="display" style="font-size:1.4rem">${s.total}</div></div>
        <div class="card"><div class="card-title">Correct</div><div class="display" style="font-size:1.4rem">${s.correct}</div></div>
        <div class="card"><div class="card-title">Accuracy</div><div class="display" style="font-size:1.4rem;color:var(--gold-bright)">${acc}%</div></div>
      </div>`;
  }

  function drawQuestion() {
    current = pickNote();
    const pool = clef === "treble" ? TREBLE_NOTES : BASS_NOTES;
    const options = new Set([current.name]);
    while (options.size < 4) options.add(pool[Math.floor(Math.random() * pool.length)].name);
    const shuffled = [...options].sort(() => Math.random() - 0.5);

    container.innerHTML = `
      <h2>Guess The Note</h2>
      <p class="muted">${clef === "treble" ? "Treble" : "Bass"} Clef</p>
      <div class="card">
        <div class="staff-wrap">${renderStaff(clef, current)}</div>
        <div class="note-options">
          ${shuffled.map(n => `<button class="note-btn" data-note="${n}">${n}</button>`).join("")}
        </div>
        <div id="feedback" style="text-align:center;margin-top:12px;min-height:24px"></div>
      </div>
      ${statBlock()}
      <div style="margin-top:16px;display:flex;gap:8px">
        <button class="btn" id="switchClef">Switch clef</button>
        <button class="btn" id="resetStats">Reset stats</button>
      </div>
    `;

    container.querySelector("#resetStats").addEventListener("click", async () => {
      if (!confirm("Reset your Guess The Note stats back to zero?")) return;
      stats = await resetGuessResults(ctx.user.uid, clef);
      drawQuestion();
    });

    container.querySelectorAll(".note-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const guess = btn.dataset.note;
        const correct = guess === current.name;
        container.querySelectorAll(".note-btn").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        document.getElementById("feedback").innerHTML = correct
          ? `<span style="color:var(--green)">Correct — it was ${current.name}.</span>`
          : `<span style="color:#e08789">Not quite — it was ${current.name}.</span>`;
        // Move to the next question independently of Firestore. A cloud save
        // failure must never freeze the game.
        const answeredClef = clef;
        setTimeout(() => {
          if (clef === answeredClef) drawQuestion();
        }, 900);
        try {
          stats = await recordGuessResult(ctx.user.uid, answeredClef, correct);
        } catch (e) {
          console.error("Could not save Guess The Note result:", e);
        }
      });
    });
    container.querySelector("#switchClef").addEventListener("click", () => { clef = null; drawClefPicker(); });
  }

  function drawClefPicker() {
    container.innerHTML = `
      <h2>Guess The Note</h2>
      <p class="muted">Pick a clef to practice.</p>
      <div class="grid grid-2" style="max-width:420px">
        <button class="btn primary" id="pickTreble" style="padding:24px">Treble Clef</button>
        <button class="btn primary" id="pickBass" style="padding:24px">Bass Clef</button>
      </div>
    `;
    container.querySelector("#pickTreble").addEventListener("click", () => { clef = "treble"; drawQuestion(); });
    container.querySelector("#pickBass").addEventListener("click", () => { clef = "bass"; drawQuestion(); });
  }

  drawClefPicker();
}
