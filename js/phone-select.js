// Reusable phone-select widget: populates country list and manages interactions
(function(){
  // COUNTRIES will be loaded from external JSON to keep JS clean
  let COUNTRIES = null;
  const preferred = ['es','mx','co','ar','pe','us'];

  function initPhoneSelect(el){
    const btn = el.querySelector('.phone-select-btn');
    const listEl = el.querySelector('.phone-select-list');
    let hidden = el.querySelector('input[type=hidden]');
    // if hidden input is not inside the widget (some pages place it as sibling), try parent and common id patterns
    if(!hidden){
      if(el.parentElement) hidden = el.parentElement.querySelector('input[type=hidden]');
    }
    if(!hidden && el.id){
      try{
        const guessId = el.id.replace(/phone-select|select$/, 'phone-code');
        hidden = document.getElementById(guessId) || hidden;
      }catch(e){}
    }
    if(!btn || !listEl || !hidden) return;

    function addItem(c){
      const li = document.createElement('li');
      li.setAttribute('data-value', c.dial);
      li.setAttribute('data-cc', c.cc);
      li.innerHTML = '<img src="https://flagcdn.com/24x18/' + c.cc + '.png" alt="' + c.name + '"> ' + c.name + ' (' + c.dial + ')';
      li.addEventListener('click', function(){
        hidden.value = c.dial;
        const img = btn.querySelector('img'); if(img) img.src = 'https://flagcdn.com/24x18/' + c.cc + '.png';
        const textEl = btn.querySelector('.phone-text'); if(textEl) textEl.textContent = c.name + ' (' + c.dial + ')';
        listEl.classList.remove('show');
        try{ listEl.style.display = 'none'; }catch(e){}
        btn.setAttribute('aria-expanded','false');
      });
      listEl.appendChild(li);
    }

    function populateListOnce(){
      try{
        if(listEl.children.length > 0) return;
        if(!COUNTRIES || !Array.isArray(COUNTRIES) || COUNTRIES.length === 0) return;
        preferred.forEach(code => { const f = COUNTRIES.find(c=>c.cc===code); if(f) addItem(f); });
        COUNTRIES.slice().sort((a,b)=> a.name.localeCompare(b.name, 'es')).forEach(c => { if(!preferred.includes(c.cc)) addItem(c); });
      }catch(e){ console.warn('phone-select populate error', e); }
    }
    // allow external trigger when countries file loads after init
    try{ el.addEventListener('phone-select:loaded', populateListOnce); }catch(e){}
    // try populate initially (may be no-op if COUNTRIES not loaded yet)
    populateListOnce();

    try{ btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('type','button'); btn.tabIndex = 0; }catch(e){}

    function toggleList(e){
      e.stopPropagation();
      // ensure list is populated when opening (in case COUNTRIES arrived later)
      populateListOnce();
      const show = listEl.classList.toggle('show');
      // Ensure display state in case CSS specificity prevents class from showing
      try{ listEl.style.display = show ? 'block' : 'none'; }catch(e){}
      try{ listEl.style.zIndex = '9999'; }catch(e){}
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
      try{ console.debug('phone-select: toggleList show=', show, 'for', el.id || el); }catch(e){}
    }
    // Prevent double-toggle on devices that fire both pointerdown and click
    let ignoreNextClick = false;
    btn.addEventListener('pointerdown', function(e){
      e.preventDefault();
      toggleList(e);
      ignoreNextClick = true;
      setTimeout(()=>{ ignoreNextClick = false; }, 350);
    });
    btn.addEventListener('click', function(e){ if(ignoreNextClick){ ignoreNextClick = false; return; } toggleList(e); });
    // keyboard accessibility: open on Enter/Space
    btn.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleList(e); } });

    document.addEventListener('click', function(e){ if(!el.contains(e.target)) { listEl.classList.remove('show'); btn.setAttribute('aria-expanded','false'); } });

    const initialDial = hidden.value;
    if(initialDial){
      const found = COUNTRIES.find(c=> c.dial === initialDial || c.dial.replace(/-/g,'')===initialDial.replace(/-/g,''));
      if(found){ const img = btn.querySelector('img'); if(img) img.src = 'https://flagcdn.com/24x18/' + found.cc + '.png'; const textEl = btn.querySelector('.phone-text'); if(textEl) textEl.textContent = found.name + ' (' + found.dial + ')'; }
    }
  }

  function runInit(){
    if(!COUNTRIES){
      // Try several candidate paths to load countries.json to tolerate different base hrefs
      const candidates = [
        '/js/countries.json',
        window.location.origin + '/js/countries.json',
        'js/countries.json',
        './js/countries.json',
        'countries.json'
      ];
      (async function(){
        let loaded = false;
        for(const p of candidates){
          try{
            console.debug('phone-select: trying', p);
            const r = await fetch(p, {cache: 'no-cache'});
            if(!r.ok) { console.debug('phone-select: not ok', p, r.status); continue; }
            const data = await r.json();
            if(Array.isArray(data) && data.length){
              COUNTRIES = data;
              console.debug('phone-select: loaded countries from', p, 'count=', data.length);
              loaded = true;
              break;
            } else {
              console.debug('phone-select: invalid data at', p);
            }
          }catch(err){ console.debug('phone-select: fetch error for', p, err && err.message ? err.message : err); }
        }
        if(!loaded){
          console.error('phone-select: Could not load countries.json from any path.');
          window.__phone_select_debug = window.__phone_select_debug || {};
          window.__phone_select_debug.loaded = false;
        } else {
          window.__phone_select_debug = window.__phone_select_debug || {};
          window.__phone_select_debug.loaded = true;
          window.__phone_select_debug.count = COUNTRIES.length;
          // notify existing widgets that countries are available
          try{ document.querySelectorAll('.phone-select').forEach(el => el.dispatchEvent(new CustomEvent('phone-select:loaded'))); }catch(e){ /* ignore */ }
        }
        // initialize all widgets even if COUNTRIES is null (they'll remain empty)
        document.querySelectorAll('.phone-select').forEach(initPhoneSelect);
      })();
      return;
    }
    document.querySelectorAll('.phone-select').forEach(initPhoneSelect);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }
})();
