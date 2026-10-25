// Ejecutar con:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_CONFIG as cfg } from '../assets/chat/config.js';
import * as V from '../assets/chat/validators.js';
import { Conversation, UNKNOWN_DIAGNOSIS } from '../assets/chat/flow.js';
import { buildWhatsappMessage, buildWhatsappUrl, normalizeWhatsappNumber, summarySections, validateAll } from '../assets/chat/summary.js';

const NOW = new Date(2026, 9, 24, 10, 15); // 24/10/2026 10:15 (hora local)
const newConv = (over = {}) => new Conversation({ ...cfg, ...over }, { now: () => NOW });

/** Responde todo el flujo con datos válidos. */
function fill(conv, { lugar = 'casa', skipConsentRep = false } = {}) {
  conv.start();
  const seq = {
    nombre: '  Ana   María Gómez ', telefono: '300 123 4567', correo: 'ana@correo.com',
    servicio: 'Postoperatorio', modalidad: '24 horas', fecha_inicio: '2026-11-02', fecha_fin: '2026-11-09',
    lugar, direccion: 'Calle 100 # 15-20, Usaquén', hospital: 'Clínica del Country',
    autorizacion: { tratamiento: true, representante: !skipConsentRep },
    paciente: 'José Gómez', edad: '82', diagnostico: 'Hipertensión\ny diabetes', condicion: 'Permanece en cama, usa sonda.',
  };
  while (conv.phase === 'form') {
    const id = conv.current().id;
    const r = conv.submit(seq[id]);
    assert.ok(r.ok, `${id}: ${r.error}`);
  }
}

test('nombre: recorta espacios, exige letras', () => {
  assert.equal(V.validateName('  Ana   Gómez ').value, 'Ana Gómez');
  assert.equal(V.validateName('   ').ok, false);
  assert.equal(V.validateName('1234').ok, false);
});

test('teléfono: acepta formatos colombianos e internacionales, rechaza basura', () => {
  for (const ok of ['300 123 4567', '3001234567', '+57 300 123 4567', '(601) 234-5678', '+1 415 555 2671']) assert.ok(V.validatePhone(ok).ok, ok);
  for (const bad of ['', '12345', 'abc1234567', '300-123-45x7', '+57 300 123 4567 8901 234']) assert.equal(V.validatePhone(bad).ok, false, bad);
});

test('correo: valida formato', () => {
  assert.ok(V.validateEmail(' ana@correo.com ').ok);
  for (const bad of ['', 'ana', 'ana@', 'ana@correo', 'a b@c.com', 'ana@@c.com', 'ana@c..com']) assert.equal(V.validateEmail(bad).ok, false, bad);
});

test('edad: rango 0–120, sin negativos ni decimales', () => {
  assert.equal(V.validateAge('82').value, 82);
  assert.equal(V.validateAge('0').ok, true);
  for (const bad of ['', '-3', '7.5', '7,5', '121', 'ochenta']) assert.equal(V.validateAge(bad).ok, false, bad);
});

test('fechas: no pasadas, formato dd/mm/aaaa y calendario real', () => {
  assert.equal(V.parseDate('15/11/2026'), '2026-11-15');
  assert.equal(V.parseDate('2026-11-15'), '2026-11-15');
  assert.equal(V.parseDate('31/02/2026'), null);
  assert.equal(V.formatDMY('2026-11-05'), '05/11/2026');
  assert.equal(V.validateStartDate('2026-10-24', NOW).ok, true);   // hoy vale
  assert.equal(V.validateStartDate('2026-10-23', NOW).ok, false);  // ayer no
  assert.equal(V.validateStartDate('', NOW).ok, false);
});

test('fecha final: nunca anterior a la inicial', () => {
  assert.equal(V.validateEndDate('2026-11-02', '2026-11-02', NOW).ok, true);
  const r = V.validateEndDate('2026-11-01', '2026-11-02', NOW);
  assert.equal(r.ok, false);
  assert.match(r.error, /02\/11\/2026/);
});

