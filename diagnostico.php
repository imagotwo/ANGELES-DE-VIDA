<?php
/* =================================================================
   ÁNGELES DE VIDA — diagnostico.php
   Página de comprobación para el servidor (HostGator). Revisa que todo lo
   que necesitan enviar.php y aplicar.php esté bien configurado:
     · versión de PHP y extensiones (openssl, fileinfo, mbstring, iconv)
     · límites de subida (hoja de vida de hasta 10 MB)
     · config.php sin datos de ejemplo
     · que config.php NO se pueda abrir desde el navegador (.htaccess)
     · conexión e inicio de sesión SMTP, y envío de un correo de prueba

   USO:  https://tusitio/diagnostico.php?clave=LA-CLAVE-DE-config.php
   SEGURIDAD:
     · Sin la clave correcta responde "404 No encontrado" (no revela que existe).
     · Nunca muestra contraseñas.
     · Cuando todo funcione: pon 'diag_clave' => '' en config.php o borra este archivo.
   ================================================================= */

declare(strict_types=1);
date_default_timezone_set('America/Bogota');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

// ---------- Acceso con clave ----------
$rutaConfig = __DIR__ . '/config.php';
$config = is_file($rutaConfig) ? require $rutaConfig : [];
$clave = (string)($config['diag_clave'] ?? '');
if (strlen($clave) < 16 || !hash_equals($clave, (string)($_GET['clave'] ?? ''))) {
    http_response_code(404);
    echo 'No encontrado';
    exit;
}

require __DIR__ . '/php/comun.php';

// ---------- Utilidades ----------
/** "12M" → bytes */
function aBytes(string $v): int
{
    $v = trim($v);
    $n = (int)$v;
    switch (strtoupper(substr($v, -1))) {
        case 'G': $n *= 1024;
        case 'M': $n *= 1024;
        case 'K': $n *= 1024;
    }
    return $n;
}
$filas = [];
/** Añade una fila al informe: estado 'ok' | 'aviso' | 'error' */
function fila(string $estado, string $que, string $detalle): void
{
    global $filas;
    $filas[] = [$estado, $que, $detalle];
}
$placeholder = fn(string $v): bool => $v === '' || (bool)preg_match('/tudominio|tu-dominio|tu-correo|CONTRASEÑA/i', $v);
$enmascarar = fn(string $v): string => preg_replace('/^(.{2}).*(@.*)$/', '$1•••$2', $v) ?? '•••';

// ---------- 1. PHP ----------
$v = PHP_VERSION;
fila(version_compare($v, '8.0', '>=') ? 'ok' : 'error', 'Versión de PHP', "$v (se necesita 8.0 o superior; recomendado 8.2)");

// ---------- 2. Extensiones ----------
fila(extension_loaded('openssl') ? 'ok' : 'error', 'Extensión openssl', extension_loaded('openssl') ? 'Activa (necesaria para el SMTP seguro).' : 'FALTA: sin ella no se puede enviar correo por SSL. Actívala en cPanel → Seleccionar versión de PHP → Extensiones.');
fila(extension_loaded('fileinfo') ? 'ok' : 'aviso', 'Extensión fileinfo', extension_loaded('fileinfo') ? 'Activa (confirma que la hoja de vida es un PDF real).' : 'No activa: aplicar.php solo comprobará la cabecera %PDF-. Recomendado activarla.');
fila(extension_loaded('mbstring') ? 'ok' : 'aviso', 'Extensión mbstring', extension_loaded('mbstring') ? 'Activa (tildes y ñ).' : 'No activa: funciona igual gracias a la alternativa de php/comun.php.');
fila(function_exists('iconv') ? 'ok' : 'aviso', 'Extensión iconv', function_exists('iconv') ? 'Activa (nombre del adjunto sin tildes).' : 'No activa: el adjunto se llamará "Hoja-de-vida-aspirante.pdf".');

