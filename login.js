import { signUp, logIn } from "../auth.js";

export function render(container) {
  let mode = "login";

  function draw() {
    container.innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <img src="assets/chaminade-logo.png" alt="Chaminade College Prep" style="width:64px;height:64px;margin-bottom:12px" />
          <h1>BandBuddy</h1>
          <div class="sub">${mode === "login" ? "Sign in to your account" : "Create your student account"}</div>
          <div class="card">
            ${mode === "signup" ? `<label>Display name</label><input id="name" />` : ""}
            <label>Email</label><input id="email" type="email" autocomplete="username" />
            <label>Password</label><input id="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" />
            <div class="section-gap">
              <button class="btn primary" id="submitBtn" style="width:100%">${mode === "login" ? "Sign in" : "Create account"}</button>
            </div>
            <div id="err" class="error-text"></div>
            <div class="muted" style="margin-top:16px;font-size:0.85rem;text-align:center">
              ${mode === "login" ? `New here? <a href="#" id="toSignup" style="color:var(--red-bright)">Create an account</a>`
                                  : `Already have an account? <a href="#" id="toLogin" style="color:var(--red-bright)">Sign in</a>`}
            </div>
          </div>
          <div class="muted" style="text-align:center;margin-top:18px;font-size:0.72rem">Chaminade Bands × Horizon Studios</div>
        </div>
      </div>
    `;

    container.querySelector("#toSignup")?.addEventListener("click", (e) => { e.preventDefault(); mode = "signup"; draw(); });
    container.querySelector("#toLogin")?.addEventListener("click", (e) => { e.preventDefault(); mode = "login"; draw(); });

    container.querySelector("#submitBtn").addEventListener("click", async () => {
      const email = container.querySelector("#email").value.trim();
      const password = container.querySelector("#password").value;
      const errEl = container.querySelector("#err");
      errEl.textContent = "";
      try {
        if (mode === "signup") {
          const name = container.querySelector("#name").value.trim();
          await signUp(email, password, name);
        } else {
          await logIn(email, password);
        }
        // watchAuth in app.js will pick up the state change and re-render
      } catch (e) {
        errEl.textContent = friendlyAuthError(e.code);
      }
    });
  }

  draw();
}

function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "That password doesn't match.",
    "auth/invalid-credential": "Email or password is incorrect."
  };
  return map[code] || "Something went wrong. Please try again.";
}