test('flujo: orden correcto y bloque de lugar condicional', () => {
  const c = newConv(); c.start();
  const ids = () => c.visible.map((s) => s.id);
  assert.deepEqual(ids().slice(0, 3), ['nombre', 'telefono', 'correo']);
  assert.ok(!ids().includes('direccion'));
  c.answers.lugar = 'casa';
  assert.ok(ids().includes('direccion') && !ids().includes('hospital'));
  c.answers.lugar = 'hospital';
  assert.ok(ids().includes('direccion') && ids().includes('hospital'));
  assert.ok(ids().indexOf('autorizacion') < ids().indexOf('paciente'), 'la autorización va antes de los datos de salud');
});

test('flujo: campos obligatorios no avanzan con valores inválidos y conservan lo demás', () => {
  const c = newConv(); c.start();
  assert.equal(c.submit('').ok, false);
  assert.equal(c.current().id, 'nombre');
  assert.ok(c.submit('Ana Gómez').ok);
  assert.equal(c.submit('123').ok, false);
  assert.equal(c.answers.nombre, 'Ana Gómez');
});

test('flujo: retroceder conserva respuestas; no se puede retroceder en la primera', () => {
  const c = newConv(); c.start();
  assert.equal(c.canBack(), false);
  c.submit('Ana Gómez'); c.submit('3001234567');
  assert.ok(c.back());
  assert.equal(c.current().id, 'telefono');
  assert.equal(c.answers.telefono, '3001234567');
  assert.equal(c.lastMove, 'back');
});

test('flujo: completo → resumen; sin autorización no se avanza', () => {
  const c = newConv(); fill(c);
  assert.equal(c.phase, 'summary');

  const d = newConv(); d.start();
  while (d.current().id !== 'autorizacion') {
    const id = d.current().id;
    d.submit({ nombre: 'Ana', telefono: '3001234567', correo: 'a@b.co', servicio: 'Curaciones', modalidad: 'Turno de día', fecha_inicio: '2026-11-02', fecha_fin: '2026-11-02', lugar: 'casa', direccion: 'Calle 1' }[id]);
  }
  assert.equal(d.submit({ tratamiento: false, representante: true }).ok, false);
  assert.equal(d.submit(undefined).ok, false);
  assert.equal(d.submit({ tratamiento: true, representante: false }).ok, false, 'falta la declaración de representante');
  assert.equal(d.current().id, 'autorizacion');
  assert.ok(d.submit({ tratamiento: true, representante: true }).ok);
});

test('flujo: editar desde el resumen vuelve al resumen; cambiar lugar pide lo que falta y borra lo obsoleto', () => {
  const c = newConv(); fill(c, { lugar: 'hospital' });
  assert.ok(c.answers.hospital);
  assert.ok(c.goTo('lugar'));
  assert.ok(c.submit('casa').ok);
  assert.equal(c.phase, 'summary');
  assert.equal('hospital' in c.answers, false, 'el hospital ya no aplica');

  assert.ok(c.goTo('lugar'));
  assert.ok(c.submit('hospital').ok);
  assert.equal(c.phase, 'form');
  assert.equal(c.current().id, 'hospital', 'pide el dato que ahora falta');
  assert.ok(c.submit('Clínica Reina Sofía').ok);
  assert.equal(c.phase, 'summary');
});

test('flujo: cancelar la corrección vuelve al resumen sin cambios', () => {
  const c = newConv(); fill(c);
  const before = JSON.stringify(c.answers);
  c.goTo('nombre');
  assert.ok(c.back());
  assert.equal(c.phase, 'summary');
  assert.equal(JSON.stringify(c.answers), before);
});

test('diagnóstico: «No lo conozco» solo si el negocio lo permite', () => {
  const c = newConv(); fill(c);
  c.goTo('diagnostico');
  assert.equal(c.submit(UNKNOWN_DIAGNOSIS).value, 'No lo conozco');

  const d = newConv({ allowUnknownDiagnosis: false }); d.start();
  d.steps.find((s) => s.id === 'diagnostico'); // sin botón rápido
  assert.deepEqual(d.steps.find((s) => s.id === 'diagnostico').quick, []);
});