// ---------- 3. Límites de subida ----------
$up = (string)ini_get('upload_max_filesize');
$post = (string)ini_get('post_max_size');
$okUp = aBytes($up) >= 10 * 1048576;
$okPost = aBytes($post) >= 11 * 1048576;
fila($okUp ? 'ok' : 'error', 'upload_max_filesize', "$up " . ($okUp ? '(suficiente para 10 MB)' : '→ súbelo a 12M: cPanel → Editor INI de MultiPHP (o Seleccionar versión de PHP → Opciones).'));
fila($okPost ? 'ok' : 'error', 'post_max_size', "$post " . ($okPost ? '(suficiente)' : '→ súbelo a 16M en el mismo sitio.'));

// ---------- 4. config.php ----------
if (!$config) {
    fila('error', 'config.php', 'No existe. Copia config.example.php como config.php y rellénalo.');
} else {
    foreach (['smtp_host' => 'Servidor SMTP', 'smtp_user' => 'Cuenta que envía', 'smtp_pass' => 'Contraseña SMTP', 'to_email' => 'Destino solicitudes', 'to_email_empleo' => 'Destino postulaciones'] as $k => $nombre) {
        $val = (string)($config[$k] ?? '');
        $mostrar = $k === 'smtp_pass' ? ($val === '' ? '(vacía)' : '•••••••• (oculta)') : (str_contains($k, 'user') || str_contains($k, 'email') ? $enmascarar($val) : $val);
        fila($placeholder($val) ? 'error' : 'ok', "config: $nombre", $placeholder($val) ? "$mostrar → todavía tiene el valor de ejemplo." : $mostrar);
    }
    fila('ok', 'config: puerto / cifrado', ($config['smtp_port'] ?? '?') . ' / ' . ($config['smtp_secure'] ?? '?'));
    fila(empty($config['modo_prueba']) ? 'ok' : 'aviso', 'config: modo_prueba',
        empty($config['modo_prueba']) ? 'false: los formularios envían correos reales.' : 'true: los formularios NO envían correo (solo validan). Cámbialo a false cuando el SMTP funcione.');
}

// ---------- 5. ¿config.php está protegido? (se pide al propio servidor por la web) ----------
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$base = $https . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/\\');
$codigo = 0;
if (function_exists('curl_init')) {
    $ch = curl_init("$base/config.php");
    curl_setopt_array($ch, [CURLOPT_NOBODY => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_SSL_VERIFYPEER => false]);
    curl_exec($ch);
    $codigo = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
}
if ($codigo === 0) fila('aviso', 'Protección de config.php', "No se pudo comprobar. Abre $base/config.php en el navegador: debe salir \"Forbidden\" (403).");
else fila($codigo === 403 || $codigo === 404 ? 'ok' : 'error', 'Protección de config.php', "$base/config.php responde $codigo " . ($codigo === 403 || $codigo === 404 ? '(bloqueado, correcto).' : '→ ¡NO está bloqueado! Revisa que .htaccess se haya subido.'));

// ---------- 6. Prueba SMTP (solo si se pide) ----------
$accion = (string)($_GET['probar'] ?? '');
$resultadoSmtp = null;
if ($config && in_array($accion, ['conexion', 'correo'], true)) {
    $mail = crearMailer($config);
    $mail->Timeout = 15;
    try {
        if ($accion === 'conexion') {
            $ok = $mail->smtpConnect();          // conecta e inicia sesión, sin enviar nada
            $mail->smtpClose();
            $resultadoSmtp = $ok ? ['ok', 'Conexión e inicio de sesión SMTP correctos.'] : ['error', 'No se pudo conectar: ' . $mail->ErrorInfo];
        } else {
            $mail->addAddress($config['to_email']);
            $mail->Subject = 'Prueba de correo — Ángeles de Vida';
            $mail->Body    = '<p>Si recibes este correo, el envío de los formularios de la web funciona correctamente.</p><p>Enviado el ' . date('d/m/Y H:i') . ' desde diagnostico.php.</p>';
            $mail->AltBody = 'Si recibes este correo, el envío de los formularios de la web funciona correctamente.';
            $mail->send();
            $resultadoSmtp = ['ok', 'Correo de prueba enviado a ' . $enmascarar((string)$config['to_email']) . '. Revisa también la carpeta de spam.'];
        }
    } catch (Throwable $e) {
        $resultadoSmtp = ['error', 'Falló: ' . ($mail->ErrorInfo ?: $e->getMessage())];
    }
}

