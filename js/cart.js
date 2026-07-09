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
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = qty;
      // show parent cart icon if on store page
      const parent = el.closest('.nav-cart');
      if (parent) { if (qty>0) parent.classList.add('show'); else parent.classList.remove('show'); }
    });
  }
  function renderCartPage() {
    const cart = getCart();
    const container = document.getElementById('cart-content');
    if (!container) return;
    if (cart.length === 0) {
      container.innerHTML = '<p>El carrito está vacío.</p>';
      return;
    }
    let html = '<table class="table table-striped"><thead><tr><th>Producto</th><th>Precio</th><th>Cant.</th><th>Total</th><th></th></tr></thead><tbody>';
    let grand = 0;
    cart.forEach(item => {
      const total = item.price * item.qty; grand += total;
      html += `<tr><td>${item.name}</td><td>€${item.price.toFixed(2)}</td><td>${item.qty}</td><td>€${total.toFixed(2)}</td><td><button class="btn btn-sm btn-danger remove-item" data-id="${item.id}">Eliminar</button></td></tr>`;
    });
    html += `</tbody></table><div class="text-right"><h4>Total: €${grand.toFixed(2)}</h4><button id="checkout" class="btn btn-success">Pagar</button> <button id="paypal-checkout" class="btn btn-light" style="border:1px solid #ddd;margin-left:10px;display:inline-flex;align-items:center"><img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" alt="PayPal" style="height:22px;margin-right:8px"> Pagar con PayPal</button></div>`;
    container.innerHTML = html;
    document.querySelectorAll('.remove-item').forEach(btn => btn.addEventListener('click', function () {
      const id = this.dataset.id; const cart = getCart(); const idx = cart.findIndex(i => i.id === id); if (idx > -1) { cart.splice(idx, 1); saveCart(cart); renderCartPage(); }
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
