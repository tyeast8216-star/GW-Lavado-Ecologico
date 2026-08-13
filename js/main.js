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

function setCurrentNavLink() {
    const currentPath = (window.location.pathname || '/').split('/').pop() || 'index.html';
    const currentPage = currentPath || 'index.html';

    document.querySelectorAll('.nav-links a, .drawer-nav a').forEach(link => {
        const href = (link.getAttribute('href') || '').split('?')[0].split('#')[0];
        if (!href || href === '#') {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
            return;
        }

        const normalizedHref = href.replace(/^\//, '');
        const isActive = normalizedHref === currentPage;

        link.classList.toggle('active', isActive);
        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

// Side drawer menu for mobile/tablet
document.addEventListener('DOMContentLoaded', function () {
    setCurrentNavLink();
    function createDrawer() {
        if (document.getElementById('side-drawer')) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'drawer-backdrop';
        backdrop.id = 'drawer-backdrop';

        const drawer = document.createElement('aside');
        drawer.className = 'side-drawer';
        drawer.id = 'side-drawer';

        const header = document.createElement('div');
        header.className = 'side-drawer-header';

        const brand = document.createElement('div');
        brand.className = 'side-drawer-brand';
        brand.innerHTML = '<img src="./images/logogwlavadoeco.png" alt="GW Lavado Ecologico"> <span>GW</span>';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'drawer-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Cerrar menú');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', closeDrawer);

        header.appendChild(brand);
        header.appendChild(closeBtn);

        const navWrap = document.createElement('nav');
        navWrap.className = 'drawer-nav';
        navWrap.id = 'drawer-nav';

        drawer.appendChild(header);
        drawer.appendChild(navWrap);

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);
        backdrop.addEventListener('click', closeDrawer);
    }

    function populateDrawer() {
        const target = document.getElementById('drawer-nav');
        if (!target) return;

        const sourceLinks = document.querySelectorAll('.nav-links a');
        const sources = Array.from(sourceLinks);
        target.innerHTML = '';

        sources.forEach(link => {
            const clone = link.cloneNode(true);
            clone.addEventListener('click', closeDrawer);
            target.appendChild(clone);
        });

        const userActions = document.querySelector('.user-actions');
        if (userActions) {
            const account = userActions.querySelector('.account-btn');
            const cart = userActions.querySelector('.cart-btn');
            if (account) {
                const item = account.cloneNode(true);
                item.classList.add('mobile-user-item');
                item.setAttribute('aria-label', 'Ingresar');
                item.addEventListener('click', closeDrawer);
                target.appendChild(item);
            }
            if (cart) {
                const item = cart.cloneNode(true);
                item.classList.add('mobile-user-item');
                item.addEventListener('click', closeDrawer);
                target.appendChild(item);
            }
        }
    }

    function setDrawerState(isOpen) {
        const drawer = document.getElementById('side-drawer');
        const backdrop = document.getElementById('drawer-backdrop');

        if (drawer) drawer.classList.toggle('open', isOpen);
        if (backdrop) backdrop.classList.toggle('open', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    function openDrawer() {
        createDrawer();
        populateDrawer();
        setDrawerState(true);
    }

    function closeDrawer() {
        setDrawerState(false);
    }

    const mobileBtn = document.querySelector('.mobile-menu-btn');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', function () {
            const drawer = document.getElementById('side-drawer');
            const isOpen = drawer && drawer.classList.contains('open');
            if (isOpen) closeDrawer();
            else openDrawer();
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeDrawer();
    });
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