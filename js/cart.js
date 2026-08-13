// Simple cart using localStorage
document.addEventListener('DOMContentLoaded', function () {
  const MAX_QTY = 99;

  function showToast(message, kind = 'info', ms = 2500) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = message; wrap.appendChild(el);
    // show
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.remove(), 200); }, ms);
  }

  function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '[]');
  }
  function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
  }
  let _lastChangedId = null;

  function addToCart(id, name, price, image) {
    const cart = getCart();
    const existing = cart.find(i => i.id === id);
    if (existing) {
      if ((existing.qty || 0) < MAX_QTY) existing.qty += 1; else { showToast('Cantidad máxima alcanzada', 'warn'); }
    } else {
      cart.push({ id, name, price: Number(price), qty: 1, image: image || '' });
    }
    saveCart(cart);
    showToast(name + ' añadido al carrito', 'success');
    updateCartCountElements();
    _lastChangedId = id;
  }
  function getCartQty() {
    return getCart().reduce((s, i) => s + (i.qty||0), 0);
  }
  function updateCartCountElements() {
    const qty = getCartQty();
    document.querySelectorAll('.cart-count, .cart-badge').forEach(el => {
      el.textContent = qty;
      const parent = el.closest('.nav-cart');
      if (parent) {
        if (qty > 0) parent.classList.add('show');
        else parent.classList.remove('show');
      }
      const actionCart = el.closest('.cart-btn');
      if (actionCart && qty > 0) {
        actionCart.setAttribute('data-count', String(qty));
      }
    });
    document.querySelectorAll('.cart-btn').forEach(btn => {
      const badge = btn.querySelector('.cart-badge');
      if (badge) badge.textContent = String(qty);
    });
  }
  function renderCartPage() {
    const cart = getCart();
    const container = document.getElementById('cart-content');
    if (!container) return;

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="cart-hero-banner">
          <div>
            <span class="cart-hero-kicker">Mi compra</span>
            <h2>Tu carrito</h2>
          </div>
          <span class="cart-hero-badge">0 artículos</span>
        </div>
        <div class="cart-empty-state">
          <div class="cart-empty-icon">🛒</div>
          <h3>Tu carrito está vacío</h3>
          <p>Aún no has añadido ningún producto.</p>
          <a href="store.html" class="btn btn-primary">Explorar productos</a>
        </div>
      `;
      return;
    }

    let grand = 0;
    const itemMarkup = cart.map(item => {
      const total = item.price * item.qty;
      grand += total;
      const image = item.image && item.image.length ? item.image : 'images/slider-img.png';

      return `
        <article class="cart-item-card">
          <div class="cart-item-image-wrap">
            <div class="cart-item-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7V6a5 5 0 0 1 10 0v1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M5 9h14l-1 10H6L5 9Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              </svg>
            </div>
            <img src="${image}" alt="${item.name}" class="cart-item-image">
          </div>
          <div class="cart-item-main">
            <div class="cart-item-header">
              <div>
                <h4>${item.name}</h4>
                <span class="cart-item-price">€${item.price.toFixed(2)} c/u</span>
              </div>
              <button class="btn btn-sm btn-outline-danger cart-remove-btn" data-id="${item.id}">Eliminar</button>
            </div>
            <div class="cart-item-footer">
              <div class="cart-qty-control" aria-label="Cantidad de ${item.name}">
                <button type="button" class="cart-qty-btn" data-id="${item.id}" data-action="minus" aria-label="Disminuir cantidad">−</button>
                <span class="cart-qty-value">${item.qty}</span>
                <button type="button" class="cart-qty-btn" data-id="${item.id}" data-action="plus" aria-label="Aumentar cantidad">+</button>
              </div>
              <div class="cart-item-total">€${total.toFixed(2)}</div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    container.innerHTML = `
      <div class="cart-hero-banner">
        <div>
          <span class="cart-hero-kicker">Mi compra</span>
          <h2>Tu carrito</h2>
        </div>
        <span class="cart-hero-badge">${cart.reduce((sum, item) => sum + (item.qty || 0), 0)} artículos</span>
      </div>
      <div class="cart-shell">
        <div class="cart-items-panel">
          <div class="cart-list-header">
            <h3>Productos</h3>
            <span>${cart.reduce((sum, item) => sum + (item.qty || 0), 0)} artículos</span>
          </div>
          ${itemMarkup}
        </div>
        <aside class="cart-summary-card">
          <h3>Resumen</h3>
          <div class="summary-row">
            <span>Subtotal</span>
            <strong>€${grand.toFixed(2)}</strong>
          </div>
          <div class="summary-row">
            <span>Envío</span>
            <strong>Gratis</strong>
          </div>
          <div class="summary-row summary-row-total">
            <span>Total</span>
            <strong>€${grand.toFixed(2)}</strong>
          </div>
          <button id="checkout" class="btn cart-primary-btn">Pagar</button>
          <button id="paypal-checkout" class="btn cart-paypal-btn">
            <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" alt="PayPal" class="paypal-icon"> Pagar con PayPal
          </button>
          <a href="store.html" class="btn cart-secondary-btn">Seguir comprando</a>
        </aside>
      </div>
    `;

    document.querySelectorAll('.cart-remove-btn').forEach(btn => btn.addEventListener('click', function () {
      const id = this.dataset.id; const cart = getCart(); const idx = cart.findIndex(i => i.id === id); if (idx > -1) { cart.splice(idx, 1); saveCart(cart); renderCartPage(); }
    }));

    document.querySelectorAll('.cart-qty-btn').forEach(btn => btn.addEventListener('click', function () {
      const id = this.dataset.id;
      const delta = this.dataset.action === 'plus' ? 1 : -1;
      changeQty(id, delta);
      renderCartPage();
    }));

    const checkout = document.getElementById('checkout'); if (checkout) checkout.addEventListener('click', async function () {
      const cartNow = getCart();
      if (!cartNow || cartNow.length === 0) { showToast('El carrito está vacío', 'info'); return; }
      const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
      try{
        // create a Stripe Checkout session on the server and redirect
        const res = await fetch(API_BASE + '/api/create-checkout-session', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ items: cartNow, total: grand, description: 'Compra desde web' })
        });
        const ct = res.headers.get('content-type') || '';
        let data;
        if (ct.includes('application/json')) data = await res.json(); else { const text = await res.text(); throw new Error('Non-JSON response: ' + text); }
        if (res.status === 401) {
          if (window.openLoginModal) { window.openLoginModal(); return; }
          window.location.href = 'login.html';
          return;
        }
        if (data && data.ok && data.url) {
          // redirect to Stripe Checkout
          window.location.href = data.url;
        } else {
          showToast((data && data.message) ? data.message : 'Error al iniciar pago', 'danger');
        }
      }catch(err){ console.error('Checkout error', err); showToast('Error al iniciar pago', 'danger'); }
    });
    const paypalBtn = document.getElementById('paypal-checkout');
    if (paypalBtn) paypalBtn.addEventListener('click', async function () {
      const cartNow = getCart();
      if (!cartNow || cartNow.length === 0) { showToast('El carrito está vacío', 'info'); return; }
      const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
      try{
        const res = await fetch(API_BASE + '/api/create-paypal-order', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ items: cartNow, total: grand, description: 'Compra desde web' }) });
        const data = await res.json();
        if (res.status === 401) { if (window.openLoginModal) { window.openLoginModal(); return; } window.location.href = 'login.html'; return; }
        if (data && data.ok && data.approveUrl) {
          // redirect user to PayPal approval
          window.location.href = data.approveUrl;
        } else {
          showToast((data && data.message) ? data.message : 'Error al iniciar PayPal', 'danger');
        }
      }catch(err){ console.error('PayPal checkout error', err); showToast('Error al iniciar PayPal', 'danger'); }
    });
  }
  // Render mini cart into a dropdown container
  function changeQty(id, delta) {
    const cart = getCart();
    const idx = cart.findIndex(i => i.id === id);
    if (idx === -1) return;
    const newQty = (cart[idx].qty || 0) + delta;
    if (newQty <= 0) { cart.splice(idx, 1); saveCart(cart); updateCartCountElements(); return; }
    if (newQty > MAX_QTY) { showToast('Cantidad máxima alcanzada', 'warn'); return; }
    cart[idx].qty = newQty;
    saveCart(cart);
    updateCartCountElements();
    _lastChangedId = id;
  }

  function renderMiniCart(container) {
    const cart = getCart();
    if (!container) return;
    if (cart.length === 0) {
      container.innerHTML = '<p>El carrito está vacío.</p>';
      return;
    }
    let html = '';
    let grand = 0;
    cart.forEach(item => {
      const total = item.price * item.qty; grand += total;
      const src = item.image && item.image.length ? item.image : 'images/slider-img.png';
      html += `<div class="mini-item"><img src="${src}" alt="${item.name}"><div class="meta"><h5>${item.name}</h5><small>€${item.price.toFixed(2)}</small><div class="mini-qty-controls"><button class="btn btn-sm qty-decrease" data-id="${item.id}">−</button><span class="mini-qty" data-id="${item.id}">${item.qty}</span><button class="btn btn-sm qty-increase" data-id="${item.id}">+</button></div></div><div>€${total.toFixed(2)}</div></div>`;
    });
    html += `<div class="mini-footer"><strong>Total: €${grand.toFixed(2)}</strong><div><button id="mini-go-cart" class="btn btn-sm btn-primary">Ver carrito</button><button id="mini-go-cart2" class="btn btn-sm btn-success">Pagar</button><button id="mini-clear" class="btn btn-sm btn-danger">Vaciar carrito</button></div></div>`;
    container.innerHTML = html;
    // keep dropdown open (in case click handlers would close it)
    const wrapper = container.closest('.nav-cart'); if (wrapper) wrapper.classList.add('open');
    // attach qty handlers (stop propagation so document click doesn't close dropdown)
    container.querySelectorAll('.qty-increase').forEach(btn => btn.addEventListener('click', function (e) {
      e.stopPropagation(); const id = this.dataset.id; changeQty(id, 1); renderMiniCart(container);
    }));
    container.querySelectorAll('.qty-decrease').forEach(btn => btn.addEventListener('click', function (e) {
      e.stopPropagation(); const id = this.dataset.id; changeQty(id, -1); renderMiniCart(container);
    }));
    // highlight last changed item briefly
    if (_lastChangedId) {
      const el = container.querySelector(`.mini-item img[data-id="${_lastChangedId}"]`) || container.querySelector(`.mini-item .mini-qty[data-id="${_lastChangedId}"]`);
      // fallback: find mini-item by matching h5 text
      let itemEl = null;
      if (el) itemEl = el.closest('.mini-item'); else {
        const maybe = Array.from(container.querySelectorAll('.mini-item')).find(mi => mi.querySelector('h5') && mi.querySelector('h5').textContent.trim() === (getCart().find(i=>i.id===_lastChangedId)||{}).name);
        if (maybe) itemEl = maybe;
      }
      if (itemEl) {
        itemEl.classList.add('highlight');
        setTimeout(() => itemEl.classList.remove('highlight'), 700);
      }
      _lastChangedId = null;
    }
    const goCart = document.getElementById('mini-go-cart'); if (goCart) goCart.addEventListener('click', async function () {
      const ok = await ensureAuthenticated();
      if (!ok) { showToast('Debes iniciar sesión para ver el carrito', 'info'); setTimeout(()=>{ if (window.openLoginModal) { window.openLoginModal(); } else { window.location.href = 'login.html'; } }, 600); return; }
      window.location.href = 'cart.html';
    });
    const goCart2 = document.getElementById('mini-go-cart2'); if (goCart2) goCart2.addEventListener('click', async function () {
      const ok = await ensureAuthenticated();
      if (!ok) { showToast('Debes iniciar sesión para pagar', 'info'); setTimeout(()=>{ if (window.openLoginModal) { window.openLoginModal(); } else { window.location.href = 'login.html'; } }, 600); return; }
      window.location.href = 'cart.html';
    });
    const miniCheckout = document.getElementById('mini-checkout'); if (miniCheckout) miniCheckout.addEventListener('click', function () { showToast('Ir a pago (simulado).', 'info'); });
    const miniClear = document.getElementById('mini-clear'); if (miniClear) miniClear.addEventListener('click', function () { if (confirm('¿Vaciar el carrito?')) { localStorage.removeItem('cart'); renderMiniCart(container); updateCartCountElements(); showToast('Carrito vaciado', 'info'); } });
    // attach remove buttons if added in future
  }
  // Attach add-to-cart via event delegation so dynamically added buttons work
  async function ensureAuthenticated() {
    // quick DOM check for injected account link
    try{
      if (document.getElementById('account-nav-link')) return true;
    }catch(e){ /* ignore */ }
    // fallback: ask API for session
    try{
      const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
      const res = await fetch(API_BASE + '/api/me', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) return false;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')){
        const data = await res.json();
        return !!(data && data.ok && data.user);
      }
      return false;
    }catch(err){ return false; }
  }

  document.addEventListener('click', async function (e) {
    const btn = e.target.closest && e.target.closest('.add-to-cart');
    if (!btn) return;
    e.preventDefault();
    // ensure user is authenticated before adding to cart
    const ok = await ensureAuthenticated();
    if (!ok) {
      showToast('Debes iniciar sesión para añadir al carrito', 'info');
      setTimeout(() => { if (window.openLoginModal) { window.openLoginModal(); } else { window.location.href = 'login.html'; } }, 600);
      return;
    }
    const id = btn.dataset.id;
    let name = btn.dataset.name;
    let price = btn.dataset.price;
    const image = btn.dataset.image;
    if ((!name || name.trim() === '') || (!price || price.trim() === '')) {
      const card = btn.closest('.product-card');
      if (card) {
        if (!name || name.trim() === '') {
          const h = card.querySelector('h4'); if (h) name = h.textContent.trim();
        }
        if (!price || price.trim() === '') {
          const p = card.querySelector('.price'); if (p) {
            const raw = p.textContent.replace(/[€\s]/g, '').replace(',', '.');
            price = parseFloat(raw) || 0;
          }
        }
      }
    }
    addToCart(id, name, price, image);
  });
  // Clear cart button
  const clearBtn = document.getElementById('clear-cart'); if (clearBtn) clearBtn.addEventListener('click', function () { localStorage.removeItem('cart'); renderCartPage(); });
  document.querySelectorAll('.cart-btn').forEach(btn => {
    btn.addEventListener('click', function (event) {
      const href = this.getAttribute('href');
      if (href && href !== '#') return;
      event.preventDefault();
      window.location.href = 'cart.html';
    });
  });

  // Render cart page if present
  renderCartPage();
  // Update cart counts in navbar if present
  updateCartCountElements();
  // Attach dropdown toggle behavior to navbar cart buttons
  document.querySelectorAll('.nav-cart').forEach(wrapper => {
    const btn = wrapper.querySelector('.nav-cart-btn');
    const dropdown = wrapper.querySelector('.nav-cart-dropdown');
    if (!btn || !dropdown) return;
    // Show nav-cart on store page and on cursos page
    if (window.location.href.indexOf('store.html') === -1 && window.location.href.indexOf('cursos.html') === -1) {
      wrapper.classList.remove('show');
    } else {
      wrapper.classList.add('show');
    }
    // hide the cart icon if the user is not authenticated
    ensureAuthenticated().then(ok => {
      try{ if (!ok) wrapper.style.display = 'none'; else wrapper.style.display = ''; }catch(e){}
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      // toggle open
      wrapper.classList.toggle('open');
      // render mini cart inside dropdown
      renderMiniCart(dropdown);
    });
  });
  // Close dropdown when clicking outside
  document.addEventListener('click', function () { document.querySelectorAll('.nav-cart.open').forEach(n=>n.classList.remove('open')); });

  // If redirected from Stripe Checkout, verify and complete the order
  try{
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout_success') === '1' && params.get('session_id')) {
      (async function(){
        try{
          const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
          const res = await fetch(API_BASE + '/api/checkout-complete', {
            method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
            body: JSON.stringify({ sessionId: params.get('session_id') })
          });
          const data = await res.json();
          if (data && data.ok && data.paid) {
            // Construir objeto de pedido para la pantalla de pago completado.
            const cartBefore = getCart();
            // Prefer ID fields returned by the API: data.order.id, data.order._id, data.orderId, data.id
            const apiOrder = data.order || {};
            const resolvedId = apiOrder.id || apiOrder._id || data.orderId || data.id || ('ORD-' + (params.get('session_id') || '').slice(0,8));
            const orderObj = Object.assign({}, apiOrder, {
              id: resolvedId,
              date: apiOrder.date || new Date().toLocaleString(),
              customer: apiOrder.customer || null,
              paymentMethod: apiOrder.method || apiOrder.paymentMethod || 'Stripe',
              shipping: typeof apiOrder.shipping !== 'undefined' ? apiOrder.shipping : 0,
              items: apiOrder.items || cartBefore,
              total: apiOrder.total || null,
            });
            try { localStorage.setItem('lastOrder', JSON.stringify(orderObj)); } catch (e) { /* ignore */ }
            // limpiar carrito local y actualizar vista
            localStorage.removeItem('cart'); renderCartPage(); updateCartCountElements(); showToast('Pago exitoso. Compra registrada.', 'success');
            // redirigir a la pantalla de pago completado
            try { window.location.href = 'payment-complete.html'; return; } catch (e) { /* fallback below */ }
            // remove query params to keep UI clean (fallback)
            try{ history.replaceState(null, '', window.location.pathname); }catch(e){}
          } else if (res.status === 401) {
            window.location.href = 'login.html';
          } else {
            showToast((data && data.message) ? data.message : 'No se pudo verificar el pago', 'danger');
          }
        }catch(e){ console.error('Checkout complete error', e); showToast('Error verificando pedido', 'danger'); }
      })();
    } else if (params.get('checkout_canceled')) {
      showToast('Pago cancelado', 'info');
    }
  }catch(e){ /* ignore URL parsing errors */ }
});
