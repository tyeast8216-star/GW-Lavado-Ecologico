async function fetchJson(url, opts){
  try{
    const res = await fetch(url, Object.assign({ credentials: 'include' }, opts));
    const ct = res.headers.get('content-type') || '';
    if(ct.includes('application/json')) return await res.json();
    return null;
  }catch(e){ return null; }
}

function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"'`]/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;','`':'&#96;'}[m]; }); }

  let COUNTRIES_CACHE = null;
  async function loadCountries(){
    if(COUNTRIES_CACHE) return COUNTRIES_CACHE;
    try{
      const r = await fetch('/js/countries.json', {cache: 'no-cache'});
      if(r.ok){ COUNTRIES_CACHE = await r.json(); return COUNTRIES_CACHE; }
    }catch(e){ console.warn('Could not load countries.json', e); }
    COUNTRIES_CACHE = [];
    return COUNTRIES_CACHE;
  }

  function formatPhoneDisplay(phone){
    if(!phone) return '';
    try{
      const countries = COUNTRIES_CACHE || [];
      const raw = String(phone).trim();
      const normalized = raw.replace(/\s+/g,' ').replace(/-/g,'');
      // find longest matching dial prefix
      let match = null; let matchLen = 0;
      for(const c of countries){
        const dialNorm = (c.dial||'').replace(/-/g,'');
        if(!dialNorm) continue;
        if(normalized.startsWith(dialNorm) && dialNorm.length > matchLen){ match = c; matchLen = dialNorm.length; }
      }
      if(match){
        const rest = normalized.slice(match.dial.replace(/-/g,'').length).trim();
        const img = '<img src="https://flagcdn.com/24x18/' + match.cc + '.png" style="height:16px;vertical-align:middle;margin-right:6px">';
        const code = escapeHtml(match.dial);
        const restText = rest ? (' ' + escapeHtml(rest)) : '';
        return img + code + restText;
      }
    }catch(e){ /* ignore */ }
    return escapeHtml(phone);
  }
