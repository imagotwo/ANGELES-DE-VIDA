/* Definición de las preguntas + máquina de estados de la conversación (sin DOM). */
import * as V from './validators.js';

export const UNKNOWN_DIAGNOSIS = '__desconocido__';

/** Catálogo de preguntas. `when` decide si la pregunta aplica según las respuestas previas. */
export function buildSteps(cfg) {
  const placeLabel = (a) => (a.lugar === 'hospital' ? 'del hospital o clínica' : 'de la casa');
  return [
    /* ---- BLOQUE A · Solicitante ---- */
    { id: 'nombre', kind: 'text', section: 'solicitante', label: 'Nombre y apellido',
      prompt: () => '¿Cuál es tu nombre y apellido?', placeholder: 'Nombre y apellido',
      autocomplete: 'name', maxlength: V.LIMITS.nombre, validate: (r) => V.validateName(r) },
    { id: 'telefono', kind: 'tel', section: 'solicitante', label: 'Teléfono / WhatsApp',
      prompt: () => '¿A qué número de teléfono o WhatsApp podemos contactarte?',
      hint: 'Ejemplo: 300 123 4567', placeholder: '300 123 4567', autocomplete: 'tel',
      maxlength: 25, validate: (r) => V.validatePhone(r) },
    { id: 'correo', kind: 'email', section: 'solicitante', label: 'Correo electrónico',
      prompt: () => '¿Cuál es tu correo electrónico?', placeholder: 'nombre@correo.com',
      autocomplete: 'email', maxlength: V.LIMITS.correo, validate: (r) => V.validateEmail(r) },

    /* ---- BLOQUE B · Servicio ---- */
    { id: 'servicio', kind: 'choice', section: 'servicio', label: 'Tipo de servicio',
      intro: ['Tus datos de contacto quedaron registrados solo en esta conversación, en la memoria de tu navegador.',
              'Ahora cuéntame sobre el servicio que necesitas.'],
      prompt: () => '¿Qué tipo de servicio necesitas?', options: cfg.services,
      validate: (r) => V.validateChoice(r, cfg.services) },
    { id: 'modalidad', kind: 'choice', section: 'servicio', label: 'Modalidad / horario',
      prompt: () => '¿Con qué modalidad u horario?', options: cfg.schedules,
      validate: (r) => V.validateChoice(r, cfg.schedules) },
    { id: 'fecha_inicio', kind: 'date', section: 'servicio', label: 'Fecha de inicio',
      prompt: () => '¿En qué fecha quieres que inicie el servicio?',
      hint: 'Elige la fecha en el calendario o escríbela (dd/mm/aaaa).',
      validate: (r, ctx) => V.validateStartDate(r, ctx.now) },
    { id: 'fecha_fin', kind: 'date', section: 'servicio', label: 'Fecha de finalización',
      prompt: () => '¿En qué fecha termina el servicio?',
      hint: 'Si es de un solo día, elige la misma fecha de inicio.',
      validate: (r, ctx) => V.validateEndDate(r, ctx.answers.fecha_inicio, ctx.now) },
    { id: 'lugar', kind: 'choice', section: 'servicio', label: 'Lugar de prestación',
      prompt: () => '¿Dónde se prestará el servicio?', options: cfg.places,
      display: (v) => cfg.places.find((p) => p.value === v)?.label ?? v,
      validate: (r) => V.validateChoice(r, cfg.places) },
    { id: 'direccion', kind: 'text', section: 'servicio', label: 'Dirección',
      when: (a) => a.lugar === 'casa' || a.lugar === 'hospital',
      prompt: (a) => `¿Cuál es la dirección ${placeLabel(a)}?`, hint: 'Calle, número, barrio.',
      placeholder: 'Calle, número, barrio', autocomplete: 'street-address', maxlength: V.LIMITS.direccion,
      validate: (r) => V.validateText(r, { max: V.LIMITS.direccion, empty: 'Escribe la dirección para continuar.' }) },
    { id: 'hospital', kind: 'text', section: 'servicio', label: 'Hospital o clínica',
      when: (a) => a.lugar === 'hospital',
      prompt: () => '¿Cómo se llama el hospital o la clínica?', placeholder: 'Nombre del hospital o clínica',
      maxlength: V.LIMITS.hospital,
      validate: (r) => V.validateText(r, { max: V.LIMITS.hospital, empty: 'Escribe el nombre del hospital o la clínica.' }) },

    /* ---- Autorización: ANTES de pedir datos de salud del paciente ---- */
    { id: 'autorizacion', kind: 'consent', section: null, label: 'Autorización de datos', counted: false,
      intro: ['Antes de preguntarte por el paciente necesito tu autorización: le pediré datos relacionados con su salud.'],
      prompt: () => 'Para continuar, lee y marca la autorización de tratamiento de datos.',
      display: () => 'Autorizo el tratamiento de datos',
      validate: (r, ctx) => V.validateConsent(r, { requireRepresentative: ctx.cfg.requireRepresentativeDeclaration }, ctx.now) },

    /* ---- BLOQUE C · Paciente ---- */
    { id: 'paciente', kind: 'text', section: 'paciente', label: 'Nombre del paciente',
      intro: ['Ahora te haré unas preguntas sobre el paciente para que nuestro equipo pueda comprender las necesidades de cuidado y revisar la solicitud.'],
      prompt: () => '¿Cuál es el nombre del paciente?', placeholder: 'Nombre del paciente',
      autocomplete: 'off', maxlength: V.LIMITS.paciente,
      validate: (r) => V.validateName(r, 'Escribe el nombre del paciente para continuar.') },
    { id: 'edad', kind: 'number', section: 'paciente', label: 'Edad',
      prompt: () => '¿Qué edad tiene el paciente?', hint: 'En años, solo números.', placeholder: 'Ej.: 78',
      maxlength: 3, validate: (r) => V.validateAge(r),
      display: (v) => `${v} años` },
    { id: 'diagnostico', kind: 'textarea', section: 'paciente', label: 'Diagnóstico(s)',
      prompt: () => '¿Qué diagnósticos conoces del paciente?',
      hint: 'Escribe los que conozcas, tal como te los informó el médico.',
      placeholder: 'Diagnóstico(s) del paciente', autocomplete: 'off', maxlength: V.LIMITS.diagnostico,
      quick: cfg.allowUnknownDiagnosis ? [{ value: UNKNOWN_DIAGNOSIS, label: 'No lo conozco' }] : [],
      display: (v) => v,
      validate: (r, ctx) => {
        if (r === UNKNOWN_DIAGNOSIS) {
          return ctx.cfg.allowUnknownDiagnosis
            ? { ok: true, value: 'No lo conozco' }
            : { ok: false, error: 'Necesitamos al menos un diagnóstico para revisar la solicitud.' };
        }
        return V.validateText(r, { max: V.LIMITS.diagnostico, empty: 'Escribe el diagnóstico o elige «No lo conozco».', multiline: true });
      } },
    { id: 'condicion', kind: 'textarea', section: 'paciente', label: 'Condición del paciente',
      prompt: () => '¿Cómo es la condición actual del paciente?',
      hint: 'Ejemplo: camina con ayuda, permanece en cama, usa sonda o necesita apoyo para comer.',
      placeholder: 'Describe brevemente su condición', autocomplete: 'off', maxlength: V.LIMITS.condicion,
      validate: (r) => V.validateText(r, { max: V.LIMITS.condicion, empty: 'Cuéntanos brevemente la condición del paciente.', multiline: true }) },
  ];
}

