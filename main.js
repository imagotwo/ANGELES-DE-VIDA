/* =================================================================
   ÁNGELES DE VIDA — main.js
   Librerías: GSAP 3.13 + ScrollTrigger (animaciones ligadas al scroll)
              Lenis (scroll suave por interpolación)
   ================================================================= */

gsap.registerPlugin(ScrollTrigger);

const $  = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -----------------------------------------------------------------
   0. IMÁGENES PENDIENTES
   Si un archivo de assets/img/ aún no existe, se oculta la <img> y
   queda visible el degradado de reserva del contenedor.
   ----------------------------------------------------------------- */
$$('img').forEach((img) => {
  const markMissing = () => img.classList.add('is-missing');
  if (img.complete && img.naturalWidth === 0) markMissing();
  img.addEventListener('error', markMissing);
});
$('[data-year]').textContent = new Date().getFullYear();

/* -----------------------------------------------------------------
   0b. AL RECARGAR, VOLVER ARRIBA
   Por defecto el navegador restaura la posición de scroll al recargar
   (o salta al ancla si la URL lleva #seccion). Lo desactivamos para que
   la página empiece siempre en el hero, con su loader y animación de entrada.
   - scrollRestoration = 'manual': el navegador deja de restaurar la posición.
   - Se quita el #ancla de la URL (sin recargar) para que no salte a esa sección.
   - scrollTo(0, 0) ahora y justo antes de salir de la página (refuerzo para
     navegadores que guardan la posición en 'beforeunload').
   EXCEPCIÓN: si se LLEGA desde otra página con un ancla (p. ej. desde
   "Trabaja con nosotros" → index.html#preguntas), no es una recarga: se
   guarda el ancla en pendingHash y, cuando termina la entrada de la página
   (evento 'app:ready'), se baja suavemente a esa sección.
   El ancla especial #solicitar abre el modal "Solicita tu servicio" (bloque 10).
   Va ANTES de crear Lenis, para que Lenis arranque ya en la posición 0.
   ----------------------------------------------------------------- */
const navType = performance.getEntriesByType('navigation')[0]?.type;   // 'navigate' | 'reload' | 'back_forward'
const pendingHash = location.hash && navType !== 'reload' ? location.hash : null;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
window.scrollTo(0, 0);
addEventListener('beforeunload', () => window.scrollTo(0, 0));

/* -----------------------------------------------------------------
   1. SCROLL SUAVE (Lenis) sincronizado con ScrollTrigger
   Lenis interpola la posición (lerp 0.1) y emite 'scroll'; GSAP
   conduce el bucle de Lenis desde su ticker para que todo vaya
   en el mismo fotograma.
   ----------------------------------------------------------------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
// offset: píxeles a dejar arriba (negativo = se detiene antes). Lo usan los índices de
// las páginas legales para que el header fijo no tape el título del apartado.
const scrollToTarget = (target, offset = 0) => (lenis
  ? lenis.scrollTo(target, { offset })
  : (typeof target === 'number' ? window.scrollTo({ top: target, behavior: 'smooth' }) : $(target)?.scrollIntoView({ behavior: 'smooth' })));
// Alto del header compacto (+ margen): --header-h × 0.7 + 24px
const headerOffset = () => -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) * 0.7 + 24);
// Busca la sección de un ancla "#id" por su id (sin pasar por querySelector, que falla con
// ids que empiezan por número, como "#5-definiciones"). Devuelve el elemento o null.
const byHash = (hash) => {
  if (!hash || !hash.startsWith('#') || hash.length < 2) return null;
  try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return null; }
};

// Anclas internas pasan por Lenis para mantener la suavidad
// Excepciones:
// - botones "Solicita tu servicio" ([data-open-solicitud]): abren el modal (bloque 10)
// - enlaces de WhatsApp ([data-wa-link]): empiezan con href="#" pero main.js les pone
//   la dirección de WhatsApp al enviar; no son anclas de la página.
// - enlaces pendientes ([data-pendiente], p. ej. YouTube sin canal todavía): se ven pero
//   el clic no hace nada (sin esto, href="#" saltaría arriba de la página).
$$('[data-pendiente]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
$$('a[href^="#"]:not([data-open-solicitud]):not([data-wa-link]):not([data-pendiente])').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    // Solo actúa si en el momento del clic sigue siendo un ancla "#seccion" que existe
    const destino = byHash(id);
    if (!destino) return;
    e.preventDefault();
    closeMenu();
    // En los índices de las páginas legales ([data-toc]) se deja sitio al header fijo
    scrollToTarget(id === '#inicio' ? 0 : destino, a.closest('[data-toc]') ? headerOffset() : 0);
  });
});

/* -----------------------------------------------------------------
   2. LOADER + ENTRADA DEL HERO
   La capa morada tiene un hueco de 340×480 px. La escalamos lo
   necesario para que el hueco cubra la ventana (×1.2 de margen);
   a la vez la imagen del hero pasa de scale 1.15 a 1.
   ----------------------------------------------------------------- */
