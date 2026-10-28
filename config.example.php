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

    // ---------- Reseñas de Google (carrusel de #testimonios, resenas.php) ----------
    // 'fuente': de dónde salen las reseñas
    //   'demo'     → reseñas de EJEMPLO (assets/data/resenas-demo.json). El carrusel avisa que son de ejemplo.
    //   'places'   → Places API (New). Fácil: solo API key + Place ID. Límite de Google: 5 reseñas,
    //                elegidas por relevancia (no por fecha).
    //   'business' → Google Business Profile API. Hasta 9 reseñas, las más recientes primero.
    //                Requiere aprobación de Google y autorización (OAuth) del dueño del perfil.
    // Siempre se muestran solo reseñas con comentario y de 4-5 estrellas.
    'resenas' => [
        'fuente'        => 'demo',
        // Cada cuánto se vuelve a preguntar a Google (minutos). Entre medias se usa la copia guardada
        // en php/cache/. 60 = las reseñas nuevas aparecen como mucho 1 hora después.
        'cache_minutos' => 60,
        // Enlace "Ver todas en Google" (Google Maps de la ficha). Vacío = en 'places' se usa el de Google.
        'url_perfil'    => '',

        // PLACES: Google Cloud Console → crea un proyecto → "APIs y servicios" → habilita
        // "Places API (New)" → Credenciales → Crear clave de API. Restringe la clave a esa API.
        // Place ID: búscalo en https://developers.google.com/maps/documentation/places/web-service/place-id
        'places' => [
            'api_key'  => '',
            'place_id' => '',
        ],

        // BUSINESS PROFILE (una sola vez):
        // 1. Google Cloud Console → solicita acceso a la "Business Profile API" (formulario de Google,
        //    gratis, tarda unos días). Cuando lo aprueben, habilita "Google My Business API".
        // 2. Credenciales → ID de cliente OAuth (tipo "Aplicación web"), con URI de redirección
        //    https://developers.google.com/oauthplayground  → copia client_id y client_secret.
        // 3. En https://developers.google.com/oauthplayground (engranaje → "Use your own OAuth
        //    credentials") autoriza el permiso https://www.googleapis.com/auth/business.manage
        //    CON LA CUENTA DUEÑA DEL PERFIL y canjea el código → copia el refresh_token.
        // 4. account_id y location_id: solo los números (accounts/123… y locations/456…).
        'business' => [
            'client_id'     => '',
            'client_secret' => '',
            'refresh_token' => '',
            'account_id'    => '',
            'location_id'   => '',
        ],
    ],
];
