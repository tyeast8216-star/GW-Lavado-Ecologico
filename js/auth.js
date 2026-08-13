async function loadAuthLink() {
  try {
    const userApiFromResponse = async (res) => {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return res.json();
      const text = await res.text();
      return { __nonJson: true, text };
    };

    const explicitBase = (window.API_BASE || '').replace(/\/$/, '');
    const baseOrigin = (window.location.origin || '').replace(/\/$/, '');
    const candidateBases = [];
    if (baseOrigin) candidateBases.push(baseOrigin);
    if (explicitBase && candidateBases.indexOf(explicitBase) === -1) candidateBases.push(explicitBase);
    for (let p = 3000; p <= 3010; p++) candidateBases.push('http://localhost:' + p);

    let data;
    let usedBase = null;
    const basesToTry = [''].concat(candidateBases);
    for (const base of basesToTry) {
      try {
        const url = base ? (base + '/api/me') : '/api/me';
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        const parsed = await userApiFromResponse(res);
        if (parsed && !parsed.__nonJson) {
          data = parsed;
          usedBase = base;
          break;
        }
      } catch (err) {
        // ignore and try next
      }
    }

    if (!data) {
      console.warn('auth check: no JSON response from any candidate API base');
      return;
    }
    if (!data.ok || !data.user) {
      console.log('auth check: no user in session', data);
      const userActions = document.querySelector('.user-actions');
      if (userActions) userActions.classList.remove('is-authenticated', 'is-admin');
      const unauthenticatedLogin = document.querySelector('.account-btn');
      if (unauthenticatedLogin) {
        unauthenticatedLogin.style.display = 'flex';
      }
      const accountIcon = document.querySelector('.account-icon-link');
      if (accountIcon) accountIcon.style.display = 'none';
      const adminIcon = document.querySelector('.admin-icon-link');
      if (adminIcon) adminIcon.style.display = 'none';
      return;
    }

    data.user.isAdmin = !!(data.user.isAdmin || data.user.isadmin || data.user.is_admin);
    const isAdmin = data.user.isAdmin;
    const userActions = document.querySelector('.user-actions');
    if (userActions) {
      userActions.classList.add('is-authenticated');
      if (isAdmin) userActions.classList.add('is-admin');
      else userActions.classList.remove('is-admin');
    }
    const unauthenticatedLogin = document.querySelector('.account-btn');
    if (unauthenticatedLogin) unauthenticatedLogin.style.display = 'none';
    console.log('auth check /api/me ->', data, 'usedBase=', usedBase, 'document.cookie=', document.cookie.slice(0, 200));
    if (isAdmin) console.log('auth check: admin user detected', data.user);

    const insertAdminLink = () => {
      if (document.querySelector('.admin-icon-link') || document.getElementById('admin-nav-link') || document.getElementById('admin-nav-anchor')) return false;

      const userActions = document.querySelector('.user-actions');
      if (userActions) {
        const btn = document.createElement('a');
        btn.href = '/dashboard.html';
        btn.title = 'Panel de administración';
        btn.className = 'action-btn icon-action-btn admin-icon-link';
        btn.setAttribute('aria-label', 'Panel de administración');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3.1 8.7-7 10-3.9-1.3-7-5.5-7-10V6l7-3z"></path><path d="M9.5 12.5l1.5 1.5 3.5-4"></path></svg>';
        const cartBtn = userActions.querySelector('.cart-btn');
        if (cartBtn) userActions.insertBefore(btn, cartBtn);
        else userActions.appendChild(btn);
        return true;
      }

      const containerSelectors = ['.topbar-actions', '.topbar-nav', '.navbar-nav', '.collapse.navbar-collapse', '.custom_nav-container', 'header'];
      const navContainers = [];
      containerSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (el && !navContainers.includes(el)) navContainers.push(el);
        });
      });
      if (!navContainers.length) return false;

      let inserted = false;
      navContainers.forEach(container => {
        try {
          if (!container || container.querySelector('#admin-nav-link')) return;
          const li = document.createElement('li');
          li.id = 'admin-nav-link';
          li.className = 'nav-item';
          li.innerHTML = '<a class="nav-link nav-link-action" href="/dashboard.html" title="Panel de administración" aria-label="Panel de administración"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3.1 8.7-7 10-3.9-1.3-7-5.5-7-10V6l7-3z"></path><path d="M9.5 12.5l1.5 1.5 3.5-4"></path></svg></a>';
          const accountLink = container.querySelector('#account-nav-link');
          if (accountLink && accountLink.parentElement) {
            accountLink.parentElement.insertBefore(li, accountLink);
          } else {
            container.appendChild(li);
          }
          inserted = true;
          console.log('auth: admin link injected into navbar');
        } catch (err) {
          console.warn('auth: error injecting admin link', err);
        }
      });
      return inserted;
    };

    const insertAccountLink = () => {
      if (document.querySelector('.account-icon-link') || document.getElementById('account-nav-link')) return true;

      const userActions = document.querySelector('.user-actions');
      if (userActions) {
        const btn = document.createElement('a');
        btn.href = '/user-dashboard.html';
        btn.title = 'Mi cuenta';
        btn.className = 'action-btn icon-action-btn account-icon-link';
        btn.setAttribute('aria-label', 'Mi cuenta');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
        const adminBtn = userActions.querySelector('.admin-icon-link');
        const cartBtn = userActions.querySelector('.cart-btn');
        if (adminBtn) userActions.insertBefore(btn, adminBtn);
        else if (cartBtn) userActions.insertBefore(btn, cartBtn);
        else userActions.appendChild(btn);
        return true;
      }

      const containerSelectors = ['.topbar-actions', '.topbar-nav', '.navbar-nav', '.collapse.navbar-collapse', '.custom_nav-container', 'header'];
      const navContainers = [];
      containerSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (el && !navContainers.includes(el)) navContainers.push(el);
        });
      });
      if (!navContainers.length) return false;

      let inserted = false;
      navContainers.forEach(container => {
        try {
          if (!container || container.querySelector('#account-nav-link')) return;
          const li = document.createElement('li');
          li.id = 'account-nav-link';
          li.className = 'nav-item';
          li.innerHTML = '<a class="nav-link nav-link-action" href="/user-dashboard.html" title="Mi cuenta" aria-label="Mi cuenta"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></a>';
          const loginLink = container.querySelector('a[href*="login.html"]');
          if (loginLink && loginLink.parentElement) {
            loginLink.parentElement.insertAdjacentElement('afterend', li);
          } else {
            container.appendChild(li);
          }
          inserted = true;
        } catch (err) {
          console.warn('auth: error injecting account link', err);
        }
      });
      return inserted;
    };

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

    const hideLoginLinks = () => {
      try {
        const sel = 'a[href*="login.html"]';
        document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
        document.querySelectorAll('.nav-item a').forEach(a => {
          if (/iniciar sesión|iniciar|login/i.test((a.textContent || '').trim())) a.style.display = 'none';
        });
      } catch (e) {
        // ignore
      }
    };

    hideLoginLinks();
  } catch (e) {
    console.warn('auth check failed', e);
  }
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
              <div class="login-feedback" role="alert" aria-live="polite"></div>
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

