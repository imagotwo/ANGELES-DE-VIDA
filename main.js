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
const scrollToTarget = (target) => (lenis ? lenis.scrollTo(target, { offset: 0 }) : $(target)?.scrollIntoView({ behavior: 'smooth' }));

// Anclas internas pasan por Lenis para mantener la suavidad
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 || !$(id)) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(id === '#inicio' ? 0 : id);
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

gsap.set(heroLines, { yPercent: 110 });
gsap.set(heroBlur, { autoAlpha: 0, y: 40, filter: 'blur(16px)' });
gsap.set(tiltCard, { autoAlpha: 0, y: 30 });

function playIntro() {
  const tl = gsap.timeline();
  tl.to('.hero__img', { scale: 1, duration: 1.5, ease: 'power2.out' }, 0)
    .to(heroLines, { yPercent: 0, duration: 1, ease: 'power3.out', stagger: 0.12 }, 0.3)
    .to(heroBlur, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power2.out' }, 0.8)
    .to(tiltCard, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 1);
  return tl;
}

function runLoader() {
  const overlay = $('.loader__overlay');
  const wordmark = $('.loader__wordmark');
  const loader = $('.loader');
  document.body.classList.add('is-loading');
  lenis?.stop();

  const scale = Math.max(innerWidth / 340, innerHeight / 480) * 1.2;
  const finish = () => {
    loader.remove();
    document.body.classList.remove('is-loading');
    lenis?.start();
    ScrollTrigger.refresh();
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

/* -----------------------------------------------------------------
   3. CABECERA: siempre fija. En cuanto hay scroll pasa a su estado
   compacto (−30%, fondo blanco, texto ciruela); al volver al tope
   recupera su estado inicial transparente. Todo el cambio visual
   está en CSS (.header.is-scrolled); aquí solo se alterna la clase.
   ----------------------------------------------------------------- */
const header = $('[data-header]');
const heroSection = $('[data-hero]');
const SCROLL_THRESHOLD = 10; // px de margen para no parpadear en el tope
function onScroll(y) {
  header.classList.toggle('is-scrolled', y > SCROLL_THRESHOLD);
  heroSection.classList.toggle('is-scrolled', y > SCROLL_THRESHOLD); // atenúa la imagen del hero
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

  // 6c. Parallax: la imagen (más alta que su marco) se desplaza en yPercent
  $$('[data-parallax]').forEach((img) => {
    gsap.fromTo(img, { yPercent: 0 }, {
      yPercent: parseFloat(img.dataset.parallax), ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // 6d. Tarjetas de servicios en cascada
  gsap.from('[data-cards] .card', {
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

gsap.to('[data-line-fill]', {
  scaleY: 1, ease: 'none',
  scrollTrigger: { trigger: '.process__steps', start: 'top 55%', end: 'bottom 55%', scrub: true },
});

function setStep(i) {
  steps.forEach((s, n) => s.classList.toggle('is-active', n <= i));
  digits.style.transform = `translateY(${-100 * i / steps.length}%)`;
}
steps.forEach((step, i) => {
  ScrollTrigger.create({
    trigger: step, start: 'top 55%',
    onEnter: () => setStep(i),
    onLeaveBack: () => setStep(Math.max(0, i - 1)),
  });
});
setStep(0);

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

/* Recalcular posiciones cuando terminan de cargar fuentes e imágenes */
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
