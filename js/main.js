window.addEventListener("scroll", function(){
        var header = document.querySelector("header");
        if (!header) return;
        // If the page/header requests no scroll-navbar behavior, ensure classes are removed and exit
        if (document.body.classList.contains('no-scroll-navbar') || header.classList.contains('no-scroll-navbar')) {
            if (header.classList.contains('abajo')) header.classList.remove('abajo');
            if (document.body.classList.contains('scrolled')) document.body.classList.remove('scrolled');
            return;
        }
        var scrolled = window.scrollY > 0;
        // Apply the scroll-show header behavior only on larger screens
        if (window.innerWidth >= 992) {
            header.classList.toggle("abajo", scrolled);
            document.body.classList.toggle("scrolled", scrolled);
        } else {
            // ensure mobile does not get the scrolled classes
            if (header.classList.contains('abajo')) header.classList.remove('abajo');
            if (document.body.classList.contains('scrolled')) document.body.classList.remove('scrolled');
        }
})

// Side drawer menu for mobile/tablet
document.addEventListener('DOMContentLoaded', function () {
    function createDrawer() {
        if (document.getElementById('side-drawer')) return;
        const backdrop = document.createElement('div'); backdrop.className = 'drawer-backdrop'; backdrop.id = 'drawer-backdrop';
        const drawer = document.createElement('aside'); drawer.className = 'side-drawer'; drawer.id = 'side-drawer';
        const closeBtn = document.createElement('button'); closeBtn.className = 'drawer-close'; closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', closeDrawer);
        drawer.appendChild(closeBtn);
        const navWrap = document.createElement('div'); navWrap.className = 'drawer-nav'; navWrap.id = 'drawer-nav';
        drawer.appendChild(navWrap);
        document.body.appendChild(backdrop); document.body.appendChild(drawer);
        backdrop.addEventListener('click', closeDrawer);
    }

    function openDrawer() {
        createDrawer();
        const drawer = document.getElementById('side-drawer');
        const backdrop = document.getElementById('drawer-backdrop');
        // clone navbar links
        const source = document.querySelector('.custom_nav-container .navbar-nav');
        const target = document.getElementById('drawer-nav');
        if (source && target) {
            target.innerHTML = '';
            const clone = source.cloneNode(true);
            // remove active classes on clone and adjust links
            clone.querySelectorAll('.nav-item').forEach(li => { li.classList.remove('active'); });
            // move each link into target
            Array.from(clone.children).forEach(child => {
                const link = child.querySelector('.nav-link');
                if (link) {
                    const a = link.cloneNode(true);
                    a.addEventListener('click', closeDrawer);
                    target.appendChild(a);
                }
            });
<<<<<<< HEAD
=======
            // (language selector removed) -- no cloning required
>>>>>>> db60f3f4af73acec62edb26ae48248e29a92c80e
        }
        drawer.classList.add('open'); backdrop.classList.add('open'); document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        const drawer = document.getElementById('side-drawer');
        const backdrop = document.getElementById('drawer-backdrop');
        if (drawer) drawer.classList.remove('open'); if (backdrop) backdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    // attach toggler to open drawer on small screens
    document.querySelectorAll('.navbar-toggler').forEach(btn => {
        btn.addEventListener('click', function (e) {
            if (window.innerWidth < 992) {
                e.preventDefault(); e.stopPropagation(); openDrawer();
            }
            // otherwise allow normal bootstrap collapse behavior
        });
    });

    // close on escape
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
});

// Contact form submission handler with optional reCAPTCHA
document.addEventListener('DOMContentLoaded', function(){
    const form = document.getElementById('contactForm');
    if (!form) return;
    let recaptchaWidget = null;
    let recaptchaSiteKey = null;

    // load config to see if reCAPTCHA is enabled
    fetch('/api/config').then(r=>r.json()).then(cfg=>{
        if (cfg && cfg.recaptchaSiteKey) {
            recaptchaSiteKey = cfg.recaptchaSiteKey;
            // load reCAPTCHA script (v2 explicit)
            const s = document.createElement('script');
            s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
            s.async = true; s.defer = true;
            s.onload = function(){
                try{
                    if (window.grecaptcha && typeof window.grecaptcha.render === 'function'){
                        recaptchaWidget = grecaptcha.render('recaptcha-container', { 'sitekey': recaptchaSiteKey });
                    }
                }catch(e){ console.error('reCAPTCHA render error', e); }
            };
            document.head.appendChild(s);
        }
    }).catch(()=>{});

    form.addEventListener('submit', function(e){
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const name = (document.getElementById('inputName4') || {}).value || '';
        const email = (document.getElementById('inputEmail4') || {}).value || '';
        const phone = (document.getElementById('inputNumber4') || {}).value || '';
        const service = (document.getElementById('inputState') || {}).value || '';
        const message = (document.getElementById('inputMessage') || {}).value || '';
        if (!name || !email) {
            if (typeof showToast === 'function') showToast('Por favor completa nombre y email', 'danger'); else alert('Por favor completa nombre y email');
            return;
        }

        const doSubmit = (recaptchaToken)=>{
            if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
            const body = { name, email, phone, service, message };
            if (recaptchaToken) body.recaptcha = recaptchaToken;
            fetch('/api/contact', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            }).then(r=>r.json()).then(resp=>{
                if (resp && resp.ok) {
                    if (typeof showToast === 'function') showToast('Mensaje enviado correctamente', 'success'); else alert('Mensaje enviado correctamente');
                    form.reset();
                    if (recaptchaWidget && window.grecaptcha && typeof grecaptcha.reset === 'function') grecaptcha.reset(recaptchaWidget);
                } else {
                    const msg = (resp && resp.message) ? resp.message : 'Error al enviar el mensaje';
                    if (typeof showToast === 'function') showToast(msg, 'danger'); else alert(msg);
                }
            }).catch(err=>{
                console.error('Contact submit error', err);
                if (typeof showToast === 'function') showToast('Error de red al enviar el mensaje', 'danger'); else alert('Error de red al enviar el mensaje');
            }).finally(()=>{ if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; } });
        };

        // if recaptcha configured and rendered, require token
        if (recaptchaSiteKey && recaptchaWidget !== null && window.grecaptcha && typeof grecaptcha.getResponse === 'function') {
            const token = grecaptcha.getResponse(recaptchaWidget);
            if (!token) {
                if (typeof showToast === 'function') showToast('Por favor verifica el captcha', 'danger'); else alert('Por favor verifica el captcha');
                return;
            }
            doSubmit(token);
        } else if (recaptchaSiteKey && recaptchaWidget === null) {
            // recaptcha site key present but widget not yet rendered; try executing after short delay
            setTimeout(()=>{
                if (window.grecaptcha && typeof grecaptcha.getResponse === 'function' && recaptchaWidget !== null) {
                    const token = grecaptcha.getResponse(recaptchaWidget);
                    if (!token) { if (typeof showToast === 'function') showToast('Por favor verifica el captcha', 'danger'); else alert('Por favor verifica el captcha'); return; }
                    doSubmit(token);
                } else {
                    // give up gracefully
                    doSubmit();
                }
            }, 800);
        } else {
            // no recaptcha configured
            doSubmit();
        }
    });
});