function setLoginFeedback(form, message, kind = 'danger') {
  let feedback = document.getElementById('loginModalError');

  if (!feedback && form) {
    feedback = form.querySelector('.login-feedback');
  }

  if (!feedback) {
    feedback = document.createElement('div');
    feedback.className = 'login-feedback';
    feedback.id = 'loginModalError';
    feedback.setAttribute('role', 'alert');
    feedback.setAttribute('aria-live', 'polite');
    const modal = document.getElementById('loginModal');
    const submitBtn = modal ? modal.querySelector('button[type="submit"]') : (form ? form.querySelector('button[type="submit"]') : null);
    if (submitBtn) submitBtn.insertAdjacentElement('afterend', feedback);
    else if (form) form.appendChild(feedback);
    else document.body.appendChild(feedback);
  }

  feedback.textContent = message || '';
  feedback.style.display = message ? 'block' : 'none';
  feedback.style.color = kind === 'success' ? '#15803d' : '#b00020';
  feedback.style.marginTop = '10px';
  feedback.style.fontSize = '14px';
  feedback.style.fontWeight = '600';
  feedback.style.textAlign = 'center';

  try {
    showToast(message || 'Error', kind);
  } catch (e) {
    // ignore if toast system is unavailable
  }
}

function attachLoginFormHandler() {
  const forms = Array.from(document.querySelectorAll('.login-form'));
  forms.forEach(form => {
    if (!form || form.dataset.loginBound) return;
    form.addEventListener('input', () => {
      const feedback = document.getElementById('loginModalError') || form.querySelector('.login-feedback');
      if (feedback) {
        feedback.textContent = '';
        feedback.style.display = 'none';
      }
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const email = (form.querySelector('input[name="email"]') || {}).value || '';
      const password = (form.querySelector('input[name="password"]') || {}).value || '';
      if (!email || !password) {
        setLoginFeedback(form, 'Por favor ingresa correo y contraseña', 'danger');
        return;
      }
      try {
        const resp = await postToApi('/login', { email, password });
        if (resp && resp.ok) {
          setLoginFeedback(form, 'Inicio de sesión correcto', 'success');
          try { if (window.jQuery) { window.jQuery('#loginModal').modal('hide'); $('.modal-backdrop').remove(); document.body.classList.remove('modal-open'); } } catch (e) { }
          window.location.href = '/';
          return;
        }
        const msg = (resp && resp.message) ? resp.message : 'Credenciales incorrectas';
        const modalError = document.getElementById('loginModalError') || form.querySelector('.login-feedback');
        if (modalError) {
          modalError.textContent = msg;
          modalError.style.display = 'block';
          modalError.style.color = '#b00020';
          modalError.style.marginTop = '10px';
          modalError.style.fontSize = '14px';
          modalError.style.fontWeight = '600';
          modalError.style.textAlign = 'center';
        }
        setLoginFeedback(form, msg, 'danger');
      } catch (err) {
        console.error('login submit error', err);
        setLoginFeedback(form, 'Error de conexión con el servidor', 'danger');
      }
    });
    form.dataset.loginBound = '1';
  });
}