async function initDashboard(){
  const me = await fetchJson('/api/me');
  const welcomeTitle = document.getElementById('welcome-title');
  const nameEl = document.getElementById('user-name');
  const lastSessionEl = document.getElementById('last-session');
  const usersMsg = document.getElementById('users-msg');
  if(!me || !me.ok || !me.user){
    welcomeTitle.textContent = 'Bienvenido,';
    nameEl.textContent = '';
    usersMsg.textContent = 'Debes iniciar sesión como administrador para ver usuarios.';
    return;
  }
  nameEl.textContent = me.user.email || me.user.id || 'Admin';
  welcomeTitle.textContent = 'Bienvenido, ' + (me.user.name || me.user.email || 'Administrador');
  lastSessionEl.textContent = new Date().toLocaleString();

  // load users and stats
  const data = await fetchJson('/api/users');
  if(!data || !data.ok){ usersMsg.textContent = data && data.message ? data.message : 'No autorizado'; return; }
  const users = (data.users || []).map(u => ({
    ...u,
    isAdmin: !!(u.isAdmin || u.isadmin || u.is_admin)
  }));
  document.getElementById('stat-users').textContent = users.length;
  document.getElementById('stat-admins').textContent = users.filter(u=>u.isAdmin).length;
  // preload countries for phone formatting
  try{ await loadCountries(); }catch(e){ }
  // load sales stats
  const stats = await fetchJson('/api/stats');
  if(stats && stats.ok){
    const total = Number(stats.totalSales || 0).toFixed(2);
    document.getElementById('stat-sales').textContent = total + ' €';
  } else {
    document.getElementById('stat-sales').textContent = '0 €';
  }

  // load delivered sales stat
  try{
    const dres = await fetchJson('/api/stats/delivered');
    if(dres && dres.ok){
      const deliveredAmt = Number(dres.deliveredSales || 0).toFixed(2);
      const deliveredCount = Number(dres.deliveredCount || 0);
      const el = document.getElementById('stat-delivered-sales'); if(el) el.textContent = deliveredAmt + ' € — ' + deliveredCount + ' pedidos';
      const meta = document.getElementById('stat-delivered-meta'); if(meta) meta.textContent = deliveredCount + ' pedidos';
    } else {
      const el = document.getElementById('stat-delivered-sales'); if(el) el.textContent = '0 € — 0 pedidos';
      const meta = document.getElementById('stat-delivered-meta'); if(meta) meta.textContent = '0 pedidos';
    }
  }catch(e){ const el = document.getElementById('stat-delivered-sales'); if(el) el.textContent = '0 € — 0 pedidos'; const meta = document.getElementById('stat-delivered-meta'); if(meta) meta.textContent = '0 pedidos'; }

  // load pending orders count
  try{
    const pres = await fetchJson('/api/stats/pending');
    if(pres && pres.ok){
      const pending = Number(pres.pendingCount || 0);
      const pel = document.getElementById('stat-pending-count'); if(pel) pel.textContent = pending + ' pedidos';
    } else {
      const pel = document.getElementById('stat-pending-count'); if(pel) pel.textContent = '0 pedidos';
    }
  }catch(e){ const pel = document.getElementById('stat-pending-count'); if(pel) pel.textContent = '0 pedidos'; }

  // reset sales button handler
  const resetBtn = document.getElementById('reset-sales');
  if(resetBtn){
    resetBtn.disabled = false;
    resetBtn.onclick = async () => {
      if(!confirm('¿Reiniciar total de ventas? Esta acción eliminará el historial de compras.')) return;
      resetBtn.disabled = true;
      try{
        const res = await fetch('/api/stats/reset', { method: 'POST', credentials: 'include' });
        const data = await res.json();
        if(data && data.ok){ showToast('Total de ventas reiniciado', 'success'); initDashboard(); }
        else showToast(data && data.message ? data.message : 'Error', 'danger');
      }catch(e){ showToast('Error de conexión', 'danger'); }
      resetBtn.disabled = false;
    };
  }

  // reset delivered sales handler
  const resetDeliveredBtn = document.getElementById('reset-delivered-sales');
  if(resetDeliveredBtn){
    resetDeliveredBtn.disabled = false;
    resetDeliveredBtn.onclick = async () => {
      if(!confirm('¿Reiniciar contador de ventas entregadas? Esta acción marcará todos los pedidos como no entregados.')) return;
      resetDeliveredBtn.disabled = true;
      try{
        const res = await fetch('/api/stats/delivered/reset', { method: 'POST', credentials: 'include' });
        const data = await res.json();
        if(data && data.ok){ showToast('Ventas entregadas reiniciadas', 'success'); initDashboard(); }
        else showToast(data && data.message ? data.message : 'Error', 'danger');
      }catch(e){ showToast('Error de conexión', 'danger'); }
      resetDeliveredBtn.disabled = false;
    };
  }

  // populate table
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = '';
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.dataset.id = u.id;
    tr.innerHTML = `
      <td>${u.id}</td>
      <td class="user-name">${u.name || ''}</td>
      <td>${u.email}</td>
      <td>${u.phone || ''}</td>
      <td>${u.isAdmin ? 'Sí' : 'No'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit-btn">Editar</button>
      </td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.edit-btn').forEach(btn=> btn.addEventListener('click', onEditClick));

  // load products for admin management
  const prodRes = await fetchJson('/api/products');
  const pmsg = document.getElementById('products-msg');
  const ptbody = document.querySelector('#products-table tbody');
  ptbody.innerHTML = '';
  if(!prodRes || !prodRes.ok){ pmsg.textContent = prodRes && prodRes.message ? prodRes.message : 'No hay productos'; }
  else {
    const products = prodRes.products || [];
    products.forEach(p => {
      const tr = document.createElement('tr'); tr.dataset.id = p.id; tr.dataset.desc = p.description || '';
      tr.innerHTML = `<td>${p.id}</td><td class="prod-name">${p.name || ''}</td><td class="prod-price">${p.price || 0}</td><td class="prod-desc">${(p.description||'').substring(0,120)}</td><td class="prod-cat">${p.category || ''}</td><td class="prod-stock">${p.stock||0}</td><td class="prod-image">${p.image ? '<img src="'+p.image+'" style="height:36px" />' : ''}</td><td><button class="btn btn-sm btn-outline-primary prod-edit">Editar</button> <button class="btn btn-sm btn-danger prod-del">Borrar</button></td>`;
      ptbody.appendChild(tr);
    });
    // attach handlers
    ptbody.querySelectorAll('.prod-edit').forEach(b => b.addEventListener('click', onProdEdit));
    ptbody.querySelectorAll('.prod-del').forEach(b => b.addEventListener('click', onProdDelete));
  }

  // add product
  const addBtn = document.getElementById('add-product');
  if(addBtn) addBtn.addEventListener('click', async ()=>{
    const name = document.getElementById('new-prod-name').value.trim();
    const price = document.getElementById('new-prod-price').value.trim();
    const category = document.getElementById('new-prod-category').value.trim();
    const stock = document.getElementById('new-prod-stock').value.trim();
    const image = document.getElementById('new-prod-image').value.trim();
    const description = (document.getElementById('new-prod-description') && document.getElementById('new-prod-description').value) ? document.getElementById('new-prod-description').value.trim() : '';
    if(!name) return showToast('Nombre requerido', 'danger');
    try{
      const res = await fetch('/api/products', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ name, price: Number(price)||0, image, category, stock: parseInt(stock||0,10), description }) });
      const data = await res.json();
      if(data.ok){ showToast('Producto agregado', 'success'); initDashboard(); } else showToast(data.message || 'Error', 'danger');
    }catch(e){ showToast('Error de conexión', 'danger'); }
  });

  // image upload handler for new product
  const uploadBtn = document.getElementById('new-prod-upload');
  const fileInput = document.getElementById('new-prod-file');
  if(uploadBtn){
    uploadBtn.addEventListener('click', async ()=>{
      if(!fileInput || !fileInput.files || fileInput.files.length === 0) return showToast('Seleccione un archivo', 'info');
      const f = fileInput.files[0];
      const fd = new FormData(); fd.append('file', f);
      uploadBtn.disabled = true; const prev = uploadBtn.textContent; uploadBtn.textContent = 'Subiendo...';
      try{
        const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if(data && data.ok && data.url){
          document.getElementById('new-prod-image').value = data.url;
          fileInput.value = '';
          const prevImg = document.getElementById('new-prod-preview'); if(prevImg){ prevImg.src = data.url; prevImg.style.display = 'inline-block'; }
          showToast('Imagen subida correctamente', 'success');
        } else {
          showToast((data && data.message) ? data.message : 'Error al subir imagen', 'danger');
        }
      }catch(e){ showToast('Error de conexión al subir la imagen', 'danger'); }
      uploadBtn.disabled = false; uploadBtn.textContent = prev;
    });
  }
  // load purchases (admin view)
  try{
    const purRes = await fetchJson('/api/purchases');
    const pmsg = document.getElementById('purchases-msg');
    const ptbody = document.querySelector('#purchases-table tbody');
    if(!ptbody) {
      // nothing to do
    } else if(!purRes || !purRes.ok || !purRes.purchases || purRes.purchases.length === 0){
      if(pmsg) pmsg.textContent = 'No hay pedidos registrados.';
      ptbody.innerHTML = '';
    } else {
      pmsg.textContent = '';
      ptbody.innerHTML = '';
      purRes.purchases.forEach(p => {
        const tr = document.createElement('tr');
        const user = p.user || {};
        const buyer = escapeHtml((user.name && user.name.length) ? user.name : (user.email||'')) + '<br/>' + escapeHtml(user.email || '') + (user.phone ? ('<br/>' + escapeHtml(user.phone)) : '');
        const itemsHtml = (Array.isArray(p.items) ? p.items : []).map(it => {
          const src = it.image && it.image.length ? it.image : 'images/slider-img.png';
          const nm = escapeHtml(it.name || '');
          const qty = parseInt(it.qty||it.quantity||1,10) || 1;
          const price = Number(it.price || it.unitPrice || 0).toFixed(2);
          return `<div style="display:flex;gap:8px;align-items:center"><img src="${escapeHtml(src)}" style="height:36px"/><div style="font-size:13px">${nm} × ${qty}<br/><small>€${price}</small></div></div>`;
        }).join('');
        const statusHtml = p.delivered ? '<span style="color:green;font-weight:600">Entregado</span>' : '<span style="color:#d39e00;font-weight:600">En espera</span>';
        tr.innerHTML = `<td>${p.id}</td><td>${new Date(p.date).toLocaleString()}</td><td>${buyer}</td><td>${itemsHtml}</td><td>€${Number(p.total||0).toFixed(2)}</td><td class="purchase-status">${statusHtml}</td><td><button class="btn btn-sm btn-outline-primary purchase-view" data-id="${p.id}">Ver</button> <button class="btn btn-sm btn-secondary purchase-toggle-delivered" data-id="${p.id}">${p.delivered ? 'Marcar no entregado' : 'Marcar entregado'}</button> <button class="btn btn-sm btn-danger purchase-del" data-id="${p.id}">Borrar</button></td>`;
        ptbody.appendChild(tr);
      });
      // attach purchase action handlers
      ptbody.querySelectorAll('.purchase-view').forEach(b => b.addEventListener('click', async (ev) => {
        const id = ev.currentTarget.dataset.id;
        try{
          const res = await fetchJson('/api/purchases/' + id);
          if(!res || !res.ok || !res.purchase) return showToast('No se pudo cargar el pedido', 'danger');
          const p = res.purchase;
          const w = window.open('', '_blank', 'width=700,height=600');
          const itemsHtml = (Array.isArray(p.items) ? p.items : []).map(it => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><img src="${escapeHtml(it.image||'images/slider-img.png')}" style="height:48px"/><div><strong>${escapeHtml(it.name||'')}</strong><div>Cant: ${escapeHtml(String(it.qty||it.quantity||1))}</div><div>Precio: €${Number(it.price||it.unitPrice||0).toFixed(2)}</div></div></div>`).join('');
          const buyer = p.user ? `${escapeHtml(p.user.name||'')}<br/>${escapeHtml(p.user.email||'')}${p.user.phone ? '<br/>'+escapeHtml(p.user.phone) : ''}` : '';
          w.document.write(`<html><head><title>Pedido ${p.id}</title></head><body style="font-family:Arial,sans-serif;padding:12px"><h2>Pedido ${p.id}</h2><div><strong>Fecha:</strong> ${new Date(p.date).toLocaleString()}</div><div><strong>Comprador:</strong><br/>${buyer}</div><h3>Productos</h3>${itemsHtml}<h3>Total: €${Number(p.total||0).toFixed(2)}</h3></body></html>`);
          w.document.close();
        }catch(err){ showToast('Error al cargar pedido', 'danger'); }
      }));
      ptbody.querySelectorAll('.purchase-del').forEach(b => b.addEventListener('click', async (ev) => {
        const id = ev.currentTarget.dataset.id;
        if(!confirm('Ocultar pedido en el panel (el usuario seguirá viendo su compra). ¿Continuar?')) return;
          try{
            const res = await fetch('/api/purchases/' + id, { method: 'DELETE', credentials: 'include' });
            const data = await res.json();
            if(data && data.ok){ showToast('Pedido ocultado en el panel', 'success'); initDashboard(); } else showToast(data && data.message ? data.message : 'Error', 'danger');
          }catch(e){ showToast('Error de conexión', 'danger'); }
      }));
      // delivered toggle
      ptbody.querySelectorAll('.purchase-toggle-delivered').forEach(b => b.addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        const id = btn.dataset.id;
        const tr = btn.closest('tr');
        // total is in column index 4 like "€123.45"
        const totalCell = tr && tr.children && tr.children[4] ? tr.children[4].textContent : '0';
        const total = parseMoneyFromText(totalCell);
        const want = btn.textContent.indexOf('no entregado') === -1; // if currently says 'Marcar entregado' -> want true
        try{
          const res = await fetch('/api/purchases/' + id + '/delivered', { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ delivered: want }) });
          const data = await res.json();
          if(data && data.ok){
            showToast('Estado actualizado', 'success');
            // Update row status and button text without full reload
            const statusCell = tr.querySelector('.purchase-status');
            if(want){
              if(statusCell) statusCell.innerHTML = '<span style="color:green;font-weight:600">Entregado</span>';
              btn.textContent = 'Marcar no entregado';
              updateDeliveredStats(total, 1);
              updatePendingCount(-1);
            } else {
              if(statusCell) statusCell.innerHTML = '<span style="color:#d39e00;font-weight:600">En espera</span>';
              btn.textContent = 'Marcar entregado';
              updateDeliveredStats(-total, -1);
              updatePendingCount(1);
            }
          } else showToast(data && data.message ? data.message : 'Error', 'danger');
        }catch(e){ showToast('Error de conexión', 'danger'); }
      }));
    }
  }catch(e){ console.warn('Could not load purchases', e); }
  // tab handling: show only selected section (users/products/purchases)
  const usersSection = document.getElementById('users-section');
  const productsSection = document.getElementById('products-section');
  const purchasesSection = document.getElementById('purchases-section');
  function showTab(tab){
    if(usersSection) usersSection.style.display = (tab === 'users') ? '' : 'none';
    if(productsSection) productsSection.style.display = (tab === 'products') ? '' : 'none';
    if(purchasesSection) purchasesSection.style.display = (tab === 'purchases') ? '' : 'none';
    document.getElementById('tab-users').classList.toggle('active', tab==='users');
    document.getElementById('tab-products').classList.toggle('active', tab==='products');
    document.getElementById('tab-purchases').classList.toggle('active', tab==='purchases');
  }
  document.getElementById('tab-users').addEventListener('click', ()=> showTab('users'));
  document.getElementById('tab-products').addEventListener('click', ()=> showTab('products'));
  document.getElementById('tab-purchases').addEventListener('click', ()=> showTab('purchases'));
  // default to users
  showTab('users');
  // preview selected image for new product before upload
  if(fileInput){
    fileInput.addEventListener('change', ()=>{
      const f = fileInput.files && fileInput.files[0];
      const prevImg = document.getElementById('new-prod-preview');
      if(!prevImg) return;
      if(!f){ prevImg.style.display='none'; prevImg.src=''; return; }
      try{ prevImg.src = URL.createObjectURL(f); prevImg.style.display = 'inline-block'; }catch(e){ }
    });
  }
}