test('resumen: contiene todas las respuestas, agrupadas', () => {
  const c = newConv(); fill(c, { lugar: 'hospital' });
  const flat = summarySections(c).flatMap((s) => s.rows.map((r) => `${r.label}=${r.value}`)).join('|');
  for (const t of ['Ana María Gómez', '300 123 4567', 'ana@correo.com', 'Postoperatorio', '24 horas', '02/11/2026', '09/11/2026', 'Hospital', 'Clínica del Country', 'José Gómez', '82 años', 'Hipertensión', 'Permanece en cama'])
    assert.ok(flat.includes(t), `falta ${t}`);
  assert.deepEqual(summarySections(c).map((s) => s.title), ['Datos del solicitante', 'Datos del servicio', 'Datos del paciente']);
  assert.ok(validateAll(c).ok);
});

test('mensaje de WhatsApp: plantilla completa, una línea por dato, autorización con fecha', () => {
  const c = newConv(); fill(c, { lugar: 'casa' });
  const m = buildWhatsappMessage(c.answers, cfg.businessName);
  assert.ok(m.startsWith('SOLICITUD DE SERVICIO DE ENFERMERÍA\nÁNGELES DE VIDA\n'));
  assert.ok(m.endsWith('FIN DE LA SOLICITUD'));
  for (const l of ['Nombre: Ana María Gómez', 'Teléfono / WhatsApp: 300 123 4567', 'Correo: ana@correo.com', 'Servicio solicitado: Postoperatorio',
    'Modalidad / horario: 24 horas', 'Fecha de inicio: 02/11/2026', 'Fecha de finalización: 09/11/2026', 'Lugar de prestación: Casa',
    'Dirección: Calle 100 # 15-20, Usaquén', 'Edad: 82', 'Diagnóstico(s): Hipertensión y diabetes', 'Condición del paciente: Permanece en cama, usa sonda.'])
    assert.ok(m.split('\n').includes(l), `falta línea: ${l}`);
  assert.match(m, /Autorización para gestionar la solicitud: Otorgada por el solicitante en el asistente web \(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\)\./);
  assert.ok(!m.includes('Hospital o clínica'), 'sin hospital si el lugar es casa');
});

test('mensaje: hospital incluye el nombre; sin autorización no se genera', () => {
  const c = newConv(); fill(c, { lugar: 'hospital' });
  assert.ok(buildWhatsappMessage(c.answers).includes('Hospital o clínica: Clínica del Country'));
  const sinAut = { ...c.answers }; delete sinAut.autorizacion;
  assert.throws(() => buildWhatsappMessage(sinAut), /autorización/);
});

test('enlace: wa.me con número configurado y texto codificado (tildes, saltos, símbolos)', () => {
  const c = newConv(); fill(c);
  c.answers.condicion = 'Camina con ayuda & usa "sonda" #1 — ñandú 100%';
  const msg = buildWhatsappMessage(c.answers);
  const url = buildWhatsappUrl('573132957599', msg);
  assert.ok(url.startsWith('https://wa.me/573132957599?text='));
  const decoded = new URL(url).searchParams.get('text'); // searchParams ya decodifica una vez
  assert.equal(decoded, msg, 'ida y vuelta sin pérdida');
  assert.ok(url.includes('%0A') && url.includes('%C3%81NGELES') && !url.includes('\n'));
  assert.ok(decoded.includes('ñandú 100%') && decoded.includes('& usa "sonda" #1'));
});

test('número de WhatsApp: solo dígitos y longitud internacional', () => {
  assert.equal(normalizeWhatsappNumber('573132957599'), '573132957599');
  assert.equal(normalizeWhatsappNumber('+57 313 295 7599'), '573132957599');
  assert.equal(normalizeWhatsappNumber(''), null);
  assert.equal(normalizeWhatsappNumber('123'), null);
  assert.equal(normalizeWhatsappNumber(undefined), null);
});

test('reiniciar borra todo el estado', () => {
  const c = newConv(); fill(c);
  c.reset();
  assert.deepEqual(c.answers, {});
  assert.equal(c.phase, 'welcome');
});
