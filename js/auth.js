async function loadAuthLink() {
  try {
    const userApiFromResponse = async (res) => {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return res.json();
      const text = await res.text();
      return { __nonJson: true, text };
    };

    const explicitBase = (window.API_BASE || '').replace(/\/$/, '');
    const candidatePorts = [];
    if (explicitBase) {
      candidatePorts.push(explicitBase);
    }
    // try a range of localhost ports (useful if server auto-incremented)
    for (let p = 3000; p <= 3010; p++) candidatePorts.push('http://localhost:' + p);

    let data;
    let usedBase = null;
    for (const base of candidatePorts) {
      try {
        const res = await fetch(base + '/api/me', { credentials: 'include', cache: 'no-store' });
        const parsed = await userApiFromResponse(res);
        if (parsed && !parsed.__nonJson) { data = parsed; usedBase = base; break; }
        // if non-JSON and contains Express 404 text, continue to next
      } catch (err) { /* ignore and try next */ }
    }
    if (!data) {
      console.warn('auth check: no JSON response from any candidate API base');
      return;
    }
    if (!data.ok || !data.user) {
      console.log('auth check: no user in session', data);
      return;
    }
    const isAdmin = !!data.user.isAdmin;
    console.log('auth check /api/me ->', data, 'usedBase=', usedBase, 'document.cookie=', document.cookie.slice(0, 200));
    const insertAdminLink = () => {
      if (document.getElementById('admin-nav-link')) return false;
      const navs = document.querySelectorAll('.navbar-nav');
      if (!navs || navs.length === 0) return false;
      let inserted = false;
      navs.forEach(nav => {
        try {
          if (nav && !nav.querySelector('#admin-nav-link')) {
            const li = document.createElement('li');
            li.id = 'admin-nav-link';
            li.className = 'nav-item';
            li.innerHTML = '<a class="nav-link nav-link-action" href="/dashboard.html" title="Panel administración">Panel administración</a>';
            const accountLink = nav.querySelector('#account-nav-link');
            if (accountLink && accountLink.parentElement) {
              accountLink.parentElement.insertBefore(li, accountLink);
            } else {
              nav.appendChild(li);
            }
            inserted = true;
            console.log('auth: admin link injected into navbar');
          }
        } catch (err) { console.warn('auth: error injecting admin link', err); }
      });
      return inserted;
    };
    // add dashboard/account link for any logged-in user
    const insertAccountLink = () => {
      if (document.getElementById('account-nav-link')) return true;
      const navs = document.querySelectorAll('.navbar-nav');
      if (!navs || navs.length === 0) return false;
      navs.forEach(nav => {
        try {
          if (nav && !nav.querySelector('#account-nav-link')) {
            const li = document.createElement('li');
            li.id = 'account-nav-link';
            li.className = 'nav-item';
            li.innerHTML = '<a class="nav-link nav-link-action" href="/user-dashboard.html" title="Mi cuenta">Mi cuenta</a>';
            const loginLink = nav.querySelector('a[href*="login.html"]');
            if (loginLink && loginLink.parentElement) {
              loginLink.parentElement.insertAdjacentElement('afterend', li);
            } else {
              nav.appendChild(li);
            }
          }
        } catch (err) { console.warn('auth: error injecting account link', err); }
      });
      return true;
    };
    // try immediate insert, otherwise retry a few times
    if (!insertAccountLink()) {
      let aAttempts = 0;
      const aIv = setInterval(() => {
        aAttempts += 1;
        const ok2 = insertAccountLink();
        if (ok2 || aAttempts >= 6) clearInterval(aIv);
      }, 300);
    }
    if (isAdmin) {
      if (!insertAdminLink()) {
        let attempts = 0;
        const iv = setInterval(() => {
          attempts += 1;
          const ok = insertAdminLink();
          if (ok || attempts >= 6) clearInterval(iv);
        }, 300);
      }
    }
    // hide any 'Login' links when authenticated
    const hideLoginLinks = () => {
      try {
        // anchors that explicitly link to login.html
        const sel = 'a[href*="login.html"]';
        document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
        // also hide by visible text (Spanish/English)
        document.querySelectorAll('.nav-item a').forEach(a => {
          if (/iniciar sesión|iniciar|login/i.test((a.textContent || '').trim())) a.style.display = 'none';
        });
      } catch (e) { /* ignore */ }
    };
    hideLoginLinks();
  } catch (e) { console.warn('auth check failed', e); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAuthLink);
else loadAuthLink();

// Password reset UI handlers
function apiCandidateBases() {
  const explicitBase = (window.API_BASE || '').replace(/\/$/, '');
  const candidate = [];
  if (explicitBase) candidate.push(explicitBase);
  for (let p = 3000; p <= 3010; p++) candidate.push('http://localhost:' + p);
  return candidate;
}

async function postToApi(path, body) {
  // First try same-origin relative path (works when frontend and API share origin)
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return await res.json();
    const t = await res.text();
    return { ok: false, message: 'Non-JSON response', detail: t };
  } catch (e) { /* fall through to candidate bases */ }

  const bases = apiCandidateBases();
  for (const b of bases) {
    try {
      const res = await fetch(b + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      const t = await res.text();
      return { ok: false, message: 'Non-JSON response', detail: t };
    } catch (e) { /* try next base */ }
  }
  return { ok: false, message: 'No API base available' };
}

function ensureLoginModalMarkup() {
  if (document.getElementById('loginModal')) return;
  const html = `
    <div class="modal fade" id="loginModal" tabindex="-1" role="dialog" aria-labelledby="loginModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
          <div class="modal-header border-0">
            <h5 class="modal-title" id="loginModalLabel">Acceder</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Cerrar">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body pt-0">
            <p class="login-modal-subtitle">Nombre de usuario o correo electrónico</p>
            <form id="loginModalForm" class="login-form" novalidate>
              <div class="input-group">
                <label for="modal-login-email">Correo electrónico <span class="required-star">*</span></label>
                <div class="input-with-icon email-field">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8.5v7a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#6b7280" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 8.5l-9 6-9-6" stroke="#6b7280" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <input type="email" id="modal-login-email" name="email" placeholder="usuario@ejemplo.com" required>
                </div>
              </div>
              <div class="input-group">
                <label for="modal-login-password">Contraseña <span class="required-star">*</span></label>
                <div class="input-with-icon password-field">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="10" rx="2" stroke="#6b7280" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#6b7280" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <input type="password" id="modal-login-password" name="password" placeholder="Contraseña" required>
                </div>
              </div>
              <div class="login-options">
                <label><input type="checkbox" name="remember"> Recuérdame</label>
                <a href="#" class="forgot-pass-link" id="loginModalForgotPass">Forgot Password?</a>
              </div>
              <button type="submit" class="btn-login">ACCEDER</button>
              <p class="signup register-cta"><a href="register.html">Register Now!</a></p>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
}

function ensureResetModalMarkup() {
  if (document.getElementById('password-reset-modal')) return;
  const html = `
    <div id="password-reset-modal" style="display:none;position:fixed;inset:0;align-items:center;justify-content:center;z-index:110200">
      <div style="background:rgba(0,0,0,0.7);position:absolute;inset:0;z-index:110150" onclick="document.getElementById('password-reset-modal').style.display='none'"></div>
      <div style="position:relative;background:#fff;border-radius:12px;padding:24px;max-width:420px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.18);z-index:110250">
        <h3 style="margin-top:0;margin-bottom:16px;font-size:1.4rem;color:#111">Recuperar contraseña</h3>
        <div id="reset-step-1">
          <p style="margin:0 0 14px;color:#444;font-size:0.95rem">Introduce tu correo y te enviaremos un código.</p>
          <input id="reset-email" type="email" placeholder="tu@correo.com" style="width:100%;height:46px;padding:10px 12px;border:1px solid #d8dae0;border-radius:10px;margin-bottom:14px;font-size:0.95rem" />
          <button id="send-reset-code" class="boton-info" style="width:100%;">Enviar código</button>
        </div>
        <div id="reset-step-2" style="display:none">
          <p style="margin:0 0 14px;color:#444;font-size:0.95rem">Introduce el código recibido y la nueva contraseña.</p>
          <input id="reset-code" placeholder="Código" style="width:100%;height:46px;padding:10px 12px;border:1px solid #d8dae0;border-radius:10px;margin-bottom:12px;font-size:0.95rem" />
          <input id="reset-password" type="password" placeholder="Nueva contraseña" style="width:100%;height:46px;padding:10px 12px;border:1px solid #d8dae0;border-radius:10px;margin-bottom:12px;font-size:0.95rem" />
          <input id="reset-password-confirm" type="password" placeholder="Confirmar contraseña" style="width:100%;height:46px;padding:10px 12px;border:1px solid #d8dae0;border-radius:10px;margin-bottom:12px;font-size:0.95rem" />
          <div id="pw-requirements" style="font-size:13px;color:#666;margin-top:6px;margin-bottom:12px">
            <div style="margin-bottom:8px">La contraseña debe incluir:</div>
            <ul style="padding-left:18px;margin:0;color:#444;font-size:13px;line-height:1.5">
              <li id="req-length" style="color:#b00020">Mínimo 8 caracteres</li>
              <li id="req-lower" style="color:#b00020">Una letra minúscula</li>
              <li id="req-upper" style="color:#b00020">Una letra mayúscula</li>
              <li id="req-digit" style="color:#b00020">Un número</li>
              <li id="req-symbol" style="color:#b00020">Un símbolo (ej. !@#$%)</li>
            </ul>
          </div>
          <button id="confirm-reset" class="boton-info" style="width:100%;">Restablecer contraseña</button>
        </div>
        <div id="reset-feedback" style="margin-top:12px;color:#b00020;min-height:22px"></div>
      </div>
    </div>
  `;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
}

function openLoginModal() {
  ensureLoginModalMarkup();
  ensureResetModalMarkup();
  if (window.jQuery && typeof window.jQuery === 'function') {
    try {
      window.jQuery('#loginModal').modal('show');
      return;
    } catch (e) {
      console.warn('Unable to open Bootstrap modal', e);
    }
  }
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'block';
  }
}

function attachLoginLinkInterception() {
  const selector = 'a[href*="login.html"]';
  document.querySelectorAll(selector).forEach(link => {
    if (link.dataset.loginModalBound) return;
    link.addEventListener('click', function (event) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      openLoginModal();
    });
    link.dataset.loginModalBound = '1';
  });

  document.addEventListener('click', function (event) {
    const link = event.target.closest('a[href*="login.html"]');
    if (!link) return;
    if (link.dataset.loginModalBound) return;
    event.preventDefault();
    openLoginModal();
  });
}

function bindForgotPasswordHandlers() {
  const forgotEls = Array.from(document.querySelectorAll('#forgot-pass-link, .forgot-pass-link'));
  const modal = document.getElementById('password-reset-modal');
  const step1 = document.getElementById('reset-step-1');
  const step2 = document.getElementById('reset-step-2');
  if (!modal || !step1 || !step2) return;
  forgotEls.forEach(forgot => {
    if (forgot.dataset.forgotBound) return;
    forgot.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const feedback = document.getElementById('reset-feedback');
      if (feedback) feedback.textContent = '';
      step1.style.display = 'block';
      step2.style.display = 'none';
      try { window.jQuery('#loginModal').modal('hide'); $('.modal-backdrop').remove(); document.body.classList.remove('modal-open'); } catch (err) { }
      modal.style.display = 'flex';
    });
    forgot.dataset.forgotBound = '1';
  });
}

function attachResetPasswordFlow() {
  const modal = document.getElementById('password-reset-modal');
  if (!modal) return;
  const sendBtn = document.getElementById('send-reset-code');
  const confirmBtn = document.getElementById('confirm-reset');
  const step1 = document.getElementById('reset-step-1');
  const step2 = document.getElementById('reset-step-2');
  const feedback = document.getElementById('reset-feedback');

  if (sendBtn) {
    sendBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (feedback) feedback.textContent = '';
      const email = (document.getElementById('reset-email') || {}).value || '';
      if (!email) {
        if (feedback) feedback.textContent = 'Introduce un correo válido';
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando...';
      const resp = await postToApi('/api/request-password-reset', { email });
      sendBtn.disabled = false;
      sendBtn.textContent = 'Enviar código';
      if (!resp || !resp.ok) {
        if (feedback) feedback.textContent = resp && resp.message ? resp.message : 'Error enviando código';
        return;
      }
      if (!resp.sent) {
        if (feedback) {
          feedback.style.color = '#333';
          feedback.textContent = 'Si el correo está registrado, recibirás un email con instrucciones.';
        }
        return;
      }
      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'block';
      if (resp && resp.dev && resp.code) console.log('Password reset code (dev):', resp.code);
    });
  }

  const pwInput = document.getElementById('reset-password');
  const pwConfirmInput = document.getElementById('reset-password-confirm');
  const reqLength = document.getElementById('req-length');
  const reqLower = document.getElementById('req-lower');
  const reqUpper = document.getElementById('req-upper');
  const reqDigit = document.getElementById('req-digit');
  const reqSymbol = document.getElementById('req-symbol');

  function updateRequirements(pwd) {
    try {
      if (!pwd) pwd = '';
      if (reqLength) reqLength.style.color = (pwd.length >= 8) ? '#0a0' : '#b00020';
      if (reqLower) reqLower.style.color = /[a-z]/.test(pwd) ? '#0a0' : '#b00020';
      if (reqUpper) reqUpper.style.color = /[A-Z]/.test(pwd) ? '#0a0' : '#b00020';
      if (reqDigit) reqDigit.style.color = /\d/.test(pwd) ? '#0a0' : '#b00020';
      if (reqSymbol) reqSymbol.style.color = /[^\w\s]/.test(pwd) ? '#0a0' : '#b00020';
    } catch (e) { }
  }

  if (pwInput) {
    pwInput.addEventListener('input', (ev) => { updateRequirements(ev.target.value); });
  }
  if (pwConfirmInput && pwInput) {
    pwConfirmInput.addEventListener('input', () => {
      if (!feedback) return;
      if (pwConfirmInput.value && pwConfirmInput.value !== pwInput.value) feedback.textContent = 'Las contraseñas no coinciden';
      else feedback.textContent = '';
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (feedback) feedback.textContent = '';
      const email = (document.getElementById('reset-email') || {}).value || '';
      const code = (document.getElementById('reset-code') || {}).value || '';
      const password = (document.getElementById('reset-password') || {}).value || '';
      const confirmPassword = (document.getElementById('reset-password-confirm') || {}).value || '';
      if (!email || !code || !password) {
        if (feedback) feedback.textContent = 'Completa todos los campos';
        return;
      }
      if (password !== confirmPassword) {
        if (feedback) feedback.textContent = 'Las contraseñas no coinciden';
        return;
      }
      const complexityRe = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}/;
      if (!complexityRe.test(password)) {
        if (feedback) feedback.textContent = 'La contraseña debe tener al menos 8 caracteres, incluir mayúscula, minúscula, número y símbolo';
        return;
      }
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Procesando...';
      const resp = await postToApi('/api/reset-password', { email, code, password, confirmPassword });
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Restablecer contraseña';
      if (!resp || !resp.ok) {
        if (feedback) feedback.textContent = resp && resp.message ? resp.message : 'Error al restablecer contraseña';
        return;
      }
      if (feedback) {
        feedback.style.color = '#0a0';
        feedback.textContent = 'Contraseña restablecida. Puedes iniciar sesión.';
      }
      setTimeout(() => {
        if (modal) modal.style.display = 'none';
        if (feedback) {
          feedback.style.color = '#b00020';
          feedback.textContent = '';
        }
      }, 1800);
    });
  }
}

function attachLoginFormHandler() {
  const form = document.getElementById('loginModalForm');
  if (!form || form.dataset.loginBound) return;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const email = (document.getElementById('modal-login-email') || {}).value || '';
    const password = (document.getElementById('modal-login-password') || {}).value || '';
    if (!email || !password) {
      try { showToast('Por favor ingresa correo y contraseña', 'danger'); } catch (e) { }
      return;
    }
    try {
      const resp = await postToApi('/login', { email, password });
      if (resp && resp.ok) {
        try { if (window.jQuery) { window.jQuery('#loginModal').modal('hide'); $('.modal-backdrop').remove(); document.body.classList.remove('modal-open'); } } catch (e) { }
        window.location.href = '/';
        return;
      }
      try { showToast(resp && resp.message ? resp.message : 'Credenciales incorrectas', 'danger'); } catch (e) { }
    } catch (err) {
      console.error('login submit error', err);
      try { showToast('Error de conexión con el servidor', 'danger'); } catch (e) { }
    }
  });
  form.dataset.loginBound = '1';
}

document.addEventListener('DOMContentLoaded', () => {
  ensureLoginModalMarkup();
  ensureResetModalMarkup();
  attachLoginLinkInterception();
  bindForgotPasswordHandlers();
  attachResetPasswordFlow();
  // ensure the injected login modal form has a submit handler
  attachLoginFormHandler();
});

window.openLoginModal = openLoginModal;
