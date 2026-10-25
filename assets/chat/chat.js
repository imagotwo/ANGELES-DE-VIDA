/* Punto de entrada: conecta la máquina de estados, la voz y la interfaz. */
import { CHAT_CONFIG as cfg } from './config.js';
import { Conversation } from './flow.js';
import { VoiceReader } from './voice.js';
import { createUI } from './ui.js';
import { summarySections, validateAll, displayValue, buildWhatsappMessage, buildWhatsappUrl, normalizeWhatsappNumber } from './summary.js';
import { todayISO } from './validators.js';

const WELCOME = `¡Hola! Bienvenido/a a ${cfg.businessName}. Estamos aquí para ayudarte a solicitar el servicio de enfermería que necesitas.

Para gestionar tu solicitud, te haré algunas preguntas sobre tus datos de contacto, el servicio requerido y las necesidades de cuidado del paciente.

Al finalizar, podrás revisar toda la información y continuar por WhatsApp para que nuestro equipo pueda revisar tu solicitud y confirmar la disponibilidad del servicio.

¿Comenzamos?`;

export function initAngelesChat() {
  if (document.querySelector('[data-adv-chat]')) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const conv = new Conversation(cfg);
  const voice = new VoiceReader(cfg.voice);
  const waNumber = normalizeWhatsappNumber(cfg.whatsappNumber || document.querySelector('[data-whatsapp]')?.dataset.whatsapp);
  const ui = createUI(cfg, { onOpen: openChat, onMinimize: minimize, onClose: closeChat, onToggleVoice, onVoice });

  let gen = 0;          // invalida mensajes pendientes al cerrar/reiniciar
  let started = false;
  let currentSpeech = '';

  /* ---------- Utilidades ---------- */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const typingMs = (t) => (reduce.matches ? 120 : Math.min(cfg.typingDelayMs.max, cfg.typingDelayMs.min + String(t).length * 8));
  const say = (text) => { currentSpeech = text; if (voice.enabled && ui.isOpen()) voice.speak(text); };
  const voiceState = () => ({ supported: voice.supported, enabled: voice.enabled, paused: voice.paused, voices: voice.voices, voiceURI: voice.voiceURI });
  voice.onchange = () => ui.setVoiceState(voiceState());

  /** Muestra «Escribiendo…», luego el mensaje. Devuelve false si el flujo fue cancelado mientras tanto. */
  async function bot(g, content, opts, speech) {
    ui.typing(true);
    await wait(typingMs(typeof content === 'string' ? content : 'x'.repeat(60)));
    if (g !== gen) return false;
    ui.typing(false);
    ui.addBot(content, opts);
    if (speech) say(speech);
    return true;
  }

  /* ---------- Bienvenida y modalidad de voz ---------- */
  async function showWelcome(prefix) {
    const g = gen;
    conv.phase = 'welcome';
    if (prefix && !(await bot(g, prefix))) return;
    if (!(await bot(g, WELCOME))) return;
    ui.showChoices({
      label: '¿Comenzamos?',
      options: [{ value: 'yes', label: 'Sí, comenzar', variant: 'primary', default: true }, { value: 'no', label: 'Ahora no', variant: 'secondary' }],
      onPick: (o) => {
        ui.addUser(o.label);
        if (o.value === 'yes') askVoice();
        else declineStart();
      },
    });
  }

  async function declineStart() {
    const g = gen;
    ui.clearDock();
    if (!(await bot(g, 'Sin problema. No guardé ningún dato. Cuando quieras solicitar el servicio, aquí estaré.'))) return;
    ui.showChoices({ label: 'Opciones', options: [{ value: 'go', label: 'Quiero comenzar', variant: 'primary', default: true }],
      onPick: (o) => { ui.addUser(o.label); askVoice(); } });
  }

  async function askVoice() {
    const g = gen;
    conv.phase = 'voice';
    ui.clearDock();
    if (!(await bot(g, 'Elige cómo quieres hacerlo. Puedes cambiarlo después con el botón del altavoz.', { eyebrow: '¿Cómo prefieres realizar este proceso?' }))) return;
    ui.showChoices({
      label: '¿Cómo prefieres realizar este proceso?',
      options: [
        { value: 'text', label: 'Solo texto', desc: 'Toda la conversación es escrita (predeterminado)', default: true },
        { value: 'voice', label: 'Con asistente de voz', desc: 'El asistente leerá las preguntas en voz alta' },
      ],
      onPick: async (o) => {
        ui.addUser(o.label);
        ui.clearDock();
        if (o.value === 'voice') {
          if (voice.supported) voice.setEnabled(true);
          else if (!(await bot(g, 'Tu navegador no permite la lectura en voz alta. Continuaremos solo con texto, sin ningún problema.'))) return;
        }
        conv.start();
        presentStep();
      },
    });
  }

  function onToggleVoice() {
    if (!voice.supported) return;
    voice.setEnabled(!voice.enabled);
    if (voice.enabled && currentSpeech) voice.speak(currentSpeech);
  }
  function onVoice(action, val) {
    if (action === 'pause') (voice.paused ? voice.resume() : voice.pause());
    else if (action === 'stop') voice.stop();
    else if (action === 'repeat') voice.repeat();
    else if (action === 'voice') { voice.setVoice(val); voice.repeat(); }
  }

  /* ---------- Preguntas ---------- */
  const instruction = (s) => ({ choice: 'Elige una de las opciones.', consent: '', date: 'Elige o escribe la fecha.' }[s.kind] ?? 'Escribe tu respuesta.');

  async function presentStep() {
    const g = gen;
    const step = conv.current();
    ui.clearDock();
    if (conv.lastMove === 'forward') {
      for (const t of step.intro ?? []) if (!(await bot(g, t))) return;
    } else if (conv.lastMove === 'back') {
      if (!(await bot(g, 'Volvamos a la pregunta anterior. Tu respuesta anterior sigue ahí por si quieres conservarla.'))) return;
    } else if (!(await bot(g, 'Claro, corrijamos este dato.'))) return;

    const p = conv.progress();
    const q = step.prompt(conv.answers);
    const speech = step.kind === 'consent' ? `${q} Puedes leer la autorización en pantalla.` : `${q} ${step.hint ?? ''} ${instruction(step)}`;
    if (!(await bot(g, q, { eyebrow: p ? `Pregunta ${p.n} de ${p.total}` : 'Autorización', hint: step.kind === 'choice' ? 'Elige una opción.' : step.hint }, speech))) return;
    renderInput(step);
  }

  function backSpec() {
    return conv.canBack()
      ? { onBack: goBack, backLabel: conv.returnToSummary ? 'Cancelar corrección' : 'Volver a la pregunta anterior' }
      : {};
  }

  function renderInput(step) {
    const prev = conv.answers[step.id];
    const common = { label: step.prompt(conv.answers), ...backSpec() };
    if (step.kind === 'choice') {
      ui.showChoices({ ...common, options: step.options.map((o) => ({ ...o, default: o.value === prev })), onPick: (o) => answer(o.value) });
    } else if (step.kind === 'consent') {
      ui.showConsent({ ...common, privacyUrl: cfg.privacyUrl, requireRepresentative: cfg.requireRepresentativeDeclaration,
        onSubmit: (raw, showErr) => answer(raw, showErr), onDecline: declineConsent });
    } else {
      ui.showComposer({
        ...common, kind: step.kind, hint: step.hint, placeholder: step.placeholder, autocomplete: step.autocomplete, maxlength: step.maxlength,
        value: prev == null ? (step.id === 'fecha_fin' ? conv.answers.fecha_inicio : '') : (step.kind === 'number' ? String(prev) : prev),
        min: step.kind === 'date' ? (step.id === 'fecha_fin' ? conv.answers.fecha_inicio || todayISO() : todayISO()) : undefined,
        quick: step.quick, onSubmit: (raw) => answer(raw),
      });
    }
  }

  function answer(raw, onError = ui.showError) {
    if (conv.phase !== 'form') return;
    const step = conv.current();
    const wasEditing = conv.returnToSummary;
    const res = conv.submit(raw);
    if (!res.ok) { onError(res.error); if (voice.enabled) say(res.error); return; }
    ui.addUser(raw === '__desconocido__' ? 'No lo conozco' : displayValue(step, res.value));
    ui.clearDock();
    voice.stop();
    if (step.id === 'diagnostico' && res.value === 'No lo conozco') noteUnknownDiagnosis(wasEditing);
    else afterAnswer(wasEditing);
  }

  async function noteUnknownDiagnosis(wasEditing) {
    const g = gen;
    if (!(await bot(g, 'Gracias por avisar. Lo registraré así; es posible que nuestro equipo te pregunte por el diagnóstico más adelante.'))) return;
    afterAnswer(wasEditing);
  }
  const afterAnswer = (updated) => (conv.phase === 'summary' ? showSummary(updated) : presentStep());

  function goBack() {
    if (!conv.back()) return;
    voice.stop();
    if (conv.phase === 'summary') showSummaryChoices('Listo, dejé tus respuestas como estaban.');
    else presentStep();
  }

  async function declineConsent() {
    restart('Entiendo. Sin tu autorización no puedo continuar, así que no guardé ni voy a enviar ningún dato. Si cambias de opinión, puedes empezar de nuevo.');
  }

  /* ---------- Resumen y WhatsApp ---------- */
  async function showSummary(updated = false) {
    const g = gen;
    conv.phase = 'summary';
    ui.clearDock();
    const msg = updated ? 'Listo, actualicé tu respuesta. Este es el resumen con los cambios.' : '¡Gracias por compartir esta información! Ya tenemos los datos necesarios para preparar tu solicitud.\n\nAntes de continuar, revisa el resumen. Puedes corregir cualquier respuesta antes de abrir WhatsApp.';
    if (!(await bot(g, msg, {}, updated ? 'Actualicé tu respuesta. Revisa el resumen.' : '¡Gracias por compartir esta información! Revisa el resumen. Puedes corregir cualquier respuesta antes de abrir WhatsApp.'))) return;
    ui.addCard(ui.summaryNode(summarySections(conv)));
    showSummaryChoices();
  }

  async function showSummaryChoices(prefix) {
    const g = gen;
    ui.clearDock();
    conv.phase = 'summary';
    if (prefix && !(await bot(g, prefix))) return;
    ui.showChoices({
      label: 'Acciones sobre el resumen',
      options: [
        { value: 'ok', label: 'Confirmar y continuar por WhatsApp', variant: 'wa', default: true },
        { value: 'fix', label: 'Corregir respuestas', variant: 'secondary' },
        { value: 'cancel', label: 'Cancelar solicitud', variant: 'danger' },
      ],
      onPick: (o) => { ui.addUser(o.label); ({ ok: confirmSummary, fix: showFixMenu, cancel: cancelRequest })[o.value](); },
    });
  }

  async function showFixMenu() {
    const g = gen;
    ui.clearDock();
    if (!(await bot(g, '¿Qué respuesta quieres corregir?'))) return;
    const clip = (t) => (t.length > 38 ? `${t.slice(0, 36)}…` : t);
    const options = conv.visible.filter((s) => s.section && s.id in conv.answers)
      .map((s) => ({ value: s.id, label: `${s.label}: ${clip(displayValue(s, conv.answers[s.id]).replace(/\s+/g, ' '))}`, variant: 'secondary' }));
    options.push({ value: '__back', label: 'Volver al resumen', variant: 'primary' });
    ui.showChoices({ label: 'Elige la respuesta a corregir', options, onPick: (o) => {
      ui.addUser(o.value === '__back' ? o.label : o.label.split(':')[0]);
      if (o.value === '__back') showSummaryChoices(); else { conv.goTo(o.value); presentStep(); }
    } });
  }

  async function confirmSummary() {
    const g = gen;
    ui.clearDock();
    const check = validateAll(conv);
    if (!check.ok) {
      if (!(await bot(g, `Antes de continuar necesito corregir algo: ${check.error}`))) return;
      conv.goTo(check.stepId); presentStep(); return;
    }
    if (!waNumber) {
      if (!(await bot(g, 'No puedo abrir WhatsApp porque el número de la empresa todavía no está configurado. Tus respuestas siguen aquí; avisa al equipo del sitio.'))) return;
      showSummaryChoices(); return;
    }
    const url = buildWhatsappUrl(waNumber, buildWhatsappMessage(conv.answers, cfg.businessName));
    conv.phase = 'final';
    const notice = 'Antes de abrir WhatsApp, ten en cuenta que el mensaje incluirá tus datos personales y datos relativos a la salud del paciente (nombre, edad, diagnóstico y condición).\n\nSe abrirá WhatsApp con el mensaje ya escrito. Tú debes pulsar «Enviar» allí: nada se envía automáticamente.';
    if (!(await bot(g, notice, { eyebrow: 'Último paso' }, 'El mensaje incluirá datos personales y datos de salud del paciente. Si deseas continuar, pulsa abrir WhatsApp. Tú debes enviarlo manualmente.'))) return;
    ui.showAction({
      href: url, label: 'Abrir WhatsApp con mi solicitud', onOpen: () => setTimeout(afterOpen, 500),
      secondary: [{ label: 'Volver al resumen', onPick: () => { ui.addUser('Volver al resumen'); showSummaryChoices(); } }],
    });
  }

  async function afterOpen() {
    const g = gen;
    ui.addUser('Abrir WhatsApp con mi solicitud');
    ui.clearDock();
    if (!(await bot(g, 'Dejé el mensaje preparado en WhatsApp. Recuerda pulsar «Enviar» allí: hasta entonces nuestro equipo no lo recibe.\n\nEste mensaje no confirma el servicio; el equipo revisará la solicitud y te contactará para confirmar la disponibilidad.', { eyebrow: 'Mensaje preparado' }))) return;
    ui.showChoices({ label: 'Después de abrir WhatsApp', options: [
      { value: 'sum', label: 'Volver al resumen', variant: 'secondary' },
      { value: 'close', label: 'Cerrar y borrar mis datos', variant: 'primary', default: true }],
    onPick: (o) => { if (o.value === 'close') closeAndReset(); else { ui.addUser(o.label); showSummaryChoices(); } } });
  }

  function cancelRequest() {
    restart('He cancelado la solicitud y borré la información que escribiste. No se envió nada.');
  }

  /* ---------- Abrir, minimizar, cerrar, reiniciar ---------- */
  function openChat() {
    ui.open();
    if (!started) { started = true; showWelcome(); }
  }
  function minimize(opts) { voice.stop(); ui.hide(opts); }

  function closeChat() {
    if (conv.hasData()) ui.askCloseConfirm({ onYes: closeAndReset, onNo: () => ui.focusFirst() });
    else closeAndReset();
  }
  function wipe() {
    gen += 1; voice.stop(); currentSpeech = '';
    conv.reset(); ui.typing(false); ui.clearDock(); ui.clearLog();
  }
  function closeAndReset() { wipe(); started = false; ui.hide(); }
  function restart(prefix) { wipe(); started = true; showWelcome(prefix); }

  /* ---------- Arranque ---------- */
  ui.mount();
  voice.init();
  ui.setVoiceState(voiceState());
  ui.showTip();

  // Si el menú o el formulario modal del sitio se abren, el chat se minimiza para no superponerse.
  new MutationObserver(() => {
    const c = document.body.classList;
    if ((c.contains('menu-open') || c.contains('modal-open')) && ui.isOpen()) minimize({ restoreFocus: false });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

initAngelesChat();
