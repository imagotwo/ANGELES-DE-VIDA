<?php
/* =================================================================
   CONFIGURACIÓN DEL ENVÍO DE CORREO — PLANTILLA (HostGator)
   Lo usan enviar.php (solicitudes de servicio), aplicar.php
   (postulaciones con hoja de vida) y diagnostico.php.

   1. Copia este archivo y renómbralo a  config.php  (en la misma carpeta).
   2. Elige UNA de las opciones de SMTP de abajo (A, B o C) y rellénala.
   3. NUNCA subas config.php a GitHub (está en .gitignore): tiene contraseñas.

   OPCIONES DE SMTP (servidor que envía los correos):
   ─ A. Correo de cPanel (cuando tengas dominio)
        cPanel → Cuentas de correo electrónico → crea p. ej. formulario@tudominio.com
        → "Conectar dispositivos" (o "Configurar cliente de correo"): ahí aparecen
        el "Servidor saliente" y el puerto SSL/TLS. Suele ser mail.tudominio.com : 465.
        Copia EXACTAMENTE lo que muestre cPanel.
   ─ B. Correo Titan (el gratuito el 1.er año de HostGator, si eliges Titan)
        smtp_host 'smtp.titan.email', puerto 465, ssl, usuario = tu correo Titan.
   ─ C. Gmail PROVISIONAL (funciona hoy, sin dominio)
        smtp_host 'smtp.gmail.com', puerto 465, ssl.
        smtp_user = tu dirección de Gmail; smtp_pass = una "contraseña de aplicación"
        de 16 letras (NO tu contraseña normal): Cuenta de Google → Seguridad →
        Verificación en 2 pasos (activarla) → Contraseñas de aplicaciones.
        Límite de Gmail: unos 500 correos al día (de sobra para estos formularios).
        Cuando tengas dominio, cambia a A o B: el remitente de tu dominio da más confianza.
   ================================================================= */
return [
    // ---------- Servidor de correo saliente (SMTP) ----------
    'smtp_host'   => 'mail.tudominio.com',   // A: lo que diga cPanel · B: smtp.titan.email · C: smtp.gmail.com
    'smtp_port'   => 465,                    // 465 = SSL (las tres opciones)
    'smtp_secure' => 'ssl',                  // 'ssl' para 465 · 'tls' si usaras el puerto 587

    // Cuenta que ENVÍA los mensajes (el remitente). Debe ser la misma cuenta del SMTP.
    'smtp_user'   => 'formulario@tudominio.com',
    'smtp_pass'   => 'CONTRASEÑA-DE-ESA-CUENTA',

    // Nombre que verás como remitente
    'from_name'   => 'Ángeles de Vida · Web',

    // ---------- Destinatarios ----------
    // Donde quieres RECIBIR las solicitudes de servicio (enviar.php)
    'to_email'        => 'tu-correo@gmail.com',
    // Donde quieres RECIBIR las postulaciones con hoja de vida (aplicar.php). Puede ser otro.
    'to_email_empleo' => 'seleccion@tudominio.com',

    // ---------- Modo prueba ----------
    // true  = no envía correo: solo comprueba los datos y responde "ok".
    // false = envía de verdad. Cámbialo a false cuando el SMTP esté configurado.
    'modo_prueba' => true,

    // ---------- Página de diagnóstico (diagnostico.php) ----------
    // Clave para abrirla: https://tusitio/diagnostico.php?clave=ESTA-CLAVE
    // Usa una clave larga y difícil (mínimo 16 caracteres). Déjala vacía ('') para
    // desactivar la página, y bórrala del servidor cuando todo funcione.
    'diag_clave'  => '',
];
