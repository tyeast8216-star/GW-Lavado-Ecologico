(function(){
const translations = {
  en: {
    nav_inicio: "Home",
    nav_nosotros: "About",
    nav_servicios: "Services",
    nav_contacto: "Contact",
    nav_tienda: "Store",
    nav_cursos: "Courses",
    nav_login: "Login",
    slider_h1_line1: "Start",
    slider_h1_line2: "A Business",
    slider_h1_line3: "With Us",
    slider_p: "Join the leading eco car wash franchise with over 30 years of experience.",
    leer_mas: "Read more",
    welcome_title: "Who are we?",
    welcome_p: "Green Wash is the leading eco car wash franchise in Spain, backed by over 30 years of experience and 1.5 million customers. Its business model stands out for a pioneering method that saves water by cleaning a car with less than 4 liters, combined with a strong social commitment that creates inclusive employment for people with disabilities.",
    service_title: "ECO VEHICLE WASH FRANCHISE",
    aviso_title: "IMPORTANT NOTICE",
    aviso_p: "Before making a decision to set up a wash center, please watch this video.",
    contact_title: "WANT TO BE A FRANCHISEE?",
    contact_p: "By filling the form you accept our data protection policy",
    clientes: "What our customers say?",
    footer_reserved: "© 2026 All rights reserved by",
    subscribe_placeholder: "Enter Your email",
    newsletter: "Newsletter",
    enviar: "Send"
  ,
    service_box1_title: "Underground\nParking",
    service_box1_p: "Eco wash centers located in public underground parkings or shopping centers.",
    service_box2_title: "Industrial\nSpace",
    service_box2_p: "Eco wash centers in industrial warehouses and commercial premises.",
    service_box3_title: "Modular\nWash",
    service_box3_p: "Eco wash centers located in surface parkings or shopping centers.",
    courses_p: "GW Eco Wash offers specialized training courses in eco car washing, designed to train franchisees in advanced sustainable cleaning techniques.",
    why_title: "Why choose us?",
    why_p: "GW Eco Wash offers franchisees a proven business model with comprehensive training, continuous support and a recognized brand with over 30 years in the market.",
    clientes_satisfechos: "SATISFIED CUSTOMERS",
    franquicia_top: "TOP ECO WASH FRANCHISE",
    clientes_label: "CUSTOMERS",
    anos_label: "YEARS OF EXPERIENCE",
    testimonial_1: "We are very happy with the Green Wash franchise. Their management software allows you to remotely monitor your business. I started with one center and now I have two.",
    testimonial_2: "Always good reviews, we use good products with a perfect finish and an optimal working method. The best quality for the customer with high retention. Always supported by the central office.",
    testimonial_3: "From the beginning the attention was very close and transparent. They negotiated with the shopping center and got me the best conditions. During training I learned everything needed and they help by phone for any doubt.",
    label_name: "Name",
    placeholder_name: "Enter your name",
    label_email: "Email",
    placeholder_email: "Enter your email",
    label_phone: "Phone number",
    placeholder_phone: "Enter your phone",
    label_service: "Select service",
    option_service: "",
    label_message: "Message",
    placeholder_message: "Your message",
    subscribe_button: "Subscribe",
    subscribe_placeholder: "Enter Your email",
    footer_reserved: "© 2026 All rights reserved by",
    footer_c1_i1: "About Us",
    footer_c1_i2: "About services",
    footer_c1_i3: "About Departments",
    footer_c1_i4: "Services",
    footer_c1_i5: "Contact Us",
    footer_c1_i6: "Loram ipusm",
    footer_c1_i7: "Loram ipusm",
    footer_c1_i8: "Loram ipusm",
    footer_c1_i9: "Loram ipusm",
    footer_c1_i10: "Loram ipusm",
    footer_c2_i1: "About Us",
    footer_c2_i2: "About services",
    footer_c2_i3: "About Departments",
    footer_c2_i4: "Services",
    footer_c2_i5: "Contact Us",
    footer_c2_i6: "Lorem ipsum dolor",
    footer_c2_i7: "sit amet, consectetur",
    footer_c2_i8: "adipiscing elit,",
    footer_c2_i9: "sed do eiusmod",
    footer_c2_i10: "tempor incididunt",
    footer_c3_i1: "About Us",
    footer_c3_i2: "About services",
    footer_c3_i3: "About Departments",
    footer_c3_i4: "Services",
    footer_c3_i5: "Contact Us",
    footer_c3_i6: "Lorem ipsum",
    footer_c3_i7: "dolor sit amet,",
    footer_c3_i8: "consectetur",
    footer_c3_i9: "adipiscing",
    footer_c3_i10: "elit, sed do eiusmod"
  },
  es: {
    nav_inicio: "Inicio",
    nav_nosotros: "Nosotros",
    nav_servicios: "Servicios",
    nav_contacto: "Contacto",
    nav_tienda: "Tienda",
    nav_cursos: "Cursos",
    nav_login: "Login",
    slider_h1_line1: "Inicia",
    slider_h1_line2: "Un Negocio",
    slider_h1_line3: "Con Nosotros",
    slider2_h1_line1: "Adquiere",
    slider2_h1_line2: "Tu Curso",
    slider2_h1_line3: "Online Con Nosotros",
    slider2_p: "Adquiere nuestros cursos online y aprende a dominar el arte del Detailing Ecológico para construir un negocio altamente lucrativo.",
    leer_mas: "Leer más",
    welcome_title: "¿Quienes somos?",
    welcome_p: "En GW Lavado Ecológico transformamos la limpieza de vehículos en un acto de responsabilidad ambiental y compromiso social. Nacemos como la extensión internacional de Green Wash, la franquicia líder en España que cuenta con más de 30 años de experiencia y la confianza de más de 1,5 millones de clientes satisfechos. Llegamos al mercado latinoamericano con un modelo innovador en formato low-cost, diseñado para emprendedores que buscan un negocio rentable, eficiente y, sobre todo, con un propósito claro.",
    service_title: "FRANQUICIA DE LAVADO ECOLOGICO DE VEHICULOS",
    aviso_title: "AVISO IMPORTANTE",
    aviso_p: "Antes de tomar una decisión para el montaje de un centro de lavado es importante visualizar este video",
    contact_title: "QUIERES SER UN FRANQUICIADO?",
    contact_p: "Al rellenar el formulario acepta nuestra política de protección de datos",
    clientes: "Qué dicen nuestros clientes?",
    footer_reserved: "© 2026 Todos los derechos reservados por",
    subscribe_placeholder: "Introduce tu email",
    newsletter: "Newsletter",
    enviar: "Enviar"
  ,
    service_box1_title: "Parking\nSubterraneo",
    service_box1_p: "Centro de lavado ecológico ubicado en parkings subterráneos públicos o centros comerciales.",
    service_box2_title: "Industrial\nLocal",
    service_box2_p: "Centro de lavado ecológico en naves industriales y locales comerciales.",
    service_box3_title: "Lavadero\nModular",
    service_box3_p: "Centro de lavado ecológico ubicado en parkings en superficie públicos o centros comerciales.",
    courses_p: "GW Lavado Ecológico ofrece cursos de formación especializados en lavado ecológico de vehículos, diseñados para capacitar a los franquiciados en técnicas avanzadas de limpieza sostenible.",
    why_title: "Por qué elegirnos?",
    why_p: "GW Lavado Ecológico ofrece a los franquiciados un negocio de éxito seguro gracias a un equipo ecológico, autónomo y sin servicio técnico, formación integral y soporte continuo.",
    clientes_satisfechos: "CLIENTES SATISFECHOS",
    franquicia_top: "FRANQUICIA LAVADO ECOLÓGICO",
    clientes_label: "CLIENTES",
    anos_label: "AÑOS DE EXPERIENCIA",
    testimonial_1: "Estamos muy contentos con la franquicia Green Wash. Su software de gestión permite controlar a distancia lo que ocurre en el negocio. Empecé con un centro y ahora tengo dos.",
    testimonial_2: "Valoración siempre buena, utilizamos buenos productos con un acabado perfecto y un método de trabajo óptimo. La mejor calidad de cara al cliente con alta fidelización.",
    testimonial_3: "Desde el principio la atención fue muy cercana y transparente. Durante el curso de formación aprendí todo lo necesario y ante cualquier duda te ayudan por teléfono.",
    label_name: "Nombre",
    placeholder_name: "Introduce tu nombre",
    label_email: "Email",
    placeholder_email: "Introduce tu email",
    label_phone: "Número de teléfono",
    placeholder_phone: "Introduce tu teléfono",
    label_service: "Seleccionar servicio",
    option_service: "",
    label_message: "Mensaje",
    placeholder_message: "Tu mensaje",
    subscribe_button: "Suscribirse",
    subscribe_placeholder: "Introduce tu email",
    footer_reserved: "© 2026 Todos los derechos reservados por",
    footer_c1_i1: "Sobre nosotros",
    footer_c1_i2: "Sobre servicios",
    footer_c1_i3: "Sobre departamentos",
    footer_c1_i4: "Servicios",
    footer_c1_i5: "Contáctanos",
    footer_c1_i6: "Loram ipusm",
    footer_c1_i7: "Loram ipusm",
    footer_c1_i8: "Loram ipusm",
    footer_c1_i9: "Loram ipusm",
    footer_c1_i10: "Loram ipusm",
    footer_c2_i1: "Sobre nosotros",
    footer_c2_i2: "Sobre servicios",
    footer_c2_i3: "Sobre departamentos",
    footer_c2_i4: "Servicios",
    footer_c2_i5: "Contáctanos",
    footer_c2_i6: "Lorem ipsum dolor",
    footer_c2_i7: "sit amet, consectetur",
    footer_c2_i8: "adipiscing elit,",
    footer_c2_i9: "sed do eiusmod",
    footer_c2_i10: "tempor incididunt",
    footer_c3_i1: "Sobre nosotros",
    footer_c3_i2: "Sobre servicios",
    footer_c3_i3: "Sobre departamentos",
    footer_c3_i4: "Servicios",
    footer_c3_i5: "Contáctanos",
    footer_c3_i6: "Lorem ipsum",
    footer_c3_i7: "dolor sit amet,",
    footer_c3_i8: "consectetur",
    footer_c3_i9: "adipiscing",
    footer_c3_i10: "elit, sed do eiusmod"
  }
};

function setText(key, text){
  document.querySelectorAll('[data-i18n="'+key+'"]').forEach(el=>{
    if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
      el.placeholder = text;
    } else {
      el.textContent = text;
    }
  });
}

function translate(lang){
  const dict = translations[lang] || translations.es;
  for(const key in dict){
    setText(key, dict[key]);
  }
  document.documentElement.lang = (lang === 'en') ? 'en' : 'es';
}

function initLangSelector(){
  let sel = document.getElementById('langSelector');
  if(!sel){
    sel = document.createElement('select');
    sel.id = 'langSelector';
    sel.className = 'lang-selector form-control-sm';
    sel.innerHTML = '<option value="es">ES</option><option value="en">EN</option>';
    // create or reuse a top-right wrapper inside header and place selector there
    const headerEl = document.querySelector('.header_section') || document.querySelector('header') || document.body;
    let wrap = document.getElementById('langSelectorWrap');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'langSelectorWrap';
      wrap.className = 'lang-selector-wrap';
      headerEl.appendChild(wrap);
    }
    wrap.appendChild(sel);
  }
  // ensure existing selector uses our class and not inline styles
  if(sel && !sel.classList.contains('lang-selector')){
    sel.classList.add('lang-selector');
    sel.classList.add('form-control-sm');
    // remove present inline width/display/margin style if any
    sel.style.width = '';
    sel.style.display = '';
    sel.style.marginLeft = '';
  }
  const saved = localStorage.getItem('site-lang') || 'es';
  sel.value = saved;
  translate(sel.value);
  sel.addEventListener('change', ()=>{
    const val = sel.value;
    localStorage.setItem('site-lang', val);
    translate(val);
  });

  // style selector: transparent, dark, compact
  const styleKey = 'site-lang-style';
  const variants = ['transparent','dark','compact'];
  function applyVariant(v){
    variants.forEach(x=> sel.classList.remove('lang-variant-'+x));
    sel.classList.add('lang-variant-'+v);
    // compact: hide select and show compact button
    const compactBtn = document.getElementById('langCompactBtn');
    if(v === 'compact'){
      sel.style.display = 'none';
      if(!compactBtn){
        createCompactToggle();
      } else {
        compactBtn.style.display = '';
      }
    } else {
      sel.style.display = '';
      if(compactBtn) compactBtn.style.display = 'none';
    }
    // dark variant adjust aria-label for accessibility
    if(v === 'dark') sel.setAttribute('data-variant','dark'); else sel.removeAttribute('data-variant');
  }

  function cycleVariant(){
    const current = localStorage.getItem(styleKey) || 'transparent';
    const idx = (variants.indexOf(current) + 1) % variants.length;
    const next = variants[idx];
    localStorage.setItem(styleKey, next);
    applyVariant(next);
  }

  function createStyleButton(container){
    if(document.getElementById('langStyleBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'langStyleBtn';
    btn.type = 'button';
    btn.className = 'lang-style-btn';
    btn.title = 'Cambiar estilo selector';
    btn.innerHTML = '\u2699';
    btn.addEventListener('click', (e)=>{ e.preventDefault(); cycleVariant(); });
    container.appendChild(btn);
  }

  function createCompactToggle(){
    if(document.getElementById('langCompactBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'langCompactBtn';
    btn.type = 'button';
    btn.className = 'lang-compact-btn';
    btn.textContent = (sel.value || 'ES').toUpperCase();
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      const menu = document.getElementById('langCompactMenu');
      if(menu){ menu.classList.toggle('open'); return; }
      const m = document.createElement('div'); m.id = 'langCompactMenu'; m.className = 'lang-compact-menu';
      ['es','en'].forEach(code=>{
        const it = document.createElement('button'); it.type='button'; it.className='lang-compact-item'; it.textContent = code.toUpperCase();
        it.addEventListener('click', ()=>{
          sel.value = code; sel.dispatchEvent(new Event('change'));
          btn.textContent = code.toUpperCase();
          m.classList.remove('open');
        });
        m.appendChild(it);
      });
      const parentForMenu = sel.parentNode || document.body;
      parentForMenu.appendChild(m);
      m.style.position = 'absolute';
      // position function uses offset values so menu sits directly below the button
      function positionMenu(){
        const left = btn.offsetLeft;
        const top = btn.offsetTop + btn.offsetHeight + 6;
        m.style.left = left + 'px';
        m.style.top = top + 'px';
        m.style.minWidth = (btn.offsetWidth) + 'px';
      }
      positionMenu();
      // reposition on resize/scroll while menu is open
      const onReposition = ()=>{ if(document.getElementById('langCompactMenu')) positionMenu(); };
      window.addEventListener('resize', onReposition);
      window.addEventListener('scroll', onReposition, true);
      // ensure clicking outside closes menu
      setTimeout(()=> document.addEventListener('click', closeCompactMenu), 10);
      // remove listeners when menu closed
      const originalClose = closeCompactMenu;
      closeCompactMenu = function(){
        const menu = document.getElementById('langCompactMenu');
        if(menu) menu.classList.remove('open');
        document.removeEventListener('click', closeCompactMenu);
        window.removeEventListener('resize', onReposition);
        window.removeEventListener('scroll', onReposition, true);
        // restore original closeCompactMenu implementation
        closeCompactMenu = originalClose;
      };
    });
    const parent = sel.parentNode || document.body;
    parent.appendChild(btn);
  }

  function closeCompactMenu(){
    const menu = document.getElementById('langCompactMenu');
    if(menu) menu.classList.remove('open');
    document.removeEventListener('click', closeCompactMenu);
  }

  // apply saved variant
  const savedStyle = localStorage.getItem(styleKey) || 'transparent';
  applyVariant(savedStyle);
}

// Removed automatic language selector injection because the selector is no longer desired.
// If translation UI is needed again, re-enable initLangSelector() manually.
window.i18nTranslate = translate;

})();