// ---------- Informe ----------
$errores = count(array_filter($filas, fn($f) => $f[0] === 'error'));
$q = 'clave=' . rawurlencode($clave);
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Diagnóstico — Ángeles de Vida</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem 1rem; background: #f5f7fb; color: #1d2b3a; }
    main { max-width: 900px; margin: 0 auto; }
    h1 { margin: 0 0 .25rem; font-size: 1.6rem; } p.sub { margin: 0 0 1.5rem; color: #5b6b7b; }
    .resumen { padding: 1rem 1.25rem; border-radius: .6rem; margin-bottom: 1.5rem; font-weight: 600; }
    .resumen.ok { background: #e3f6ea; color: #17643a; } .resumen.error { background: #fde8e6; color: #9b2316; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: .6rem; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.05); }
    td { padding: .7rem 1rem; border-bottom: 1px solid #eef1f5; vertical-align: top; font-size: .95rem; }
    td:first-child { width: 2.5rem; text-align: center; font-size: 1.1rem; } td:nth-child(2) { width: 30%; font-weight: 600; }
    .acciones { margin: 1.5rem 0; display: flex; gap: .75rem; flex-wrap: wrap; }
    .acciones a { padding: .7rem 1.2rem; border-radius: 999px; background: #2F6EAD; color: #fff; text-decoration: none; font-weight: 600; }
    .acciones a.sec { background: #fff; color: #2F6EAD; border: 1px solid #2F6EAD; }
    .smtp { padding: 1rem 1.25rem; border-radius: .6rem; margin-top: 1rem; } .smtp.ok { background: #e3f6ea; } .smtp.error { background: #fde8e6; }
    .nota { margin-top: 2rem; font-size: .9rem; color: #5b6b7b; }
  </style>
</head>
<body>
<main>
  <h1>Diagnóstico del servidor</h1>
  <p class="sub">Ángeles de Vida · <?= h(date('d/m/Y H:i')) ?> · <?= h($_SERVER['HTTP_HOST'] ?? '') ?></p>

  <div class="resumen <?= $errores ? 'error' : 'ok' ?>">
    <?= $errores ? "Hay $errores punto(s) por corregir (en rojo)." : 'Todo lo comprobado está correcto.' ?>
  </div>

  <table>
    <?php foreach ($filas as [$estado, $que, $detalle]): ?>
      <tr>
        <td><?= $estado === 'ok' ? '✅' : ($estado === 'aviso' ? '⚠️' : '❌') ?></td>
        <td><?= h($que) ?></td>
        <td><?= h($detalle) ?></td>
      </tr>
    <?php endforeach; ?>
  </table>

  <h2>Correo (SMTP)</h2>
  <div class="acciones">
    <a href="?<?= h($q) ?>&amp;probar=conexion">1. Probar conexión SMTP</a>
    <a class="sec" href="?<?= h($q) ?>&amp;probar=correo">2. Enviar correo de prueba</a>
  </div>
  <?php if ($resultadoSmtp): ?>
    <div class="smtp <?= h($resultadoSmtp[0]) ?>"><?= $resultadoSmtp[0] === 'ok' ? '✅ ' : '❌ ' ?><?= h($resultadoSmtp[1]) ?></div>
  <?php endif; ?>

  <p class="nota">Cuando todo esté en verde y el correo de prueba haya llegado: en <code>config.php</code> pon
    <code>'modo_prueba' =&gt; false</code> y desactiva esta página con <code>'diag_clave' =&gt; ''</code> (o borra
    <code>diagnostico.php</code> del servidor).</p>
</main>
</body>
</html>