// Helper: populate an inline phone-select widget for a given edit row
async function populateInlinePhoneSelect(tr, id){
  const widget = tr.querySelector('.phone-select');
  if(!widget) return;
  const btn = widget.querySelector('.phone-select-btn');
  const listEl = widget.querySelector('.phone-select-list');
  const hidden = widget.querySelector('input[type=hidden]');
  const phoneInput = tr.querySelector('.edit-phone');
  if(!btn || !listEl || !hidden) return;

  // fetch countries.json
  let countries = [];
  try{
    const r = await fetch('/js/countries.json', {cache: 'no-cache'});
    if(r.ok) countries = await r.json();
  }catch(e){ console.warn('Could not load countries.json', e); }
  if(!Array.isArray(countries) || countries.length===0) return;
  const preferred = ['es','mx','co','ar','pe','us'];
  // build list
  listEl.innerHTML = '';
  const addItem = (c)=>{
    const li = document.createElement('li');
    li.setAttribute('data-value', c.dial);
    li.setAttribute('data-cc', c.cc);
    li.innerHTML = '<img src="https://flagcdn.com/24x18/' + c.cc + '.png" alt="' + c.name + '"> ' + c.name + ' (' + c.dial + ')';
    li.addEventListener('click', ()=>{
      hidden.value = c.dial;
      const img = btn.querySelector('img'); if(img) img.src = 'https://flagcdn.com/24x18/' + c.cc + '.png';
      const textEl = btn.querySelector('.phone-text'); if(textEl) textEl.textContent = c.name + ' (' + c.dial + ')';
      try{ listEl.style.display = 'none'; }catch(e){}
      btn.setAttribute('aria-expanded','false');
      phoneInput.focus();
    });
    listEl.appendChild(li);
  };
  preferred.forEach(code => { const f = countries.find(c=>c.cc===code); if(f) addItem(f); });
  countries.slice().sort((a,b)=> a.name.localeCompare(b.name, 'es')).forEach(c => { if(!preferred.includes(c.cc)) addItem(c); });

  // initialize display from hidden if set
  if(hidden.value){ const found = countries.find(c=>c.dial===hidden.value); if(found){ const img = btn.querySelector('img'); if(img) img.src = 'https://flagcdn.com/24x18/' + found.cc + '.png'; const textEl = btn.querySelector('.phone-text'); if(textEl) textEl.textContent = found.name + ' (' + found.dial + ')'; } }

  // toggle handlers
  let ignoreNextClick = false;
  btn.addEventListener('pointerdown', function(e){ e.preventDefault(); const show = (listEl.style.display !== 'block'); listEl.style.display = show ? 'block' : 'none'; btn.setAttribute('aria-expanded', show ? 'true' : 'false'); ignoreNextClick = true; setTimeout(()=>{ ignoreNextClick = false; }, 350); });
  btn.addEventListener('click', function(e){ if(ignoreNextClick){ ignoreNextClick = false; return;} const show = (listEl.style.display !== 'block'); listEl.style.display = show ? 'block' : 'none'; btn.setAttribute('aria-expanded', show ? 'true' : 'false'); });
  btn.addEventListener('keydown', function(e){ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); const show = (listEl.style.display !== 'block'); listEl.style.display = show ? 'block' : 'none'; btn.setAttribute('aria-expanded', show ? 'true' : 'false'); } });
  document.addEventListener('click', function(e){ if(!widget.contains(e.target)) { try{ listEl.style.display = 'none'; }catch(e){} btn.setAttribute('aria-expanded','false'); } });
}