export const SECTIONS = [
  { id: 'solicitante', title: 'Datos del solicitante' },
  { id: 'servicio', title: 'Datos del servicio' },
  { id: 'paciente', title: 'Datos del paciente' },
];

/** Controla el orden, las validaciones, el retroceso, la edición y la finalización. */
export class Conversation {
  constructor(cfg, { now = () => new Date() } = {}) {
    this.cfg = cfg;
    this.now = now;
    this.steps = buildSteps(cfg);
    this.reset();
  }

  reset() {
    this.answers = {};
    this.phase = 'welcome'; // welcome → voice → form → summary → final
    this.index = 0;
    this.returnToSummary = false;
    this.lastMove = 'forward'; // forward | back | edit
  }

  get visible() { return this.steps.filter((s) => !s.when || s.when(this.answers)); }
  current() { return this.visible[this.index]; }
  hasData() { return Object.keys(this.answers).length > 0; }
  canBack() { return this.phase === 'form' && (this.returnToSummary || this.index > 0); }

  start() { this.phase = 'form'; this.index = 0; this.lastMove = 'forward'; this.returnToSummary = false; }

  /** «Pregunta n de N» (la autorización no cuenta como pregunta). */
  progress() {
    const counted = this.visible.filter((s) => s.counted !== false);
    const cur = this.current();
    const n = counted.indexOf(cur) + 1;
    return n > 0 ? { n, total: counted.length } : null;
  }

  submit(raw) {
    const step = this.current();
    const res = step.validate(raw, { answers: this.answers, now: this.now(), cfg: this.cfg });
    if (!res.ok) return res;
    this.answers[step.id] = res.value;
    this.#prune();
    this.#advance();
    return { ok: true, value: res.value, step };
  }

  back() {
    if (!this.canBack()) return false;
    if (this.returnToSummary) { this.returnToSummary = false; this.phase = 'summary'; return true; }
    this.index -= 1; this.lastMove = 'back';
    return true;
  }

  /** Salta a una pregunta para corregirla; al responder vuelve al resumen. */
  goTo(id) {
    const i = this.visible.findIndex((s) => s.id === id);
    if (i === -1) return false;
    this.phase = 'form'; this.index = i; this.returnToSummary = true; this.lastMove = 'edit';
    return true;
  }

  /** Respuestas de preguntas que ya no aplican (p. ej. hospital si el lugar pasó a «casa»). */
  #prune() {
    const ids = new Set(this.visible.map((s) => s.id));
    for (const k of Object.keys(this.answers)) if (!ids.has(k)) delete this.answers[k];
  }

  #advance() {
    const vis = this.visible;
    if (this.returnToSummary) {
      const missing = vis.findIndex((s) => !(s.id in this.answers));
      if (missing === -1) { this.phase = 'summary'; this.returnToSummary = false; this.lastMove = 'forward'; }
      else { this.index = missing; this.lastMove = 'edit'; }
    } else if (this.index + 1 >= vis.length) {
      this.phase = 'summary';
    } else {
      this.index += 1; this.lastMove = 'forward';
    }
  }
}
