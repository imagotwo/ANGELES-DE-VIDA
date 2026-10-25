/* Resumen legible, revalidación final y mensaje/enlace de WhatsApp (sin DOM). */
import { SECTIONS } from './flow.js';
import { formatDMY } from './validators.js';

export function displayValue(step, value) {
  if (step.display) return step.display(value);
  if (step.kind === 'choice') return step.options.find((o) => o.value === value)?.label ?? String(value);
  if (step.kind === 'date') return formatDMY(value);
  return String(value);
}

/** Secciones del resumen con las respuestas reales. */
export function summarySections(conv) {
  return SECTIONS.map((sec) => ({
    title: sec.title,
    rows: conv.visible
      .filter((s) => s.section === sec.id && s.id in conv.answers)
      .map((s) => ({ stepId: s.id, label: s.label, value: displayValue(s, conv.answers[s.id]) })),
  })).filter((s) => s.rows.length);
}

/** Antes de abrir WhatsApp: todas las preguntas aplicables deben seguir siendo válidas. */
export function validateAll(conv) {
  for (const step of conv.visible) {
    if (!(step.id in conv.answers)) return { ok: false, stepId: step.id, error: `Falta responder: ${step.label}.` };
    const r = step.validate(conv.answers[step.id], { answers: conv.answers, now: conv.now(), cfg: conv.cfg });
    if (!r.ok) return { ok: false, stepId: step.id, error: r.error };
  }
  return { ok: true };
}

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const flat = (s) => String(s).replace(/\s*\n\s*/g, ' ').trim(); // una respuesta = una línea en el mensaje

function consentLine(consent) {
  if (!consent?.tratamiento) throw new Error('No hay autorización registrada: no se puede preparar el mensaje.');
  let t = `Otorgada por el solicitante en el asistente web (${stamp(new Date(consent.at))}).`;
  if (consent.representante) t += ' Declara ser el paciente o su representante autorizado.';
  return t;
}

export function buildWhatsappMessage(a, businessName = 'ÁNGELES DE VIDA') {
  const lugar = a.lugar === 'hospital' ? 'Hospital' : 'Casa';
  const servicio = [
    `Servicio solicitado: ${a.servicio}`,
    `Modalidad / horario: ${a.modalidad}`,
    `Fecha de inicio: ${formatDMY(a.fecha_inicio)}`,
    `Fecha de finalización: ${formatDMY(a.fecha_fin)}`,
    `Lugar de prestación: ${lugar}`,
    a.direccion ? `Dirección: ${flat(a.direccion)}` : null,
    a.lugar === 'hospital' && a.hospital ? `Hospital o clínica: ${flat(a.hospital)}` : null,
  ].filter(Boolean);

  return [
    'SOLICITUD DE SERVICIO DE ENFERMERÍA', businessName, '',
    'DATOS DEL SOLICITANTE',
    `Nombre: ${flat(a.nombre)}`, `Teléfono / WhatsApp: ${flat(a.telefono)}`, `Correo: ${flat(a.correo)}`, '',
    'DATOS DEL SERVICIO', ...servicio, '',
    'DATOS DEL PACIENTE',
    `Nombre: ${flat(a.paciente)}`, `Edad: ${a.edad}`,
    `Diagnóstico(s): ${flat(a.diagnostico)}`, `Condición del paciente: ${flat(a.condicion)}`, '',
    `Autorización para gestionar la solicitud: ${consentLine(a.autorizacion)}`, '',
    `Solicito que el equipo de ${businessName} revise esta información y me contacte para confirmar la disponibilidad y los detalles del servicio.`, '',
    'FIN DE LA SOLICITUD',
  ].join('\n');
}

/** Devuelve solo dígitos si parece un número internacional válido; si no, null. */
export function normalizeWhatsappNumber(n) {
  const d = String(n ?? '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export const buildWhatsappUrl = (number, message) =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