const heroLines = $$('.hero .line__in');
const heroBlur  = $$('[data-blur-in]');
const tiltCard  = $('[data-tilt]');

// Solo si existen (en páginas sin hero GSAP avisaría "target not found")
if (heroLines.length) gsap.set(heroLines, { yPercent: 110 });
if (heroBlur.length) gsap.set(heroBlur, { autoAlpha: 0, y: 40, filter: 'blur(16px)' });
if (tiltCard) gsap.set(tiltCard, { autoAlpha: 0, y: 30 });

function playIntro() {
  const tl = gsap.timeline();
  tl.to('.hero__img', { scale: 1, duration: 1.5, ease: 'power2.out' }, 0)
    .to(heroLines, { yPercent: 0, duration: 1, ease: 'power3.out', stagger: 0.12 }, 0.3)
    .to(heroBlur, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power2.out' }, 0.8);
  if (tiltCard) tl.to(tiltCard, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 1);   // la tarjeta 3D es opcional
  return tl;
}

/* Fin de la entrada de la página (con o sin loader): avisa a los demás bloques
   con el evento 'app:ready' y, si se llegó con un ancla desde otra página, baja a ella. */
function pageReady() {
  document.dispatchEvent(new Event('app:ready'));
  const destino = pendingHash !== '#solicitar' ? byHash(pendingHash) : null;
  if (destino) {
    // En páginas legales se deja sitio al header fijo para que no tape el título del apartado
    setTimeout(() => scrollToTarget(destino, document.querySelector('.legal') ? headerOffset() : 0), 150);
  }
}

function runLoader() {
  const overlay = $('.loader__overlay');
  const wordmark = $('.loader__wordmark');
  const loader = $('.loader');
  // Páginas sin loader (p. ej. "Trabaja con nosotros"): no hay animación de entrada
  if (!loader) { pageReady(); return; }
  document.body.classList.add('is-loading');
  lenis?.stop();

  const scale = Math.max(innerWidth / 340, innerHeight / 480) * 1.2;
  const finish = () => {
    loader.remove();
    document.body.classList.remove('is-loading');
    lenis?.start();
    ScrollTrigger.refresh();
    pageReady();
  };

  if (reduceMotion) { finish(); playIntro().progress(1); return; }

  gsap.timeline({ delay: 0.4, onComplete: finish })
    .to(overlay, { scale, duration: 0.9, ease: 'power2.inOut' })
    .to(wordmark, { y: -260, autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, 0)
    .to(overlay, { autoAlpha: 0, duration: 0.3 }, '-=0.1')
    .add(playIntro(), '-=0.6');
}
runLoader();

/* Al hacer scroll, el contenido del hero se aleja (opacidad + desplazamiento),
   mientras la sección siguiente lo tapa como una cortina.
   Ojo: el hero es fixed, así que el espaciador empieza en top:0 → 'top top'. */
if ($('[data-hero]')) {   // solo en páginas con hero (index.html)
gsap.to('[data-hero-content]', {
  opacity: 0.1, y: 150, ease: 'none',
  scrollTrigger: { trigger: '.hero-spacer', start: 'top top', end: 'bottom top', scrub: 1 },
});
/* La imagen del hero baja lentamente mientras la cortina sube (scrub ligado al scroll).
   El recorrido máximo es el 7% del alto de la ventana (≈63px a 900px de alto): menor que
   el header compacto (99px escritorio / 67px móvil), así el hueco que deja arriba queda
   siempre oculto tras el header blanco, y los ojos de la enfermera no se meten bajo él.
   Si se sube --header-h o se baja --hs en CSS, revisar que 7% siga siendo menor. */
gsap.to('.hero__bg', {
  y: () => Math.round(innerHeight * 0.07), ease: 'none',
  scrollTrigger: { trigger: '.hero-spacer', start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
});

// Cuando la cortina ya cubre todo, ocultamos el hero fijo (ahorra pintado)
ScrollTrigger.create({
  trigger: '.hero-spacer', start: 'bottom top',
  onEnter: () => gsap.set('[data-hero]', { visibility: 'hidden' }),
  onLeaveBack: () => gsap.set('[data-hero]', { visibility: 'visible' }),
});
}

/* -----------------------------------------------------------------
   3. CABECERA: siempre fija. En cuanto hay scroll pasa a su estado
   compacto (−30%, fondo blanco, texto ciruela); al volver al tope
   recupera su estado inicial transparente. Todo el cambio visual
   está en CSS (.header.is-scrolled); aquí solo se alterna la clase.
   ----------------------------------------------------------------- */
const header = $('[data-header]');
const heroSection = $('[data-hero]');
// data-header-solid: páginas SIN foto de fondo arriba → el header se ve siempre en su versión blanca
const solidHeader = header.hasAttribute('data-header-solid');
const SCROLL_THRESHOLD = 10; // px de margen para no parpadear en el tope
function onScroll(y) {
  header.classList.toggle('is-scrolled', solidHeader || y > SCROLL_THRESHOLD);
  heroSection?.classList.toggle('is-scrolled', y > SCROLL_THRESHOLD); // atenúa la imagen del hero
  $('[data-to-top]').classList.toggle('is-visible', y > innerHeight * 1.5);
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else addEventListener('scroll', () => onScroll(scrollY), { passive: true });
onScroll(lenis ? lenis.scroll : scrollY); // estado correcto si se recarga a mitad de página

$('[data-to-top]').addEventListener('click', () => scrollToTarget(0));

/* -----------------------------------------------------------------
   4. MENÚ (abrir/cerrar, bloquear scroll, tecla Escape)
   ----------------------------------------------------------------- */
const menu = $('#menu');
const menuBtn = $('[data-menu-open]');
function openMenu() {
  menu.classList.add('is-open');
  menu.setAttribute('aria-hidden', 'false');
  menuBtn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
  lenis?.stop();
}
function closeMenu() {
  if (!menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  menuBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  lenis?.start();
}
menuBtn.addEventListener('click', openMenu);
$$('[data-menu-close]').forEach((el) => el.addEventListener('click', closeMenu));
addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

/* -----------------------------------------------------------------
   5. TARJETA 3D DEL HERO
   Calcula la posición del ratón en % dentro de la tarjeta y la
   convierte en variables CSS: brillo (--mouse-*) e inclinación
   (--tilt-*: ±10° como máximo, factor 0.2 por punto porcentual).
   ----------------------------------------------------------------- */
if (tiltCard && !reduceMotion) {
  tiltCard.addEventListener('mousemove', (e) => {
    const r = tiltCard.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    tiltCard.style.setProperty('--mouse-x', `${x}%`);
    tiltCard.style.setProperty('--mouse-y', `${y}%`);
    tiltCard.style.setProperty('--tilt-x', `${(y - 50) * 0.2}deg`);
    tiltCard.style.setProperty('--tilt-y', `${(x - 50) * -0.2}deg`);
  });
  tiltCard.addEventListener('mouseleave', () => {
    ['--tilt-x', '--tilt-y'].forEach((p) => tiltCard.style.setProperty(p, '0deg'));
  });
}

/* -----------------------------------------------------------------
   6. ANIMACIONES DE SCROLL GENÉRICAS
   ----------------------------------------------------------------- */
if (!reduceMotion) {
  // 6a. Aparición: sube 40px y se desenfoca → nítido, una sola vez
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 40, autoAlpha: 0, filter: 'blur(8px)', duration: 1, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  // 6b. Máscaras: la variable --mask va de 0% a 100% (ver CSS [data-mask])
  $$('[data-mask]').forEach((el) => {
    gsap.fromTo(el, { '--mask': '0%' }, {
      '--mask': '100%', duration: 1.2, ease: 'power2.inOut',
      scrollTrigger: { trigger: el, start: 'top 80%', once: true },
    });
  });

  // 6c. Parallax: la imagen se desplaza en yPercent dentro de su marco.
  //     Solo se aplica si la imagen es MÁS ALTA que su marco: si mide lo mismo
  //     (p. ej. .mask-img img { height: 100% }), moverla dejaría un hueco vacío
  //     abajo, así que se queda quieta y se ve completa.
  $$('[data-parallax]').forEach((img) => {
    if (img.offsetHeight <= img.parentElement.offsetHeight + 1) return;
    gsap.fromTo(img, { yPercent: 0 }, {
      yPercent: parseFloat(img.dataset.parallax), ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // 6d. Tarjetas de servicios en cascada
  if ($('[data-cards]')) gsap.from('[data-cards] .focus-card', {
    y: 60, autoAlpha: 0, duration: 0.8, stagger: 0.2, ease: 'power2.out',
    scrollTrigger: { trigger: '[data-cards]', start: 'top 80%', once: true },
  });
} else {
  $$('[data-mask]').forEach((el) => el.style.setProperty('--mask', '100%'));
}

/* -----------------------------------------------------------------
   7. PROCESO
   - La línea se llena (scaleY) con el avance del scroll por los pasos.
   - Cada paso se activa al cruzar el 55% de la ventana; el número
     grande desplaza su columna de dígitos al índice activo.
   ----------------------------------------------------------------- */
const steps = $$('[data-step]');
const digits = $('[data-digits]');

if ($('[data-line-fill]')) gsap.to('[data-line-fill]', {
  scaleY: 1, ease: 'none',
  scrollTrigger: { trigger: '.process__steps', start: 'top 55%', end: 'bottom 55%', scrub: true },
});

function setStep(i) {
  steps.forEach((s, n) => s.classList.toggle('is-active', n <= i));
  digits.style.transform = `translateY(${-100 * i / steps.length}%)`;
}
if (digits && steps.length) steps.forEach((step, i) => {
  ScrollTrigger.create({
    trigger: step, start: 'top 55%',
    onEnter: () => setStep(i),
    onLeaveBack: () => setStep(Math.max(0, i - 1)),
  });
});
if (digits && steps.length) setStep(0);

/* -----------------------------------------------------------------
   8. PESTAÑAS AUTOMÁTICAS ("Nuestro cuidado es…")
   Un bucle con requestAnimationFrame rellena la barra de la pestaña
   activa en DURATION ms; al llegar al 100% pasa a la siguiente.
   Solo corre mientras la sección está visible (IntersectionObserver).
   ----------------------------------------------------------------- */
(function careTabs() {
  const root = $('[data-care]');
  if (!root) return;
  const tabs = $$('.care__tab', root);
  const imgs = $$('.care__img', root);
  const DURATION = 5000;
  let active = 0, start = 0, raf = null;

  function select(i) {
    active = i;
    start = performance.now();
    tabs.forEach((t, n) => {
      t.classList.toggle('is-active', n === i);
      t.setAttribute('aria-selected', n === i);
      t.querySelector('.care__bar i').style.setProperty('--progress', '0%');
    });
    imgs.forEach((im, n) => im.classList.toggle('is-active', n === i));
  }
  function tick(now) {
    const p = Math.min(1, (now - start) / DURATION);
    tabs[active].querySelector('.care__bar i').style.setProperty('--progress', `${p * 100}%`);
    if (p >= 1) select((active + 1) % tabs.length);
    raf = requestAnimationFrame(tick);
  }
  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !raf) { start = performance.now(); raf = requestAnimationFrame(tick); }
    else if (!entry.isIntersecting && raf) { cancelAnimationFrame(raf); raf = null; }
  }, { threshold: 0.3 }).observe(root);

  select(0);
})();

/* -----------------------------------------------------------------
   9. PREGUNTAS FRECUENTES (acordeón)
   - Clic en una pregunta: la abre y cierra la que estuviera abierta
     (solo una a la vez); clic en la abierta: la cierra.
   - La animación de alto y el giro "+ → ×" están en CSS (.faq-item.is-open).
   - aria-expanded informa a los lectores de pantalla del estado.
   - Se quita el atributo hidden (solo sirve si el JS no carga) porque
     impediría animar; desde aquí lo oculta el CSS con visibility.
   - Al terminar de abrir/cerrar, la página cambia de alto: se avisa a
     ScrollTrigger para que recalcule las animaciones de más abajo.
   ----------------------------------------------------------------- */
(function faqAccordion() {
  const root = $('[data-faq]');
  if (!root) return;
  const items = $$('.faq-item', root);

  function setOpen(item, open) {
    item.classList.toggle('is-open', open);
    $('.faq-item__q', item).setAttribute('aria-expanded', String(open));
  }

  items.forEach((item) => {
    $('.faq-item__a', item).removeAttribute('hidden');
    $('.faq-item__q', item).addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      items.forEach((other) => other !== item && setOpen(other, false));
      setOpen(item, willOpen);
      setTimeout(() => ScrollTrigger.refresh(), 400); // tras la transición (.35s)
    });
  });
})();

/* -----------------------------------------------------------------
   UTILIDADES DE FORMULARIOS (compartidas por el bloque 10 y el 11)
   - fieldError(el): mensaje de error en español para las reglas comunes
     (obligatorio, correo, teléfono, casilla, archivo PDF y tamaño). '' = sin error.
   - showFieldError / clearFieldError: pintan o quitan el error bajo el campo
     (.form__field o .form__check), con aria-invalid y aria-describedby para
     que los lectores de pantalla lo anuncien.
   - liveValidation(form, validate): valida al salir de cada campo y, mientras
     se corrige uno con error, lo quita en cuanto queda bien.
   ----------------------------------------------------------------- */
function fieldError(el) {
  if (el.disabled) return '';
  if (el.type === 'file') {
    const file = el.files[0];
    if (el.required && !file) return 'Adjunta tu hoja de vida en PDF.';
    if (!file) return '';
    const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    // data-no-pdf lo pone el bloque 11 si el contenido no empieza por "%PDF-" (archivo renombrado)
    if (!esPdf || el.dataset.noPdf === '1') return 'El archivo debe ser un PDF.';
    const maxMb = Number(el.dataset.maxMb || 10);
    if (file.size > maxMb * 1024 * 1024)
      return `El archivo pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es ${maxMb} MB.`;
    return '';
  }
  const v = el.type === 'checkbox' ? el.checked : el.value.trim();
  if (el.required && !v) {
    if (el.type === 'checkbox') return 'Debes autorizar el tratamiento de datos para continuar.';
    if (el.tagName === 'SELECT') return 'Selecciona una opción.';
    return 'Este campo es obligatorio.';
  }
  if (el.type === 'email' && !el.validity.valid) return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  if (el.type === 'tel' && (el.value.replace(/\D/g, '').length < 7 || !el.validity.valid))
    return 'Escribe un teléfono válido (al menos 7 números).';
  return '';
}
const fieldBox = (el) => el.closest('.form__field, .form__check');
function showFieldError(el, msg) {
  const box = fieldBox(el);
  let p = box.querySelector('.form__error');
  if (!p) {
    p = document.createElement('p');
    p.className = 'form__error';
    p.id = `${el.id}-error`;
    box.appendChild(p);
  }
  p.textContent = msg;
  box.classList.add('is-invalid');
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', p.id);
}
function clearFieldError(el) {
  const box = fieldBox(el);
  box?.querySelector('.form__error')?.remove();
  box?.classList.remove('is-invalid');
  el.removeAttribute('aria-invalid');
  el.removeAttribute('aria-describedby');
}
// Campos que se validan y envían (excluye el campo trampa antispam "web")
const formFields = (form) => $$('input, select, textarea', form).filter((el) => el.name && el.name !== 'web');
function liveValidation(form, validate) {
  // Cuando ya no queda ningún campo con error, se borra el aviso "Revisa los N campos…"
  const status = $('.form__status', form);
  const limpiarAviso = () => {
    if (status && status.textContent.startsWith('Revisa') && !$('.is-invalid', form)) {
      status.textContent = '';
      status.className = 'form__status';
    }
  };
  form.addEventListener('input', () => setTimeout(limpiarAviso));
  form.addEventListener('change', () => setTimeout(limpiarAviso));
  form.addEventListener('focusout', () => setTimeout(limpiarAviso));

  formFields(form).forEach((el) => {
    el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') validate(el); });
    // Los campos de archivo los valida su propio bloque al elegir (lectura asíncrona del archivo)
    if (el.type === 'file') return;
    const evento = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evento, () => { if (el.getAttribute('aria-invalid')) validate(el); });
  });
}

/* -----------------------------------------------------------------
   10. MODAL "SOLICITA TU SERVICIO" + VALIDACIÓN DEL FORMULARIO
   a) Abrir: botones con [data-open-solicitud]. Se pausa el scroll de la
      página y el foco va al primer campo.
   b) Cerrar: botón ×, tecla Esc o clic fuera de la ventana. Se reproduce
      la animación de salida (.is-closing) y el foco vuelve al botón que
      lo abrió. Los datos escritos se conservan por si se cerró sin querer.
   c) Campos condicionales: según "Casa"/"Hospital" se muestran Dirección
      y Nombre del hospital (data-si-lugar). Ocultos = desactivados: no se
      validan ni se envían.
   d) Rango de fechas: inicio y finalización, ninguna anterior a hoy; la final
      se iguala al inicio si queda vacía o antes (servicio de 1 día).
   e) Validación propia en español: al salir de cada campo, mientras se
      corrige un campo con error, y al enviar (lleva al primer error).
   f) Envío: manda los datos a enviar.php (correo a Gmail) sin recargar.
      · Éxito → el formulario se sustituye por la confirmación, con botón
        para enviar también la solicitud por WhatsApp (mensaje ya redactado).
      · Error o sin servidor → aviso + enlace de WhatsApp como alternativa.
      Al cerrar tras un envío correcto, el formulario se vacía.
   ----------------------------------------------------------------- */
(function solicitudModal() {
  const modal = $('#solicitud');
  const form = $('#form-solicitud');
  if (!modal || !form) return;
  const status = $('.form__status', form);
  let lastTrigger = null;

  // ---------- a) Abrir ----------
  function openModal(trigger) {
    lastTrigger = trigger || null;
    closeMenu();                                   // por si se abre desde el menú
    modal.showModal();
    document.body.classList.add('modal-open');
    lenis?.stop();
    $('.modal__box', modal).scrollTop = 0;
    setTimeout(() => $('#f-nombre').focus({ preventScroll: true }), 60);
  }
  $$('[data-open-solicitud]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.preventDefault(); openModal(btn); });
  });
  // Llegada desde otra página con index.html#solicitar (p. ej. el botón del header en
  // "Trabaja con nosotros"): se abre el modal cuando termina la entrada de la página.
  document.addEventListener('app:ready', () => { if (pendingHash === '#solicitar') openModal(); });

  // ---------- b) Cerrar ----------
  function closeModal() {
    if (!modal.open || modal.classList.contains('is-closing')) return;
    const finish = () => {
      modal.classList.remove('is-closing');
      modal.close();
      document.body.classList.remove('modal-open');
      lenis?.start();
      lastTrigger?.focus({ preventScroll: true });
      if (enviado) resetForm();                    // tras un envío correcto, la próxima vez empieza vacío
    };
    if (reduceMotion) return finish();
    modal.classList.add('is-closing');
    setTimeout(finish, 300);                       // duración de la animación modal-out
  }
  $$('[data-modal-close]', modal).forEach((b) => b.addEventListener('click', closeModal));
  // Esc: el navegador lanza 'cancel'; lo interceptamos para animar el cierre
  modal.addEventListener('cancel', (e) => { e.preventDefault(); closeModal(); });
  // Clic fuera de la ventana: el clic llega al propio <dialog> (su fondo), no a la caja
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // ---------- c) Campos condicionales según el lugar ----------
  const lugar = $('[data-lugar]', form);
  function updateLugar() {
    $$('[data-si-lugar]', form).forEach((wrap) => {
      const show = wrap.dataset.siLugar.split(' ').includes(lugar.value);
      wrap.hidden = !show;
      $$('input, select, textarea', wrap).forEach((el) => {
        el.disabled = !show;
        if (!show) clearError(el);
      });
    });
  }
  lugar.addEventListener('change', updateLugar);

  // ---------- d) Rango de fechas (inicio → finalización) ----------
  // - Ninguna puede ser anterior a hoy (fecha local, formato AAAA-MM-DD).
  // - Al elegir el inicio, si la final está vacía o queda antes, se iguala al inicio
  //   (servicio de 1 día); su mínimo pasa a ser el inicio.
  // - Debajo se muestra un resumen: "Servicio de 1 día" / "Servicio de N días (del … al …)".
  const fechaIni = $('[data-fecha-inicio]', form);
  const fechaFin = $('[data-fecha-fin]', form);
  const resumen = $('[data-fecha-resumen]', form);
  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  fechaIni.min = hoyISO;
  fechaFin.min = hoyISO;
  // AAAA-MM-DD → DD/MM/AAAA
  const fechaLegible = (v) => v.split('-').reverse().join('/');
  // Días entre dos fechas, ambas incluidas (cálculo en UTC para evitar saltos de horario)
  const diasServicio = (a, b) => Math.round((Date.parse(b + 'T00:00Z') - Date.parse(a + 'T00:00Z')) / 86400000) + 1;
  function textoFechas() {
    const a = fechaIni.value, b = fechaFin.value;
    if (!a || !b || b < a) return '';
    const n = diasServicio(a, b);
    return n === 1 ? `${fechaLegible(a)} (1 día)` : `del ${fechaLegible(a)} al ${fechaLegible(b)} (${n} días)`;
  }
  function updateFechas() {
    fechaFin.min = fechaIni.value || hoyISO;
    if (fechaIni.value && (!fechaFin.value || fechaFin.value < fechaIni.value)) {
      fechaFin.value = fechaIni.value;
      if (fechaFin.getAttribute('aria-invalid')) validate(fechaFin);
    }
    const t = textoFechas();
    resumen.textContent = t ? `Servicio ${t}.` : '';
  }
  fechaIni.addEventListener('change', updateFechas);
  fechaFin.addEventListener('change', updateFechas);

  // ---------- e) Validación ----------
  // Reglas propias de este formulario (fechas y edad) + reglas comunes (fieldError)
  function errorMessage(el) {
    if (el.disabled) return '';
    if (el.type === 'date' && el.value && el.value < el.min)
      return el === fechaFin && fechaIni.value ? 'La fecha de finalización no puede ser anterior a la de inicio.' : 'La fecha no puede ser anterior a hoy.';
    if (el.type === 'number' && el.value && !el.validity.valid)
      return `Escribe una edad entre ${el.min} y ${el.max}.`;
    return fieldError(el);
  }
  const clearError = clearFieldError;
  function validate(el) {
    const msg = errorMessage(el);
    msg ? showFieldError(el, msg) : clearFieldError(el);
    return !msg;
  }
  const fields = () => formFields(form);
  liveValidation(form, validate);

  // ---------- f) Envío: correo (enviar.php) + WhatsApp ----------
  const submitBtn = $('.form__submit', form);
  const submitText = $('.cta-btn__text', submitBtn);
  const done = $('[data-form-done]', modal);
  const waAlt = $('.form__wa-alt', form);
  let enviado = false;

  // Texto visible de un <select> (p. ej. "Hospital" en vez de "hospital")
  const opcion = (id) => { const s = $(id); return s.options[s.selectedIndex]?.text || ''; };

  // Mensaje de WhatsApp con todos los datos, ya redactado
  function whatsappUrl() {
    const v = (id) => $(id).value.trim();
    const lineas = [
      '¡Hola, Ángeles de Vida! Quiero solicitar un servicio:',
      '',
      `*Solicitante:* ${v('#f-nombre')}`,
      `*Teléfono:* ${v('#f-telefono')}`,
      `*Correo:* ${v('#f-correo')}`,
      '',
      `*Servicio:* ${opcion('#f-servicio')}`,
      `*Modalidad:* ${opcion('#f-modalidad')}`,
      `*Fechas:* ${textoFechas()}`,
      `*Lugar:* ${opcion('#f-lugar')}`,
      `*Dirección:* ${v('#f-direccion')}`,
      ...($('#f-lugar').value === 'hospital' ? [`*Hospital / clínica:* ${v('#f-hospital')}`] : []),
      '',
      `*Paciente:* ${v('#f-paciente')}, ${v('#f-edad')} años`,
      `*Diagnóstico(s):* ${v('#f-diagnostico')}`,
      `*Condición:* ${v('#f-condicion')}`,
    ];
    return `https://wa.me/${form.dataset.whatsapp}?text=${encodeURIComponent(lineas.join('\n'))}`;
  }

  function setStatus(msg, tipo = '') {
    status.className = 'form__status' + (tipo ? ` is-${tipo}` : '');
    status.textContent = msg;
  }

  function resetForm() {
    form.reset();
    fields().forEach(clearError);
    updateLugar();                                // vuelve a ocultar dirección / hospital
    updateFechas();                               // mínimo de la fecha final y resumen en blanco
    setStatus('');
    waAlt.hidden = true;
    done.hidden = true;
    form.hidden = false;
    $('.modal__header', modal).hidden = false;
    enviado = false;
  }

  // Al pulsar "Enviar por WhatsApp" (en la confirmación o el enlace alternativo si falló el correo):
  // el enlace solo abre WhatsApp con el mensaje redactado; el modal sigue abierto y con los datos.
  // Se marca la solicitud como enviada para que, CUANDO LA PERSONA CIERRE el modal, el formulario
  // se vacíe (closeModal → resetForm). La página no puede saber si se pulsa "Enviar" dentro de
  // WhatsApp (es otra aplicación): se toma el clic en el botón como "solicitud enviada".
  $$('[data-wa-link]', modal).forEach((a) => {
    a.addEventListener('click', () => { enviado = true; });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalid = fields().filter((el) => !validate(el));
    if (invalid.length) {
      setStatus(`Revisa ${invalid.length === 1 ? 'el campo marcado' : `los ${invalid.length} campos marcados`} en rojo.`, 'error');
      invalid[0].focus();                               // lleva al primer error (y hace scroll hasta él)
      return;
    }

    // El enlace de WhatsApp se prepara ya: sirve tanto si el correo sale bien como si falla
    const wa = whatsappUrl();
    $$('[data-wa-link]', modal).forEach((a) => { a.href = wa; });

    submitBtn.disabled = true;
    submitText.textContent = 'Enviando…';
    setStatus('Enviando tu solicitud…');
    waAlt.hidden = true;

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),                   // incluye el campo trampa "web" (antispam)
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // Éxito: se sustituye el formulario por la confirmación
      enviado = true;
      form.hidden = true;
      $('.modal__header', modal).hidden = true;
      done.hidden = false;
      $('.modal__box', modal).scrollTop = 0;
      done.focus();
    } catch (err) {
      // Sin servidor (p. ej. abriendo el archivo en el PC), sin conexión o error al enviar:
      // se avisa y se ofrece WhatsApp para que la solicitud no se pierda.
      console.warn('Envío del formulario:', err.message);
      setStatus('No pudimos enviar la solicitud por correo. Inténtalo de nuevo o envíanosla por WhatsApp.', 'error');
      waAlt.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitText.textContent = 'Enviar solicitud';
    }
  });
})();