function onEditClick(e){
  const tr = e.target.closest('tr');
  const id = tr.dataset.id;
  const name = tr.querySelector('.user-name').textContent;
  const email = tr.children[2].textContent;
  const phone = tr.children[3].textContent;
  const isAdmin = tr.children[4].textContent.trim() === 'Sí';
  tr.innerHTML = `
    <td>${id}</td>
    <td><input class="form-control form-control-sm edit-name" value="${name}"></td>
    <td><input class="form-control form-control-sm edit-email" value="${email}"></td>
    <td style="min-width:260px">
      <div style="display:flex;gap:6px;align-items:center">
        <div class="phone-select" id="pf-phone-select-${id}" style="flex:0 0 180px">
          <input type="hidden" class="edit-phone-code" id="pf-phone-code-${id}" value="+34">
          <button type="button" class="phone-select-btn" aria-haspopup="listbox" aria-expanded="false">
            <img src="https://flagcdn.com/24x18/es.png" alt="ES" loading="lazy">
            <span class="phone-text">España (+34)</span>
          </button>
          <ul class="phone-select-list" role="listbox" aria-labelledby="pf-phone-select-${id}"></ul>
        </div>
        <input class="form-control form-control-sm edit-phone" style="flex:1" value="${phone}">
      </div>
      <div class="edit-phone-error" style="color:#b00020;display:none;font-size:12px;margin-top:4px"></div>
    </td>
    <td>
      <select class="form-control form-control-sm edit-admin">
        <option value="0">No</option>
        <option value="1">Sí</option>
      </select>
    </td>
    <td>
      <input type="password" placeholder="Nueva contraseña" class="form-control form-control-sm edit-pass" style="width:55%;display:inline-block;margin-right:6px" />
      <button class="btn btn-sm btn-success save-btn">Guardar</button>
      <button class="btn btn-sm btn-secondary cancel-btn">Cancelar</button>
    </td>`;
  tr.querySelector('.edit-admin').value = isAdmin ? '1' : '0';
  // initialize phone code/select if phone has code
  try{
    const phoneCodeEl = tr.querySelector('.edit-phone-code');
    const phoneInputEl = tr.querySelector('.edit-phone');
    if(phoneInputEl && phoneInputEl.value){
      const val = phoneInputEl.value.trim();
      if(val.indexOf(' ')>0){ const parts = val.split(' '); if(phoneCodeEl) phoneCodeEl.value = parts[0]; phoneInputEl.value = parts.slice(1).join(' '); }
      else if(val.startsWith('+') && phoneCodeEl){ // try match first 3 chars
        phoneCodeEl.value = val.slice(0,3); phoneInputEl.value = val.slice(3);
      }
    }
  }catch(e){}
  tr.querySelector('.cancel-btn').addEventListener('click', initDashboard);
  // initialize inline phone-select for this row
  try{ populateInlinePhoneSelect(tr, id); }catch(e){ console.warn('phone init failed', e); }
  tr.querySelector('.save-btn').addEventListener('click', async ()=>{
    const newName = tr.querySelector('.edit-name').value.trim();
    const newEmail = tr.querySelector('.edit-email').value.trim();
    const phoneCodeEl = tr.querySelector('.edit-phone-code');
    const newPhoneLocal = tr.querySelector('.edit-phone').value.trim();
    const newPhone = (phoneCodeEl && newPhoneLocal) ? (phoneCodeEl.value + ' ' + newPhoneLocal) : newPhoneLocal;
    const phoneErrEl = tr.querySelector('.edit-phone-error');
    const newPass = tr.querySelector('.edit-pass').value;
    const newAdmin = tr.querySelector('.edit-admin').value === '1';
    if(!confirm('Confirmar guardado de cambios?')) return;
    // validate phone
    if(newPhoneLocal){
      let valid = false;
      try{ if(window.libphonenumber && typeof libphonenumber.parsePhoneNumberFromString === 'function'){ const pn = libphonenumber.parsePhoneNumberFromString((phoneCodeEl?phoneCodeEl.value:'') + newPhoneLocal.replace(/\s+/g, '')); valid = !!(pn && pn.isValid && pn.isValid()); } }catch(e){ valid = false; }
      if(!valid){ const digits = newPhoneLocal.replace(/\D/g, ''); if(digits.length < 6 || digits.length > 15){ if(phoneErrEl){ phoneErrEl.textContent = 'Teléfono inválido (6-15 dígitos)'; phoneErrEl.style.display = 'block'; } return; } }
      if(phoneErrEl){ phoneErrEl.style.display = 'none'; }
    }
    try{
      const res = await fetch('/api/users/' + id, {
        method: 'PUT',
        headers:{ 'Content-Type':'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName, email: newEmail, password: newPass, isAdmin: newAdmin, phone: newPhone })
      });
      const data = await res.json();
      if(data.ok){ showToast('Guardado', 'success'); initDashboard(); }
      else showToast(data.message || 'Error', 'danger');
    }catch(e){ showToast('Error de conexión', 'danger'); }
  });
}

// Helpers to update delivered and pending stats in the DOM incrementally
function parseMoneyFromText(text){
  if(!text) return 0;
  const m = String(text).replace(/[^0-9,\.\-]/g, '').replace(',', '.');
  const v = parseFloat(m);
  return isNaN(v) ? 0 : v;
}
function updateDeliveredStats(deltaAmount, deltaCount){
  try{
    const el = document.getElementById('stat-delivered-sales');
    const meta = document.getElementById('stat-delivered-meta');
    let currentAmt = 0, currentCount = 0;
    if(el){
      // expected format: "€123.45 — 5 pedidos" or similar
      const txt = el.textContent || '';
      const parts = txt.split('—');
      currentAmt = parts[0] ? parseMoneyFromText(parts[0]) : 0;
      if(parts[1]) currentCount = parseInt((parts[1].match(/\d+/)||['0'])[0],10) || 0;
    }
    currentAmt = Math.max(0, currentAmt + Number(deltaAmount || 0));
    currentCount = Math.max(0, currentCount + Number(deltaCount || 0));
    if(el) el.textContent = '€' + Number(currentAmt).toFixed(2) + ' — ' + currentCount + ' pedidos';
    if(meta) meta.textContent = currentCount + ' pedidos';
  }catch(e){ console.warn('updateDeliveredStats error', e); }
}
function updatePendingCount(delta){
  try{
    const pel = document.getElementById('stat-pending-count');
    if(!pel) return;
    const txt = pel.textContent || '';
    const current = parseInt((txt.match(/\d+/)||['0'])[0],10) || 0;
    const next = Math.max(0, current + Number(delta || 0));
    pel.textContent = next + ' pedidos';
  }catch(e){ console.warn('updatePendingCount error', e); }
}

// product edit handlers
function onProdEdit(e){
  const tr = e.target.closest('tr'); const id = tr.dataset.id;
  const name = tr.querySelector('.prod-name').textContent;
  const price = tr.querySelector('.prod-price').textContent;
  const cat = tr.querySelector('.prod-cat') ? tr.querySelector('.prod-cat').textContent : '';
  const stock = tr.querySelector('.prod-stock') ? tr.querySelector('.prod-stock').textContent : '0';
  const imgCell = tr.querySelector('.prod-image');
  const imgSrc = imgCell && imgCell.querySelector('img') ? imgCell.querySelector('img').src : '';
  tr.innerHTML = `
    <td>${id}</td>
    <td><input class="form-control form-control-sm edit-p-name" value="${name}"></td>
    <td><input class="form-control form-control-sm edit-p-price" value="${price}"></td>
    <td><input class="form-control form-control-sm edit-p-category" value="${cat}"></td>
    <td><input class="form-control form-control-sm edit-p-stock" value="${stock}"></td>
    <td><input class="form-control form-control-sm edit-p-image" value="${imgSrc}"></td>
    <td><button class="btn btn-sm btn-success save-p">Guardar</button> <button class="btn btn-sm btn-secondary cancel-p">Cancelar</button></td>`;
  const desc = tr.dataset.desc || '';
  tr.innerHTML = `
    <td>${id}</td>
    <td><input class="form-control form-control-sm edit-p-name" value="${name}"></td>
    <td><input class="form-control form-control-sm edit-p-price" value="${price}"></td>
    <td><input class="form-control form-control-sm edit-p-desc" value="${escapeHtml(desc)}"></td>
    <td><input class="form-control form-control-sm edit-p-category" value="${cat}"></td>
    <td><input class="form-control form-control-sm edit-p-stock" value="${stock}"></td>
    <td>
      <input class="form-control form-control-sm edit-p-image" value="${escapeHtml(imgSrc)}" />
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center">
        <input type="file" accept="image/*" class="form-control form-control-sm edit-p-file" style="width:160px;padding:6px" />
        <button class="btn btn-sm btn-secondary edit-p-upload">Subir</button>
        <img class="edit-p-preview" src="${escapeHtml(imgSrc)}" style="height:36px;margin-left:6px;${imgSrc? 'display:inline-block' : 'display:none'}" />
      </div>
    </td>
    <td><button class="btn btn-sm btn-success save-p">Guardar</button> <button class="btn btn-sm btn-secondary cancel-p">Cancelar</button></td>`;
  tr.querySelector('.cancel-p').addEventListener('click', initDashboard);
  // wire upload preview and upload handler for this row
  const fileInputEl = tr.querySelector('.edit-p-file');
  const uploadBtnEl = tr.querySelector('.edit-p-upload');
  const previewEl = tr.querySelector('.edit-p-preview');
  const imageInputEl = tr.querySelector('.edit-p-image');
  if(fileInputEl){
    fileInputEl.addEventListener('change', ()=>{
      const f = fileInputEl.files && fileInputEl.files[0];
      if(!f){ previewEl.style.display = 'none'; previewEl.src = ''; return; }
      try{
        const url = URL.createObjectURL(f);
        previewEl.src = url; previewEl.style.display = 'inline-block';
      }catch(e){ /* ignore */ }
    });
  }
  if(uploadBtnEl){
    uploadBtnEl.addEventListener('click', async ()=>{
      if(!fileInputEl || !fileInputEl.files || fileInputEl.files.length === 0) return showToast('Seleccione un archivo', 'info');
      const f = fileInputEl.files[0];
      const fd = new FormData(); fd.append('file', f);
      uploadBtnEl.disabled = true; const prev = uploadBtnEl.textContent; uploadBtnEl.textContent = 'Subiendo...';
      try{
        const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if(data && data.ok && data.url){
          imageInputEl.value = data.url;
          previewEl.src = data.url; previewEl.style.display = 'inline-block';
          fileInputEl.value = '';
          showToast('Imagen subida correctamente', 'success');
        } else {
          showToast((data && data.message) ? data.message : 'Error al subir imagen', 'danger');
        }
      }catch(e){ showToast('Error de conexión al subir la imagen', 'danger'); }
      uploadBtnEl.disabled = false; uploadBtnEl.textContent = prev;
    });
  }
  tr.querySelector('.save-p').addEventListener('click', async ()=>{
    const newName = tr.querySelector('.edit-p-name').value.trim();
    const newPrice = Number(tr.querySelector('.edit-p-price').value) || 0;
    const newCat = tr.querySelector('.edit-p-category').value.trim();
    const newStock = parseInt(tr.querySelector('.edit-p-stock').value,10) || 0;
    const newImage = tr.querySelector('.edit-p-image').value.trim();
    const newDesc = tr.querySelector('.edit-p-desc').value.trim();
    if(!confirm('Confirmar guardar producto?')) return;
    try{
      const res = await fetch('/api/products/' + id, { method: 'PUT', headers:{ 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify({ name: newName, price: newPrice, image: newImage, category: newCat, stock: newStock, description: newDesc }) });
      const data = await res.json();
      if(data.ok){ showToast('Guardado', 'success'); initDashboard(); } else showToast(data.message || 'Error', 'danger');
    }catch(e){ showToast('Error de conexión', 'danger'); }
  });
}

async function onProdDelete(e){
  const tr = e.target.closest('tr'); const id = tr.dataset.id;
  if(!confirm('Borrar producto?')) return;
  try{
    const res = await fetch('/api/products/' + id, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if(data.ok){ showToast('Eliminado', 'success'); initDashboard(); } else showToast(data.message || 'Error', 'danger');
  }catch(e){ showToast('Error de conexión', 'danger'); }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDashboard);
else initDashboard();
