/* Validaciones puras (sin DOM): devuelven { ok:true, value } o { ok:false, error }. */

export const LIMITS = {
  nombre: 80, correo: 120, direccion: 160, hospital: 120,
  paciente: 80, diagnostico: 600, condicion: 800, edadMax: 120,
};

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ok = (value) => ({ ok: true, value });
const fail = (error) => ({ ok: false, error });

/** Una sola línea: sin caracteres de control, espacios colapsados y recortados. */
export const cleanLine = (s) => String(s ?? '').replace(CONTROL, '').replace(/\s+/g, ' ').trim();
/** Texto largo: conserva saltos de línea razonables. */
export const cleanText = (s) =>
  String(s ?? '').replace(CONTROL, '').replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

export function validateText(raw, { max, empty, letters = false, multiline = false }) {
  const v = multiline ? cleanText(raw) : cleanLine(raw);
  if (!v) return fail(empty);
  if (letters && !/\p{L}/u.test(v)) return fail('Este dato debe incluir letras.');
  if (v.length > max) return fail(`Es demasiado largo: el máximo es ${max} caracteres (llevas ${v.length}).`);
  return ok(v);
}

export const validateName = (raw, empty = 'Escribe tu nombre y apellido para continuar.') =>
  validateText(raw, { max: LIMITS.nombre, empty, letters: true });

export function validatePhone(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return fail('Escribe un número de teléfono o WhatsApp para continuar.');
  if (!/^\+?[\d\s().-]+$/.test(v))
    return fail('Usa solo números. Puedes incluir el indicativo, por ejemplo +57 300 123 4567.');
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15)
    return fail('El número debe tener entre 7 y 15 dígitos. Ejemplo: 300 123 4567.');
  return ok(v.replace(/\s+/g, ' '));
}

export function validateEmail(raw) {
  const v = cleanLine(raw);
  if (!v) return fail('Escribe tu correo electrónico para continuar.');
  if (v.length > LIMITS.correo) return fail(`El correo es demasiado largo (máximo ${LIMITS.correo} caracteres).`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.includes('..'))
    return fail('Este correo no parece válido. Revisa que tenga el formato nombre@dominio.com.');
  return ok(v);
}

export function validateAge(raw) {
  const v = cleanLine(raw);
  if (!v) return fail('Escribe la edad del paciente para continuar.');
  if (!/^\d+$/.test(v)) {
    if (/^-/.test(v)) return fail('La edad no puede ser negativa.');
    if (/[.,]/.test(v)) return fail('Escribe la edad en años completos, sin decimales.');
    return fail('Escribe la edad solo con números, por ejemplo 78.');
  }
  const n = Number(v);
  if (n > LIMITS.edadMax) return fail(`Revisa la edad: debe estar entre 0 y ${LIMITS.edadMax} años.`);
  return ok(n);
}

/* ---------- Fechas ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const todayISO = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** Acepta AAAA-MM-DD (input date) o dd/mm/aaaa (escrito a mano). Devuelve ISO o null. */
export function parseDate(input) {
  const s = cleanLine(input);
  let y, m, d, t;
  if ((t = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [y, m, d] = t.slice(1).map(Number);
  else if ((t = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = t.slice(1).map(Number);
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
export const formatDMY = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const BAD_DATE = 'Esa fecha no es válida. Usa el formato dd/mm/aaaa, por ejemplo 15/11/2026.';

export function validateStartDate(raw, now = new Date()) {
  if (!cleanLine(raw)) return fail('Elige la fecha en que quieres iniciar el servicio.');
  const iso = parseDate(raw);
  if (!iso) return fail(BAD_DATE);
  if (iso < todayISO(now)) return fail('La fecha de inicio no puede ser anterior a hoy.');
  return ok(iso);
}

export function validateEndDate(raw, startISO, now = new Date()) {
  if (!cleanLine(raw)) return fail('Elige la fecha en que termina el servicio.');
  const iso = parseDate(raw);
  if (!iso) return fail(BAD_DATE);
  if (iso < todayISO(now)) return fail('La fecha de finalización no puede ser anterior a hoy.');
  if (startISO && iso < startISO)
    return fail(`La fecha de finalización no puede ser anterior a la de inicio (${formatDMY(startISO)}).`);
  return ok(iso);
}

export function validateChoice(raw, options) {
  const hit = options.find((o) => o.value === raw);
  return hit ? ok(hit.value) : fail('Elige una de las opciones disponibles.');
}

export function validateConsent(raw, { requireRepresentative }, now = new Date()) {
  if (!raw || raw.tratamiento !== true)
    return fail('Para continuar necesito tu autorización para el tratamiento de los datos.');
  if (requireRepresentative && raw.representante !== true)
    return fail('Confirma que eres el paciente o su representante autorizado para entregar sus datos.');
  return ok({
    tratamiento: true,
    representante: raw.representante === true,
    at: raw.at || now.toISOString(),
  });
}