/* -----------------------------------------------------------------
   11. FORMULARIO "TRABAJA CON NOSOTROS" (página trabaja-con-nosotros.html)
   a) Validación con las utilidades comunes (obligatorios, correo, teléfono,
      documento, PDF y tamaño máximo = data-max-mb del campo de archivo).
   b) Al elegir el PDF se muestra su nombre y peso (o el error si no vale).
   c) Envío a aplicar.php con XMLHttpRequest (permite mostrar el % de subida
      del PDF). Éxito → confirmación en lugar del formulario. Error → aviso.
   ----------------------------------------------------------------- */
(function aplicarForm() {
  const form = $('#form-aplicar');
  if (!form) return;
  const status = $('.form__status', form);
  const file = $('#a-hoja', form);
  const fileName = $('[data-file-name]', form);
  const submitBtn = $('.form__submit', form);
  const submitText = $('.cta-btn__text', submitBtn);
  const done = $('[data-aplicar-done]');

  // ---------- a) Validación ----------
  function errorMessage(el) {
    if (el.name === 'documento' && el.value.trim() && el.value.replace(/[^0-9a-z]/gi, '').length < 5)
      return 'Escribe un número de documento válido.';
    return fieldError(el);
  }
  function validate(el) {
    const msg = errorMessage(el);
    msg ? showFieldError(el, msg) : clearFieldError(el);
    return !msg;
  }
  liveValidation(form, validate);

  // ---------- b) Nombre y peso del PDF elegido + comprobación de que es un PDF real ----------
  // El navegador solo mira la extensión; aquí se leen los 5 primeros bytes del archivo:
  // todo PDF real empieza por "%PDF-". Si no, se marca (data-no-pdf) y se muestra el error ya.
  // (El servidor lo vuelve a comprobar en aplicar.php.)
  file.addEventListener('change', async () => {
    const f = file.files[0];
    fileName.textContent = f ? `${f.name} · ${(f.size / 1048576).toFixed(1)} MB` : 'Ningún archivo seleccionado';
    fileName.classList.toggle('has-file', !!f);
    file.dataset.noPdf = '';
    if (f) {
      const inicio = await f.slice(0, 5).text().catch(() => '');
      file.dataset.noPdf = inicio === '%PDF-' ? '' : '1';
    }
    validate(file);
  });

  function setStatus(msg, tipo = '') {
    status.className = 'form__status' + (tipo ? ` is-${tipo}` : '');
    status.textContent = msg;
  }

  // ---------- c) Envío con % de subida ----------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = formFields(form).filter((el) => !validate(el));
    if (invalid.length) {
      setStatus(`Revisa ${invalid.length === 1 ? 'el campo marcado' : `los ${invalid.length} campos marcados`} en rojo.`, 'error');
      invalid[0].focus();
      return;
    }
    submitBtn.disabled = true;
    submitText.textContent = 'Enviando…';
    setStatus('Subiendo tu hoja de vida… 0%');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', form.action);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) setStatus(`Subiendo tu hoja de vida… ${Math.round((ev.loaded / ev.total) * 100)}%`);
    });
    const fallo = (msg) => {
      setStatus(msg || 'No pudimos enviar tu postulación. Revisa tu conexión e inténtalo de nuevo.', 'error');
      submitBtn.disabled = false;
      submitText.textContent = 'Enviar postulación';
    };
    xhr.addEventListener('load', () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* respuesta no JSON = error del servidor */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        form.hidden = true;                       // la cabecera con foto e introducción se mantiene
        done.hidden = false;
        done.focus();
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        fallo(data.error);
      }
    });
    xhr.addEventListener('error', () => fallo());
    xhr.send(new FormData(form));                 // incluye el PDF y el campo trampa "web"
  });
})();

/* Recalcular posiciones cuando terminan de cargar fuentes e imágenes */
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
