async function loadStoreProducts(){
  const grid = document.querySelector('.products-grid');
  if(!grid) return;
  const controls = document.getElementById('store-controls');
  if(!controls) return;
  // state
  const state = window.__storeState = window.__storeState || { page:1, perPage:12, q:'', category:'', inStock:0 };
  try{
    const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
    const params = new URLSearchParams();
    if(state.page) params.set('page', state.page);
    if(state.perPage) params.set('perPage', state.perPage);
    if(state.q) params.set('q', state.q);
    if(state.category) params.set('category', state.category);
    if(state.inStock) params.set('inStock', state.inStock ? '1' : '0');
    const res = await fetch(API_BASE + '/api/products?' + params.toString(), { credentials: 'include' });
    const ct = res.headers.get('content-type') || '';
    if(!ct.includes('application/json')) return; // keep static if any
    const data = await res.json();
    if(!data || !data.ok) return;
    const products = data.products || [];
    grid.innerHTML = '';
    products.forEach(p => {
      const col = document.createElement('div'); col.className = 'col-sm-6 col-md-4 col-lg-3';
      // normalize image URL: replace backslashes, ensure leading slash if relative
      let imgSrc = p.image ? String(p.image).replace(/\\/g, '/').trim() : '';
      if(imgSrc && !/^https?:\/\//i.test(imgSrc) && !imgSrc.startsWith('/')) imgSrc = '/' + imgSrc;
      const img = imgSrc && imgSrc.length ? imgSrc : 'images/slider-img.png';
      const priceText = '€' + (Number(p.price||0)).toFixed(2);
      const stockVal = Number(p.stock || 0);
      const addBtnHtml = stockVal > 0 ? `<button class="btn add-to-cart" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${Number(p.price||0).toFixed(2)}" data-image="${escapeHtml(img)}" data-stock="${stockVal}">Añadir al carrito</button>` : `<button class="btn btn-secondary" disabled>Agotado</button>`;
      col.innerHTML = `<div class="product-card">
          <img src="${img}" alt="${escapeHtml(p.name)}" onerror="this.src='images/slider-img.png'"/>
          <h4>${escapeHtml(p.name)}</h4>
          <p class="price">${priceText}</p>
          ${addBtnHtml}
          <button type="button" class="boton-info btn btn-outline-info" data-image="${escapeHtml(img)}" data-title="${escapeHtml(p.name)}" data-description="${escapeHtml(p.description||'')}" data-stock="${stockVal}">Información del producto</button>
        </div>`;
      grid.appendChild(col);
    });
    // If user is not authenticated, visually mark add-to-cart buttons
    async function isAuthenticated(){
      try{ if(document.getElementById('account-nav-link')) return true; }catch(e){}
      try{
        const API_BASE = (window.API_BASE || window.location.origin).replace(/\/$/, '');
        const res = await fetch(API_BASE + '/api/me', { credentials: 'include', cache: 'no-store' });
        if(res.status === 401) return false;
        const ct = res.headers.get('content-type') || '';
        if(ct.includes('application/json')){
          const data = await res.json();
          return !!(data && data.ok && data.user);
        }
        return false;
      }catch(err){ return false; }
    }
    try{
      const authed = await isAuthenticated();
      if(!authed){
        document.querySelectorAll('.product-card .add-to-cart').forEach(btn => {
          try{
            btn.classList.add('needs-auth');
            if(!btn.dataset.origText) btn.dataset.origText = btn.textContent;
            // keep original text (e.g. 'Añadir al carrito') and only style the button
            btn.title = 'Debes iniciar sesión para añadir al carrito';
          }catch(e){}
        });
      }
    }catch(e){ /* ignore auth decorating errors */ }
      // build controls: search, category select, pagination
      controls.innerHTML = '';
      const search = document.createElement('input'); search.className = 'form-control'; search.placeholder = 'Buscar...'; search.value = state.q || '';
      search.style.maxWidth = '300px';
      search.addEventListener('change', ()=>{ state.q = search.value.trim(); state.page = 1; loadStoreProducts(); });
      controls.appendChild(search);
      const catSel = document.createElement('select'); catSel.className = 'form-control'; catSel.style.maxWidth = '200px'; catSel.style.marginLeft='8px';
      const allOpt = document.createElement('option'); allOpt.value=''; allOpt.textContent='Todas las categorías'; catSel.appendChild(allOpt);
      (data.categories||[]).forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; if(state.category===c) o.selected=true; catSel.appendChild(o); });
      catSel.addEventListener('change', ()=>{ state.category = catSel.value; state.page = 1; loadStoreProducts(); });
      controls.appendChild(catSel);
      const prev = document.createElement('button'); prev.className='btn btn-sm btn-outline-secondary'; prev.textContent='Anterior'; prev.style.marginLeft='8px'; prev.disabled = state.page <=1; prev.addEventListener('click', ()=>{ if(state.page>1){ state.page--; loadStoreProducts(); }});
      controls.appendChild(prev);
      const next = document.createElement('button'); next.className='btn btn-sm btn-outline-secondary'; next.textContent='Siguiente'; next.style.marginLeft='6px'; next.addEventListener('click', ()=>{ state.page++; loadStoreProducts(); });
      controls.appendChild(next);
  }catch(err){ console.error('loadStoreProducts error', err); }
}

function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"'`]/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;','`':'&#96;'}[m]; }); }

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadStoreProducts); else loadStoreProducts();
