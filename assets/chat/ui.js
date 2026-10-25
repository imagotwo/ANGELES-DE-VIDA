/* Capa de interfaz: botón flotante, ventana, burbujas y entradas. No contiene reglas de negocio. */

const SVG_NS = 'http://www.w3.org/2000/svg';
const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';
const ICONS = {
  wa: { d: WA_PATH, fill: true },
  close: { d: 'M18 6 6 18M6 6l12 12' },
  min: { d: 'M5 12h14' },
  send: { d: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z' },
  back: { d: 'M19 12H5M12 19l-7-7 7-7' },
  down: { d: 'M12 5v14M5 12l7 7 7-7' },
  spk: { d: 'M11 5 6 9H2v6h4l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14' },
  spkOff: { d: 'M11 5 6 9H2v6h4l5 4V5ZM23 9l-6 6M17 9l6 6' },
  pause: { d: 'M9 5v14M15 5v14' },
  play: { d: 'M7 4v16l13-8Z' },
  stop: { d: 'M6 6h12v12H6Z' },
  repeat: { d: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3' },
};

export function icon(name) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.setAttribute('class', 'adv-ico' + (ICONS[name].fill ? ' adv-ico--fill' : ''));
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', ICONS[name].d);
  s.append(p);
  return s;
}

const PROPS = new Set(['value', 'checked', 'disabled', 'hidden']);
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' });
const dateInputSupported = (() => {
  const i = document.createElement('input');
  i.setAttribute('type', 'date');
  return i.type === 'date';
})();

export function createUI(cfg, handlers) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;
  let tipTimer;

  /* ---------- Botón flotante + sugerencia ---------- */
  const fab = h('button', {
    class: 'adv-fab', type: 'button', 'aria-label': 'Solicitar servicio de enfermería',
    'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'adv-panel',
    onClick: () => handlers.onOpen(),
  }, icon('wa'));
  const tip = h('div', { class: 'adv-tip', hidden: true },
    h('p', { text: '¿Necesitas ayuda? Estamos aquí para orientarte' }),
    h('button', { class: 'adv-tip__x', type: 'button', 'aria-label': 'Cerrar sugerencia', onClick: () => hideTip() }, icon('close')));
  const launcher = h('div', { class: 'adv-launcher' }, tip, h('div', { class: 'adv-sway' }, fab));

  /* ---------- Ventana ---------- */
  const avatarImg = h('img', { src: cfg.avatarUrl, alt: '', onError: (e) => e.target.remove() });
  const spkBtn = h('button', { class: 'adv-iconbtn', type: 'button', hidden: true, 'aria-pressed': 'false',
    'aria-label': 'Activar lectura en voz alta', onClick: () => handlers.onToggleVoice() }, icon('spkOff'));
  const head = h('header', { class: 'adv-head' },
    h('span', { class: 'adv-avatar' }, h('span', { text: 'AV', 'aria-hidden': 'true' }), avatarImg),
    h('div', { class: 'adv-head__txt' },
      h('p', { class: 'adv-title', id: 'adv-title', text: cfg.businessName }),
      h('p', { class: 'adv-sub' }, h('span', { class: 'adv-dot', 'aria-hidden': 'true' }),
        'Asistente de solicitudes de servicio', h('span', { class: 'adv-sr', text: '. Asistente automático disponible.' }))),
    spkBtn,
    h('button', { class: 'adv-iconbtn', type: 'button', 'aria-label': 'Minimizar chat', onClick: () => handlers.onMinimize() }, icon('min')),
    h('button', { class: 'adv-iconbtn', type: 'button', 'aria-label': 'Cerrar chat', onClick: () => handlers.onClose() }, icon('close')));

  const pauseBtn = h('button', { class: 'adv-vbtn', type: 'button', onClick: () => handlers.onVoice('pause') }, icon('pause'), h('span', { text: 'Pausar' }));
  const voiceSel = h('select', { class: 'adv-vsel', 'aria-label': 'Elegir voz', hidden: true, onChange: (e) => handlers.onVoice('voice', e.target.value) });
  const voiceBar = h('div', { class: 'adv-voicebar', role: 'group', 'aria-label': 'Controles de voz', hidden: true },
    h('button', { class: 'adv-vbtn', type: 'button', onClick: () => handlers.onVoice('repeat') }, icon('repeat'), h('span', { text: 'Repetir' })),
    pauseBtn,
    h('button', { class: 'adv-vbtn', type: 'button', onClick: () => handlers.onVoice('stop') }, icon('stop'), h('span', { text: 'Detener' })),
    voiceSel);

  const typingEl = h('div', { class: 'adv-row adv-row--bot adv-typing', 'aria-hidden': 'true' },
    h('div', { class: 'adv-bubble' }, h('span', { class: 'adv-dots' }, h('i'), h('i'), h('i')), h('span', { class: 'adv-typing__t', text: 'Escribiendo…' })));
  const log = h('div', { class: 'adv-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Conversación', tabindex: '0' });
  const newBtn = h('button', { class: 'adv-new', type: 'button', hidden: true, onClick: () => { scrollEnd(true); } }, 'Nuevos mensajes ', icon('down'));
  const confirmBar = h('div', { class: 'adv-confirm', role: 'alertdialog', 'aria-label': 'Confirmar cierre', hidden: true });
  const dock = h('div', { class: 'adv-dock' });

  const panel = h('section', {
    class: 'adv-panel', id: 'adv-panel', role: 'dialog', 'aria-labelledby': 'adv-title', 'data-lenis-prevent': '',
    onKeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); handlers.onMinimize(); } },
  }, head, voiceBar, h('div', { class: 'adv-stage' }, log, newBtn), confirmBar, dock);
  panel.inert = true;

  const root = h('div', { class: 'adv-chat', 'data-adv-chat': '' }, launcher, panel);

  /* ---------- Scroll del historial ---------- */
  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 90;
  function scrollEnd(force) {
    if (force || nearBottom()) {
      log.scrollTo({ top: log.scrollHeight, behavior: reduce.matches ? 'auto' : 'smooth' });
      newBtn.hidden = true;
    } else newBtn.hidden = false;
  }
  log.addEventListener('scroll', () => { if (nearBottom()) newBtn.hidden = true; }, { passive: true });

  function append(node, force = false) {
    const stick = force || nearBottom();
    log.insertBefore(node, typingEl.isConnected ? typingEl : null);
    requestAnimationFrame(() => scrollEnd(stick));
  }
  const timeEl = () => h('span', { class: 'adv-time', 'aria-hidden': 'true', text: timeFmt.format(new Date()) });
  const paragraphs = (c) => (typeof c === 'string' ? c.split('\n\n') : [c]).map((t) => (typeof t === 'string' ? h('p', { text: t }) : t));

  /* ---------- Mensajes ---------- */
  function addBot(content, { eyebrow, hint } = {}) {
    append(h('div', { class: 'adv-row adv-row--bot' },
      h('div', { class: 'adv-bubble' }, h('span', { class: 'adv-sr', text: 'Asistente: ' }),
        eyebrow && h('span', { class: 'adv-eyebrow', text: eyebrow }),
        h('div', { class: 'adv-text' }, paragraphs(content)),
        hint && h('p', { class: 'adv-bubble__hint', text: hint }), timeEl())));
  }
  function addUser(text) {
    append(h('div', { class: 'adv-row adv-row--user' },
      h('div', { class: 'adv-bubble' }, h('span', { class: 'adv-sr', text: 'Tú: ' }), h('div', { class: 'adv-text adv-text--pre', text }), timeEl())), true);
  }
  const addCard = (node) => append(h('div', { class: 'adv-row adv-row--card' }, node));
  function typing(on) {
    if (on && !typingEl.isConnected) { log.append(typingEl); scrollEnd(nearBottom()); }
    if (!on) typingEl.remove();
  }
  function clearLog() { log.replaceChildren(); newBtn.hidden = true; }

  function summaryNode(sections) {
    return h('div', { class: 'adv-card' }, sections.map((s) =>
      h('section', { class: 'adv-card__sec' },
        h('p', { class: 'adv-card__title', text: s.title }),
        h('dl', {}, s.rows.map((r) => h('div', { class: 'adv-card__row' }, h('dt', { text: r.label }), h('dd', { text: r.value })))))));
  }

  /* ---------- Dock (zona de respuesta) ---------- */
  function clearDock() { dock.replaceChildren(); confirmBar.hidden = true; }
  const put = (...nodes) => dock.append(...nodes.filter(Boolean));   // evita que null/false se pinten como texto
  function backButton(spec) {
    return spec.onBack ? h('button', { class: 'adv-link', type: 'button', onClick: spec.onBack }, icon('back'), spec.backLabel || 'Volver a la pregunta anterior') : null;
  }
  function focusFirst() {
    const el = dock.querySelector('[data-autofocus]') || dock.querySelector('input,textarea,button,a');
    el?.focus({ preventScroll: true });
  }

  function showChoices(spec) {
    clearDock();
    let locked = false;
    const group = h('div', { class: 'adv-choices', role: 'group', 'aria-label': spec.label }, spec.options.map((o) =>
      h('button', {
        type: 'button', class: 'adv-choice' + (o.variant ? ` adv-choice--${o.variant}` : ''),
        'data-autofocus': o.default ? '' : null,
        onClick: () => { if (!locked) { locked = true; spec.onPick(o); } },
      }, h('span', { text: o.label }), o.desc && h('small', { text: o.desc }))));
    put(group, backButton(spec));
    focusFirst();
  }

  function showAction(spec) { // enlace real (<a>) para que móviles y navegadores lo permitan como acción del usuario
    clearDock();
    put(
      h('a', { class: 'adv-choice adv-choice--wa', href: spec.href, target: '_blank', rel: 'noopener noreferrer',
        'data-autofocus': '', onClick: () => spec.onOpen() }, icon('wa'), h('span', { text: spec.label })),
      h('div', { class: 'adv-choices' }, spec.secondary.map((o) =>
        h('button', { type: 'button', class: 'adv-choice adv-choice--secondary', onClick: () => o.onPick() }, o.label))));
    focusFirst();
  }

  function showComposer(spec) {
    clearDock();
    const id = `adv-in-${++uid}`;
    const errId = `${id}-err`;
    const hintId = `${id}-hint`;
    const isArea = spec.kind === 'textarea';
    const isDate = spec.kind === 'date';
    const common = {
      id, 'aria-label': spec.label, 'aria-describedby': spec.hint ? hintId : null, autocomplete: spec.autocomplete || 'off',
      maxlength: isDate ? null : spec.maxlength, placeholder: isDate && !dateInputSupported ? 'dd/mm/aaaa' : spec.placeholder, 'data-autofocus': '',
    };
    const typeMap = { text: 'text', tel: 'tel', email: 'email', number: 'text' };
    const input = isArea
      ? h('textarea', { ...common, rows: 2 })
      : h('input', { ...common, type: isDate ? (dateInputSupported ? 'date' : 'text') : typeMap[spec.kind],
          inputmode: spec.kind === 'number' ? 'numeric' : spec.kind === 'tel' ? 'tel' : spec.kind === 'email' ? 'email' : null,
          min: isDate && dateInputSupported ? spec.min : null, spellcheck: spec.kind === 'text' || isArea ? 'true' : 'false' });
    input.value = spec.value ?? '';

    const err = h('p', { class: 'adv-err', id: errId, role: 'alert', hidden: true });
    const form = h('form', { class: 'adv-composer', novalidate: '' }, input,
      h('button', { class: 'adv-send', type: 'submit', 'aria-label': 'Enviar respuesta' }, icon('send')));
    form.addEventListener('submit', (e) => { e.preventDefault(); spec.onSubmit(input.value); });
    if (isArea) input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    input.addEventListener('focus', () => setTimeout(() => scrollEnd(true), 250));
    input.addEventListener('input', () => { if (!err.hidden) clearError(); });

    put(
      spec.quick?.length && h('div', { class: 'adv-choices adv-choices--inline', role: 'group', 'aria-label': 'Respuestas rápidas' },
        spec.quick.map((q) => h('button', { type: 'button', class: 'adv-choice adv-choice--secondary', onClick: () => spec.onSubmit(q.value) }, q.label))),
      spec.hint && h('p', { class: 'adv-dockhint', id: hintId, text: spec.hint }),
      err, form, backButton(spec));
    dock._input = input; dock._err = err;
    focusFirst();
  }

  function showError(msg) {
    const { _input: input, _err: err } = dock;
    if (!err) return;
    err.textContent = ''; err.hidden = false;
    requestAnimationFrame(() => { err.textContent = `⚠ ${msg}`; });
    if (input) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', [err.id, input.getAttribute('aria-describedby')].filter(Boolean).join(' ')); input.focus({ preventScroll: true }); }
  }
  function clearError() {
    const { _input: input, _err: err } = dock;
    if (err) { err.hidden = true; err.textContent = ''; }
    if (input) { input.removeAttribute('aria-invalid'); input.setAttribute('aria-describedby', (input.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && !x.endsWith('-err')).join(' ')); }
  }

  function showConsent(spec) {
    clearDock();
    const id = `adv-c-${++uid}`;
    const cb1 = h('input', { type: 'checkbox', id: `${id}-1`, 'data-autofocus': '' });
    const cb2 = spec.requireRepresentative ? h('input', { type: 'checkbox', id: `${id}-2` }) : null;
    const err = h('p', { class: 'adv-err', role: 'alert', hidden: true });
    const row = (cb, ...label) => h('div', { class: 'adv-check' }, cb, h('label', { for: cb.id }, ...label));
    const submit = () => {
      err.hidden = true;
      spec.onSubmit({ tratamiento: cb1.checked, representante: cb2 ? cb2.checked : true }, (m) => { err.textContent = `⚠ ${m}`; err.hidden = false; });
    };
    put(h('div', { class: 'adv-consent' },
      row(cb1, 'Autorizo el tratamiento de mis datos personales y de los datos personales del paciente, incluidos los datos relativos a su salud, para gestionar esta solicitud, conforme a la ',
        h('a', { href: spec.privacyUrl, target: '_blank', rel: 'noopener' }, 'política de tratamiento de datos personales'), ` de ${cfg.businessName}.`),
      cb2 && row(cb2, 'Declaro que soy el paciente o su representante, familiar o persona autorizada para entregar sus datos.'),
      err,
      h('div', { class: 'adv-choices' },
        h('button', { type: 'button', class: 'adv-choice adv-choice--primary', onClick: submit }, 'Continuar'),
        h('button', { type: 'button', class: 'adv-choice adv-choice--secondary', onClick: spec.onDecline }, 'No autorizo'))),
      backButton(spec));
    focusFirst();
  }

  function askCloseConfirm({ onYes, onNo }) {
    confirmBar.replaceChildren(
      h('p', { text: 'Si cierras el chat, se borrará la conversación y los datos que escribiste.' }),
      h('div', { class: 'adv-choices' },
        h('button', { type: 'button', class: 'adv-choice adv-choice--secondary', 'data-autofocus': '', onClick: () => { confirmBar.hidden = true; onNo(); } }, 'Seguir aquí'),
        h('button', { type: 'button', class: 'adv-choice adv-choice--danger', onClick: () => { confirmBar.hidden = true; onYes(); } }, 'Cerrar y borrar')));
    confirmBar.hidden = false;
    confirmBar.querySelector('[data-autofocus]').focus({ preventScroll: true });
  }

  /* ---------- Voz (estado visual) ---------- */
  function setVoiceState(v) {
    spkBtn.hidden = !v.supported;
    spkBtn.setAttribute('aria-pressed', String(v.enabled));
    spkBtn.setAttribute('aria-label', v.enabled ? 'Desactivar lectura en voz alta' : 'Activar lectura en voz alta');
    spkBtn.replaceChildren(icon(v.enabled ? 'spk' : 'spkOff'));
    voiceBar.hidden = !(v.supported && v.enabled);
    const paused = v.paused;
    pauseBtn.replaceChildren(icon(paused ? 'play' : 'pause'), h('span', { text: paused ? 'Reanudar' : 'Pausar' }));
    pauseBtn.dataset.mode = paused ? 'resume' : 'pause';
    voiceSel.hidden = v.voices.length < 2;
    if (voiceSel.options.length !== v.voices.length) voiceSel.replaceChildren(...v.voices.map((x) => h('option', { value: x.voiceURI, text: `${x.name} (${x.lang})` })));
    if (v.voiceURI) voiceSel.value = v.voiceURI;
  }

  /* ---------- Abrir / cerrar ---------- */
  function placeViewport() {
    const vv = window.visualViewport;
    if (!vv || !window.matchMedia('(max-width: 600px)').matches) { panel.style.removeProperty('--adv-h'); panel.style.removeProperty('--adv-top'); return; }
    panel.style.setProperty('--adv-h', `${vv.height}px`);
    panel.style.setProperty('--adv-top', `${vv.offsetTop}px`);
  }
  window.visualViewport?.addEventListener('resize', placeViewport);
  window.visualViewport?.addEventListener('scroll', placeViewport);

  const isOpen = () => panel.classList.contains('is-open');
  function open() {
    placeViewport(); hideTip();
    panel.inert = false; panel.classList.add('is-open'); root.classList.add('is-chat-open');
    fab.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => { scrollEnd(true); focusFirst(); });
  }
  function hide({ restoreFocus = true } = {}) {
    const hadFocus = panel.contains(document.activeElement);
    panel.classList.remove('is-open'); root.classList.remove('is-chat-open'); panel.inert = true;
    confirmBar.hidden = true; fab.setAttribute('aria-expanded', 'false');
    if (restoreFocus && hadFocus) fab.focus({ preventScroll: true });
  }

  function showTip(delay = 4000) {
    tipTimer = setTimeout(() => {
      if (isOpen()) return;
      tip.hidden = false; requestAnimationFrame(() => tip.classList.add('is-in'));
      tipTimer = setTimeout(hideTip, 14000);
    }, delay);
  }
  function hideTip() { clearTimeout(tipTimer); tip.classList.remove('is-in'); setTimeout(() => { tip.hidden = true; }, 250); }

  return { root, mount: () => document.body.append(root), open, hide, isOpen, showTip,
    addBot, addUser, addCard, typing, clearLog, summaryNode,
    clearDock, showChoices, showAction, showComposer, showConsent, showError, clearError, askCloseConfirm,
    setVoiceState, focusFirst };
}
