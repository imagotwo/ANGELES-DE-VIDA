<?php
/* =================================================================
   CONFIGURACIÓN DEL ENVÍO DE CORREO — PLANTILLA
   1. Copia este archivo y renómbralo a  config.php  (en la misma carpeta).
   2. Rellena los datos de config.php. NUNCA subas config.php a GitHub
      (ya está en .gitignore) porque contiene la contraseña del correo.
   3. En Hostinger: crea primero la cuenta de correo de tu dominio
      (Panel → Correos electrónicos) y revisa allí los datos SMTP; los de
      abajo son los que Hostinger publica habitualmente.
   ================================================================= */
return [
    // Servidor de correo saliente (SMTP) de Hostinger
    'smtp_host'   => 'smtp.hostinger.com',
    'smtp_port'   => 465,          // 465 = SSL
    'smtp_secure' => 'ssl',

    // Cuenta de correo DE TU DOMINIO que envía los mensajes (creada en Hostinger)
    'smtp_user'   => 'formulario@tu-dominio.com',
    'smtp_pass'   => 'CONTRASEÑA-DE-ESA-CUENTA',

    // Nombre que verás como remitente
    'from_name'   => 'Ángeles de Vida · Web',

    // Correo donde quieres RECIBIR las solicitudes (tu Gmail)
    'to_email'    => 'tu-correo@gmail.com',

    // true  = no envía correo: solo comprueba los datos y responde "ok" (para probar).
    // false = envía de verdad. Cámbialo a false cuando todo esté configurado.
    'modo_prueba' => true,
];