function attachRegisterFormHandler() {
  const form = document.querySelector('.register-form');
  if (!form || form.dataset.registerBound) return;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = (document.getElementById('name') || {}).value || '';
    const email = (document.getElementById('email') || {}).value || '';
    const phone = (document.getElementById('phone') || {}).value || '';
    const password = (document.getElementById('password') || {}).value || '';
    const password2 = (document.getElementById('password2') || {}).value || '';
    const verificationCode = (document.getElementById('email-code') || {}).value || '';

    if (!name || !email || !password || !password2) {
      try { showToast('Por favor completa todos los campos', 'danger'); } catch (e) { }
      return;
    }
    if (password !== password2) {
      try { showToast('Las contraseñas no coinciden', 'danger'); } catch (e) { }
      return;
    }
    if (!verificationCode) {
      try {
        const resp = await postToApi('/api/send-verification', { email });
        if (resp && resp.ok) {
          const area = document.getElementById('email-verification-area');
          if (area) area.style.display = 'block';
          const codeInput = document.getElementById('email-code');
          if (resp.code && codeInput) {
            codeInput.value = resp.code;
          }
          let msg = 'Código enviado al correo. Ingresa el código y vuelve a enviar.';
          if (resp.code) msg = `Código de verificación: ${resp.code}. Ingresa el código y vuelve a enviar.`;
          try { showToast(msg, 'success'); } catch (e) { }
          return;
        }
        try { showToast(resp && resp.message ? resp.message : 'No se pudo enviar el código de verificación', 'danger'); } catch (e) { }
      } catch (err) {
        console.error('send verification error', err);
        try { showToast('Error de conexión con el servidor', 'danger'); } catch (e) { }
      }
      return;
    }

    try {
      const resp = await postToApi('/register', { name, email, password, phone, verificationCode });
      if (resp && resp.ok) {
        try { showToast('Cuenta creada correctamente', 'success'); } catch (e) { }
        setTimeout(() => window.location.href = '/', 1200);
        return;
      }
      try { showToast(resp && resp.message ? resp.message : 'No se pudo crear la cuenta', 'danger'); } catch (e) { }
    } catch (err) {
      console.error('register submit error', err);
      try { showToast('Error de conexión con el servidor', 'danger'); } catch (e) { }
    }
  });
  form.dataset.registerBound = '1';
}

document.addEventListener('DOMContentLoaded', () => {
  ensureLoginModalMarkup();
  ensureResetModalMarkup();
  attachLoginLinkInterception();
  bindForgotPasswordHandlers();
  attachResetPasswordFlow();
  attachLoginFormHandler();
  attachRegisterFormHandler();
});

window.openLoginModal = openLoginModal;
