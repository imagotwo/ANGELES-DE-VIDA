/* =====================================================================
   ÁNGELES DE VIDA — Asistente de solicitudes · CONFIGURACIÓN
   Todo lo que el negocio puede/debe ajustar vive en este archivo.
   ===================================================================== */
export const CHAT_CONFIG = {
  businessName: 'ÁNGELES DE VIDA',

  /* Número de WhatsApp de la empresa (formato internacional, solo dígitos).
     Si se deja vacío, se toma del atributo data-whatsapp del formulario
     existente (#form-solicitud), así hay un único lugar donde cambiarlo. */
  whatsappNumber: '',

  /* Política de tratamiento de datos (ya existe en el sitio). */
  privacyUrl: 'privacidad.html',

  /* Avatar del encabezado (si no carga, se muestran las iniciales «AV»). */
  avatarUrl: 'assets/img/ENFERMERAS-ANGELES-DE-VIDA-FAVICON.png',

  /* Opciones copiadas del formulario real de index.html.
     value = lo que viaja en el mensaje · label = lo que ve la persona. */
  services: [
    'Cuidado en casa',
    'Adultos mayores',
    'Citas médicas',
    'Hospitalario',
    'Postoperatorio',
    'Curaciones',
  ].map((t) => ({ value: t, label: t })),

  schedules: ['Turno de día', 'Turno de noche', '24 horas', 'Por definir']
    .map((t) => ({ value: t, label: t })),

  places: [
    { value: 'casa', label: 'Casa' },
    { value: 'hospital', label: 'Hospital' },
  ],

  /* PENDIENTE DE VALIDACIÓN DEL NEGOCIO: ¿se acepta «No lo conozco» como
     respuesta al diagnóstico? true = se ofrece el botón y el equipo lo
     verifica después · false = el diagnóstico es obligatorio sin excepción. */
  allowUnknownDiagnosis: true,

  /* PENDIENTE DE VALIDACIÓN JURÍDICA: cuando quien escribe no es el paciente,
     el negocio debe definir cómo se acredita la facultad de entregar sus datos.
     Mientras tanto se pide una declaración expresa y separada. */
  requireRepresentativeDeclaration: true,

  typingDelayMs: { min: 450, max: 1000 },
  voice: { lang: 'es-CO', rate: 0.95 },
};
