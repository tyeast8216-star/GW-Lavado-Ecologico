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
      // do not insert if admin anchor or admin li already exists
      if (document.getElementById('admin-nav-link') || document.getElementById('admin-nav-anchor')) return false;
      const navs = document.querySelectorAll('.navbar-nav');
      if (!navs || navs.length === 0) return false;
      let inserted = false;
      navs.forEach(nav => {
        try {
          if (nav && !nav.querySelector('#admin-nav-link')) {
            const li = document.createElement('li');
            li.id = 'admin-nav-link';
            li.className = 'nav-item icon-nav-item';
            li.innerHTML = '<a class="nav-link no-dot" href="/dashboard.html" title="Panel administración" style="color:#000 !important; display: inline-flex; align-items: center; padding: 6px 4px !important; margin: 0 !important;">'
  + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" style="fill: #000 !important; stroke: #000 !important; color: #000 !important;" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M320 64C324.6 64 329.2 65 333.4 66.9L521.8 146.8C543.8 156.1 560.2 177.8 560.1 204C559.6 303.2 518.8 484.7 346.5 567.2C329.8 575.2 310.4 575.2 293.7 567.2C121.3 484.7 80.6 303.2 80.1 204C80 177.8 96.4 156.1 118.4 146.8L306.7 66.9C310.9 65 315.4 64 320 64zM320 130.8L320 508.9C458 442.1 495.1 294.1 496 205.5L320 130.9L320 130.9z"/>'
  + '</svg>'
  + '</a>';
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
    // add account icon for any logged-in user
    const insertAccountLink = () => {
      // avoid inserting more than one globally
      if (document.getElementById('account-nav-link')) return true;
      try {
        const navContainers = document.querySelectorAll('.navbar-nav, .collapse.navbar-collapse, .custom_nav-container');
        if (!navContainers || navContainers.length === 0) return false;
        navContainers.forEach(container => {
          if (document.getElementById('account-nav-link')) return;
          const li = document.createElement('li');
          li.id = 'account-nav-link';
          li.className = 'nav-item icon-nav-item';
          // if user is admin, inject the admin icon inline before the account icon
          const adminHtml = isAdmin ?
            ('<a id="admin-nav-anchor" class="nav-link no-dot admin-inline" href="/dashboard.html" title="Panel administración" style="color:#000 !important;display:inline-flex;align-items:center;padding:6px 4px !important;margin:0 !important">'
            + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" style="fill: #000 !important; stroke: #000 !important; color: #000 !important;" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
            + '<path d="M320 64C324.6 64 329.2 65 333.4 66.9L521.8 146.8C543.8 156.1 560.2 177.8 560.1 204C559.6 303.2 518.8 484.7 346.5 567.2C329.8 575.2 310.4 575.2 293.7 567.2C121.3 484.7 80.6 303.2 80.1 204C80 177.8 96.4 156.1 118.4 146.8L306.7 66.9C310.9 65 315.4 64 320 64zM320 130.8L320 508.9C458 442.1 495.1 294.1 496 205.5L320 130.9L320 130.9z"/>'
            + '</svg>'
            + '</a>') : '';

          li.innerHTML = adminHtml + `
            <a class="nav-link" href="/user-dashboard.html" title="Mi cuenta" style="display:flex;align-items:center;color:#fff;padding:6px 4px !important;margin:0 !important">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z"></path>
                <path d="M2 22c0-3.314 4.686-6 10-6s10 2.686 10 6"></path>
              </svg>
            </a>`;
          // Prefer inserting before the language selector so the icon sits between cart and language
          const langEl = container.querySelector('#langSelector');
          const cartEl = container.querySelector('.nav-cart');
          const ul = container.querySelector('.navbar-nav');
          if (langEl && langEl.parentElement) langEl.parentElement.insertBefore(li, langEl);
          else if (cartEl && cartEl.parentElement) cartEl.parentElement.insertBefore(li, cartEl.nextSibling);
          else if (ul && ul.parentElement) ul.parentElement.appendChild(li);
          else container.appendChild(li);
        });
        return true;
      } catch (err) { console.warn('auth: error injecting account link', err); return false; }
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
        // anchors that explicitly link to login.html or have data-i18n nav_login
        const sel = 'a[href*="login.html"], a[data-i18n="nav_login"]';
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
  const selector = 'a[href*="login.html"], a[data-i18n="nav_login"]';
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
    const link = event.target.closest('a[href*="login.html"], a[data-i18n="nav_login"]');
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
