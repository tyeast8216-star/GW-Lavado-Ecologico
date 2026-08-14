document.addEventListener('DOMContentLoaded', function () {
  // If redirected from PayPal after approval, capture the order on the server
  (async function tryCapturePayPal(){
    try{
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || params.get('paypal_token') || params.get('paypalOrderId');
      if (!token) return;
      // call server to capture
      const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
      const resp = await fetch(API_BASE + '/api/capture-paypal-order', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ orderId: token }) });
      const j = await resp.json().catch(()=>null);
      if (resp.status === 401) { window.location.href = 'login.html'; return; }
      if (j && j.ok && j.paid) {
        const orderObj = { id: j.id || ('PAYPAL-' + (token || '').slice(0,8)), date: new Date().toLocaleString(), paymentMethod: 'PayPal', items: [], total: j.order && j.order.total ? j.order.total : 0 };
        try { localStorage.setItem('lastOrder', JSON.stringify(orderObj)); } catch(e) {}
        // clear cart
        try { localStorage.removeItem('cart'); } catch(e){}
        // remove token from URL to avoid re-capture
        try { history.replaceState(null, '', window.location.pathname); } catch(e) {}
      } else {
        console.warn('PayPal capture failed', j);
      }
    }catch(e){ console.error('Error capturing PayPal order', e); }
  })();
  // Intenta obtener el último pedido desde localStorage
  let lastOrder = null;
  try {
    lastOrder = JSON.parse(localStorage.getItem('lastOrder'));
  } catch (e) {
    lastOrder = null;
  }

  // Datos de ejemplo si no hay pedido en el storage
  if (!lastOrder) {
    lastOrder = {
      id: 'MOCK-12345',
      date: new Date().toLocaleString(),
      customer: { name: 'Cliente Ejemplo', email: 'cliente@ejemplo.com' },
      paymentMethod: 'Tarjeta de crédito',
      shipping: 5.00,
      items: [
        { title: 'Producto A', qty: 1, price: 29.99, specs: 'Color: Negro, Talla: M', image: 'images' },
        { title: 'Producto B', qty: 2, price: 9.99, specs: 'Pack 2 unidades', image: 'images' }
      ]
    };
  }

  // Rellenar la UI
  document.getElementById('orderId').textContent = lastOrder.id || '—';
  document.getElementById('orderDate').textContent = lastOrder.date || '—';

  // Intentar obtener datos de cliente desde lastOrder o desde storage comunes
  function findCustomer() {
    if (lastOrder.customer && (lastOrder.customer.name || lastOrder.customer.email)) return lastOrder.customer;
    const keys = ['user','authUser','profile','account','customer'];
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k);
        if (!v) continue;
        try {
          const parsed = JSON.parse(v);
          if (parsed && (parsed.name || parsed.email || parsed.username || parsed.email_address)) return { name: parsed.name || parsed.username || parsed.email_address, email: parsed.email || parsed.email_address };
        } catch (e) {
          if (v.indexOf('@') !== -1) return { name: v.split('@')[0], email: v };
        }
      } catch (e) { /* ignore */ }
    }
    // fallback to any token-like entries that may contain JSON
    try {
      const maybe = localStorage.getItem('authUser') || localStorage.getItem('user');
      if (maybe) {
        try { const p = JSON.parse(maybe); if (p && (p.email||p.name)) return { name: p.name||p.email.split('@')[0], email: p.email }; } catch(e) {}
      }
    } catch(e){}
    return { name: '', email: '' };
  }

  const customer = findCustomer();
  document.getElementById('customerName').textContent = customer.name || ((lastOrder.customer && lastOrder.customer.name) || '—');
  document.getElementById('customerEmail').textContent = customer.email || ((lastOrder.customer && lastOrder.customer.email) || '—');
  document.getElementById('paymentMethod').textContent = lastOrder.paymentMethod || '—';

  const productsList = document.getElementById('productsList');
  productsList.innerHTML = '';

  let subtotal = 0;
  (lastOrder.items || []).forEach(item => {
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center justify-content-between product-row p-2 border rounded mb-2';

    // Nombre del producto más robusto
    const prodName = (item && (item.title || item.name || item.product || item.product_name || item.nombre)) || '';
    const prodSpecs = (item && (item.specs || item.description || item.desc || item.nombre_detalle)) || '';
    const imgSrc = (item && (item.image || item.img || item.imageUrl)) || 'images/placeholder.png';
    const qty = (item && (item.qty || item.quantity || item.cantidad)) || 1;
    const price = Number((item && (item.price || item.unit_price || item.precio)) || 0);

    row.innerHTML = `
      <div class="d-flex align-items-center">
        <img src="${imgSrc}" alt="" class="mr-3"> 
        <div>
          <div><strong>${prodName || 'Sin nombre'}</strong></div>
          <div class="text-muted small">${prodSpecs || ''}</div>
        </div>
      </div>
      <div>
        <div>${qty} × $${price.toFixed(2)}</div>
      </div>
    `;

    productsList.appendChild(row);
    subtotal += price * qty;
  });

  // Rellenar campo productName con los nombres de los productos (primero o lista corta)
  try {
    const names = (lastOrder.items || []).map(i => (i && (i.title || i.name || i.product || i.product_name || i.nombre)) || '').filter(Boolean);
    const productNameEl = document.getElementById('productName');
    if (productNameEl) productNameEl.textContent = names.length === 0 ? '—' : (names.length === 1 ? names[0] : names.slice(0,3).join(', ') + (names.length>3 ? '...' : ''));
  } catch (e) {}

  // Si no hay datos de cliente rellenados, intentar obtener sesión desde la API
  async function fetchSessionUser() {
    try{
      const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
      // try relative first
      let res = await fetch(API_BASE + '/api/me', { credentials: 'include', cache: 'no-store' });
      if (res && res.status === 200) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')){
          const data = await res.json();
          if (data && data.ok && data.user) {
            return { name: data.user.name || data.user.username || data.user.email || '', email: data.user.email || '' };
          }
        }
      }
    }catch(e){ /* ignore */ }
    // try localhost candidate ports like auth.js if first attempt fails
    try{
      const bases = [];
      for(let p=3000;p<=3010;p++) bases.push('http://localhost:' + p);
      for(const b of bases){
        try{
          const res2 = await fetch(b + '/api/me', { credentials: 'include', cache: 'no-store' });
          if (!res2) continue;
          const ct2 = res2.headers.get('content-type') || '';
          if (ct2.includes('application/json')){
            const d2 = await res2.json();
            if (d2 && d2.ok && d2.user) return { name: d2.user.name || d2.user.username || d2.user.email || '', email: d2.user.email || '' };
          }
        }catch(e){ /* try next */ }
      }
    }catch(e){}
    return null;
  }

  (async function ensureUserInfo(){
    const nameEl = document.getElementById('customerName');
    const emailEl = document.getElementById('customerEmail');
    if ((nameEl && (nameEl.textContent === '—' || nameEl.textContent.trim() === '')) || (emailEl && (emailEl.textContent === '—' || emailEl.textContent.trim() === ''))) {
      try{
        const sess = await fetchSessionUser();
        if (sess) {
          if (nameEl) nameEl.textContent = sess.name || nameEl.textContent || '—';
          if (emailEl) emailEl.textContent = sess.email || emailEl.textContent || '—';
        }
      }catch(e){}
    }
  })();

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('shipping').textContent = `$${(lastOrder.shipping||0).toFixed(2)}`;
  document.getElementById('total').textContent = `$${(subtotal + (lastOrder.shipping||0)).toFixed(2)}`;

  // Redirección: botón
  // Determina el destino en este orden: parámetro URL `redirect`/`redirectTo`, localStorage `redirectTo`, por defecto `tienda-virtual.html`.
  function getRedirectUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('redirect') || params.get('redirectTo');
      if (p) return p;
    } catch (e) {}
    try {
      const ls = localStorage.getItem('redirectTo');
      if (ls) return ls;
    } catch (e) {}
    // Si el usuario está logueado, lo más conveniente es enviarlo al panel de usuario
    function looksLoggedIn() {
      try {
        const possibleKeys = ['user','authUser','authToken','token','loggedIn'];
        for (const k of possibleKeys) {
          const v = localStorage.getItem(k);
          if (!v) continue;
          // Si es un boolean/string truthy o JSON con id/email
          if (v === 'true') return true;
          try {
            const parsed = JSON.parse(v);
            if (parsed && (parsed.id || parsed.email || parsed.token)) return true;
          } catch (e) {
            if (v && v.length > 5) return true;
          }
        }
      } catch (e) {}
      return false;
    }

    return looksLoggedIn() ? 'user-dashboard.html' : 'tienda-virtual.html';
  }
  const redirectUrl = getRedirectUrl();
  const continuarBtn = document.getElementById('continuarBtn');
  continuarBtn.addEventListener('click', function (e) {
    e.preventDefault();
    window.location.href = redirectUrl;
  });
});
