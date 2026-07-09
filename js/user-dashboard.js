async function fetchJson(url, opts){
  const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
  const full = url.startsWith('http') ? url : (API_BASE + url);
  try{
    const res = await fetch(full, Object.assign({ credentials: 'include' }, opts));
    const ct = res.headers.get('content-type') || '';
    if(ct.includes('application/json')) return await res.json();
    const text = await res.text();
    return { __text: text, status: res.status };
  }catch(e){
    console.error('fetchJson error', e, full);
    throw e;
  }
}

function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"'`]/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;','`':'&#96;'}[m]; }); }

async function initUserDashboard(){
  const me = await fetchJson('/api/me');
  const msg = document.getElementById('profile-msg');
  if(!me || !me.ok || !me.user){ msg.textContent = 'Debes iniciar sesión para ver y editar tu perfil.'; return; }
  // fill profile: name is not editable, email shows as text with edit button
  const originalName = me.user.name || '';
  document.getElementById('pf-name-text').textContent = originalName;
  document.getElementById('pf-email-text').textContent = me.user.email || '';
  document.getElementById('pf-email-input').value = me.user.email || '';
  // phone
  const phoneTextEl = document.getElementById('pf-phone-text');
  const phoneInputEl = document.getElementById('pf-phone-input');
  const phoneCodeEl = document.getElementById('pf-phone-code');
  const phoneErrEl = document.getElementById('pf-phone-error');
  let phoneFull = me.user.phone || '';
  phoneTextEl.textContent = phoneFull || '';
  // try split into code + local
  if(phoneFull && phoneFull.indexOf(' ')>0){
    const parts = phoneFull.split(' ');
    phoneCodeEl.value = parts[0] || phoneCodeEl.value;
    phoneInputEl.value = parts.slice(1).join(' ');
  } else if(phoneFull && phoneFull.startsWith('+')){
    // no space, try first 3 chars as code fallback
    phoneCodeEl.value = phoneFull.slice(0,3);
    phoneInputEl.value = phoneFull.slice(3) || '';
  } else {
    phoneInputEl.value = phoneFull || '';
  }

  // save handler
  document.getElementById('save-profile').addEventListener('click', async (e)=>{
    e.preventDefault();
    const name = originalName;
    // email may be edited in the input; if input hidden, use displayed text
    const emailInput = document.getElementById('pf-email-input');
    const email = (emailInput.style.display !== 'none') ? emailInput.value.trim() : document.getElementById('pf-email-text').textContent.trim();
    const password = document.getElementById('pf-password').value;
    // phone handling and validation
    const phoneCode = phoneCodeEl ? phoneCodeEl.value : '';
    const phoneLocal = phoneInputEl ? phoneInputEl.value.trim() : '';
    const phone = phoneLocal ? (phoneCode + ' ' + phoneLocal) : '';
    // validate phone using libphonenumber-js if available
    if(phoneLocal){
      let valid = false;
      try{
        if(window.libphonenumber && typeof libphonenumber.parsePhoneNumberFromString === 'function'){
          const pn = libphonenumber.parsePhoneNumberFromString(phoneCode + phoneLocal.replace(/\s+/g, ''));
          valid = !!(pn && pn.isValid && pn.isValid());
        }
      }catch(e){ valid = false; }
      if(!valid){
        const digits = phoneLocal.replace(/\D/g, '');
        if(digits.length < 6 || digits.length > 15){
          phoneErrEl.textContent = 'Teléfono inválido. Introduce entre 6 y 15 dígitos (sin código).'; phoneErrEl.style.display = 'block'; phoneInputEl.focus(); return;
        }
      }
      phoneErrEl.style.display = 'none';
    }
    try{
      const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
      const res = await fetch(API_BASE + '/api/me', {
        method: 'PUT', headers: {'Content-Type':'application/json'}, credentials: 'include',
        body: JSON.stringify({ name, email, password, phone })
      });
      // read body once as text, then try parse
      const raw = await res.text();
      let data;
      try{ data = raw ? JSON.parse(raw) : {}; }catch(err){ throw new Error('Non-JSON response: ' + raw); }
      if(data && data.ok){ 
        showToast('Perfil actualizado', 'success'); 
        document.getElementById('pf-password').value = ''; 
        // update displayed email and hide input if visible
        const emailText = document.getElementById('pf-email-text');
        const emailInput = document.getElementById('pf-email-input');
        emailText.textContent = email;
        emailInput.style.display = 'none';
        const editBtn = document.getElementById('pf-email-edit'); if(editBtn) editBtn.textContent = 'Editar';
        // update phone display and hide edit area
        const phoneText = document.getElementById('pf-phone-text');
        const phoneEditArea = document.getElementById('pf-phone-edit-area');
        const phoneCodeEl = document.getElementById('pf-phone-code');
        const phoneInputEl = document.getElementById('pf-phone-input');
        const phoneVal = phoneInputEl && phoneInputEl.value ? (phoneCodeEl.value + ' ' + phoneInputEl.value.trim()) : '';
        if(phoneText) phoneText.textContent = phoneVal;
        if(phoneEditArea) { phoneEditArea.style.display = 'none'; const editPhoneBtn = document.getElementById('pf-phone-edit'); if(editPhoneBtn) editPhoneBtn.textContent = 'Editar'; }
      }
      else showToast((data && data.message) ? data.message : JSON.stringify(data) || 'Error', 'danger');
    }catch(e){ showToast('Error de conexión: ' + (e && e.message ? e.message : ''), 'danger'); }
  });

  // purchases
  const purchases = await fetchJson('/api/me/purchases');
  const pmsg = document.getElementById('purchases-msg');
  const list = document.getElementById('purchases-list');
  list.innerHTML = '';
  if(!purchases || !purchases.ok || !purchases.purchases || purchases.purchases.length === 0){ pmsg.textContent = 'No hay compras registradas.'; return; }
  pmsg.textContent = '';
  purchases.purchases.forEach(p => {
    const li = document.createElement('li'); li.className = 'purchase-item';
    const state = p.delivered ? 'Entregado' : 'En espera';
    li.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>${p.date || ''} - ${p.description || 'Compra'} - €${Number(p.total||0).toFixed(2)}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-sm btn-outline-primary purchase-view-user" data-id="${p.id}">Ver</button>
          <div style="font-weight:600;color:${p.delivered? 'green':'#d39e00'}">${state}</div>
        </div>
      </div>`;
    list.appendChild(li);
    // attach view handler using closure capture of `p`
    const viewBtn = li.querySelector('.purchase-view-user');
    if(viewBtn){
      viewBtn.addEventListener('click', function(){
        try{ openUserReceiptWindow(p); }catch(e){ console.error('open receipt error', e); }
      });
    }
  });

  // open a professional receipt inside the modal
  function openUserReceiptWindow(purchase){
    const items = Array.isArray(purchase.items) ? purchase.items : [];
    const companyName = 'GW Lavado Ecologico';
    const logo = '/images/logogwlavadoeco.png';
    const paidText = (purchase.paid === true) ? 'Sí' : (purchase.paid === false ? 'No' : 'No registrado');
    const deliveredText = purchase.delivered ? 'Sí' : 'No';
    const deliveredAtText = purchase.delivered_at ? new Date(purchase.delivered_at).toLocaleString() : null;
    const dateText = purchase.date ? new Date(purchase.date).toLocaleString() : new Date().toLocaleString();
    const itemsRows = items.map(it => {
      const src = it.image && it.image.length ? it.image : 'images/slider-img.png';
      const name = (it.name || '');
      const qty = parseInt(it.qty || it.quantity || 1,10) || 1;
      const unit = Number(it.price || it.unitPrice || 0).toFixed(2);
      const line = (qty * Number(unit)).toFixed(2);
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><img src="${escapeHtml(src)}" style="height:48px;border-radius:6px"/></td>
        <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${qty}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">€${unit}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">€${line}</td>
      </tr>`;
    }).join('');
    const subtotal = items.reduce((s,it)=> s + (Number(it.price || it.unitPrice || 0) * (parseInt(it.qty||it.quantity||1,10)||1)), 0);
    const total = Number(purchase.total || subtotal).toFixed(2);
    const bodyHtml = `
      <div style="display:flex;align-items:center;gap:12px">
        <img src="${logo}" style="height:56px"/>
        <div>
          <div style="font-weight:700;font-size:18px">${companyName}</div>
          <div style="color:#666">Recibo de compra</div>
        </div>
      </div>
      <div style="margin-top:10px;color:#333">
        <strong>Cliente</strong><br/>
        ${escapeHtml((me && me.user && me.user.name) ? me.user.name : '')}<br/>
        ${escapeHtml((me && me.user && me.user.email) ? me.user.email : '')}<br/>
        ${escapeHtml((me && me.user && me.user.phone) ? me.user.phone : '')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:12px">
        <div style="color:#666">Recibo #: ${purchase.id}<br/>Fecha: ${dateText}</div>
        <div style="text-align:right;color:#666">Estado de pago: ${paidText}<br/>Entregado: ${deliveredText}${deliveredAtText ? (' — ' + deliveredAtText) : ''}</div>
      </div>
      <h5 style="margin-top:14px">Productos</h5>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th style="width:72px"></th><th>Producto</th><th style="width:72px;text-align:center">Cant</th><th style="width:120px;text-align:right">Precio</th><th style="width:120px;text-align:right">Total</th></tr></thead><tbody>${itemsRows}</tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="min-width:200px;text-align:right"><div style="color:#666">Subtotal</div><div>€${Number(subtotal).toFixed(2)}</div></div></div>
      <div style="display:flex;justify-content:flex-end;margin-top:6px"><div style="min-width:200px;text-align:right"><div style="color:#666">Total</div><div style="font-weight:800;font-size:18px">€${total}</div></div></div>
      <div style="margin-top:18px;color:#666">Este recibo fue emitido por ${companyName}. Gracias por su compra.</div>
    `;
    const modalBody = document.getElementById('receiptModalBody');
    const modalTitle = document.getElementById('receiptModalLabel');
    if(modalBody) modalBody.innerHTML = bodyHtml;
    if(modalTitle) modalTitle.textContent = `Recibo #${purchase.id}`;
    // store current purchase id for download filename
    window.__current_receipt_id = purchase.id;
    // ensure any open phone-select lists are closed so they don't overlap the modal
    try{ closeAllPhoneSelects(); }catch(e){}
    // show modal using jQuery/Bootstrap
    try{ $('#receiptModal').modal('show'); }catch(e){ /* fallback: toggle class */ document.getElementById('receiptModal').classList.add('show'); }
    // ensure modal appears above any phone-select lists by adjusting z-index after it's shown
    try{
      $('#receiptModal').on('shown.bs.modal', function(){
        try{ closeAllPhoneSelects(); }catch(e){}
        try{ $('.modal-backdrop').css('z-index','99998'); }catch(e){}
        try{ $('#receiptModal').css('z-index','99999'); }catch(e){}
        // also lower phone-select z-indexes just in case
        try{ document.querySelectorAll('.phone-select-list').forEach(el=>{ el.style.zIndex = '1000'; el.style.display = 'none'; el.classList.remove('show'); }); }catch(e){}
      });
    }catch(e){}
    // wire print button
    const printBtn = document.getElementById('receiptPrintBtn');
    if(printBtn){
      printBtn.onclick = function(){
        // print modal content only by opening a new window for print
        const w = window.open('', '_blank');
        w.document.write('<html><head><title>Recibo</title><meta charset="utf-8"></head><body>' + modalBody.innerHTML + '</body></html>');
        w.document.close();
        w.focus();
        setTimeout(()=>{ w.print(); w.close(); }, 300);
      };
    }
  }

  function closeAllPhoneSelects(){
    try{
      document.querySelectorAll('.phone-select-list').forEach(listEl => {
        listEl.classList.remove('show');
        try{ listEl.style.display = 'none'; }catch(e){}
        const p = listEl.closest && listEl.closest('.phone-select');
        if(p){ const btn = p.querySelector('.phone-select-btn'); if(btn) btn.setAttribute('aria-expanded','false'); }
      });
    }catch(e){ /* ignore */ }
  }

  // Download PDF handler: load html2pdf if needed and generate PDF from modal content
  const downloadBtn = document.getElementById('receiptDownloadBtn');
  if(downloadBtn){
    downloadBtn.addEventListener('click', async function(){
      const modalBody = document.getElementById('receiptModalBody');
      if(!modalBody) return showToast('Contenido no disponible', 'danger');
      // ensure html2pdf available
      if(typeof html2pdf === 'undefined'){
        try{
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js';
            s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
          });
        }catch(e){ console.error('Could not load pdf library', e); return showToast('No se pudo cargar librería PDF', 'danger'); }
      }
      try{
        const opt = {
          margin:       8,
          filename:     `recibo-${window.__current_receipt_id || 'compra'}.pdf`,
          image:        { type: 'jpeg', quality: 0.95 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        // clone node to avoid dynamic elements interfering
        const clone = modalBody.cloneNode(true);
        // wrap in container to set white background
        const wrapper = document.createElement('div'); wrapper.style.padding = '12px'; wrapper.style.background = '#fff'; wrapper.appendChild(clone);
        html2pdf().set(opt).from(wrapper).save();
      }catch(e){ console.error('PDF generation failed', e); showToast('Error generando PDF', 'danger'); }
    });
  }
}

// toggle email edit input
document.addEventListener('click', function(e){
  if(e.target && e.target.id === 'pf-email-edit'){
    const btn = e.target;
    const input = document.getElementById('pf-email-input');
    const text = document.getElementById('pf-email-text');
    if(input.style.display === 'none' || input.style.display === ''){
      input.style.display = 'block';
      input.focus();
      btn.textContent = 'Cancelar';
    } else {
      input.style.display = 'none';
      // reset input value to displayed text
      input.value = text.textContent.trim();
      btn.textContent = 'Editar';
    }
  }
  if(e.target && e.target.id === 'pf-phone-edit'){
    const btn = e.target;
    const area = document.getElementById('pf-phone-edit-area');
    const text = document.getElementById('pf-phone-text');
    const input = document.getElementById('pf-phone-input');
    if(!area) return;
    if(area.style.display === 'none' || area.style.display === ''){
      area.style.display = 'flex';
      input.focus();
      btn.textContent = 'Cancelar';
    } else {
      area.style.display = 'none';
      // reset input value to displayed text
      input.value = text.textContent.trim();
      btn.textContent = 'Editar';
      const err = document.getElementById('pf-phone-error'); if(err) err.style.display = 'none';
    }
  }
});

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUserDashboard); else initUserDashboard();
