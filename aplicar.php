<?php
/* =================================================================
   ÁNGELES DE VIDA — aplicar.php
   Recibe el formulario "Trabaja con nosotros" (trabaja-con-nosotros.html,
   main.js bloque 11) y envía la postulación con la hoja de vida en PDF
   como ADJUNTO al correo de selección ('to_email_empleo' en config.php).

   Flujo:
   1. Solo POST; responde siempre en JSON: { ok: true|false, error?: "..." }.
      Si el envío supera el límite del servidor (post_max_size), PHP llega
      sin datos: se detecta y se avisa de que el archivo es demasiado grande.
   2. Antispam: si el campo trampa "web" llega relleno, finge éxito y no envía.
   3. Valida todos los campos y el PDF:
      - que haya subido bien y no pase de 2 MB (MAX_MB),
      - que sea un PDF DE VERDAD (por su contenido, no solo por la extensión).
   4. Envía el correo con el PDF adjunto. "Responder a" = correo del aspirante.
   El PDF NO se guarda en el servidor: PHP lo deja en una carpeta temporal y
   lo borra solo al terminar esta petición.
   ================================================================= */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Bogota');
require __DIR__ . '/php/comun.php';

use PHPMailer\PHPMailer\Exception as MailException;

const MAX_MB = 2;    // tamaño máximo de la hoja de vida (debe coincidir con data-max-mb del HTML)
const MIN_MENSAJE = 100;    // caracteres mínimos de "Cuéntanos sobre ti" (el máximo, 1500, va en texto())

// ---------- 1. Solo POST ----------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    responder(405, ['ok' => false, 'error' => 'Método no permitido.']);
}
// Envío más grande que post_max_size: PHP descarta TODO ($_POST y $_FILES vacíos)
if (empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    responder(413, ['ok' => false, 'error' => 'El archivo es demasiado grande. El máximo es ' . MAX_MB . ' MB.']);
}
$config = cargarConfig();

// ---------- 2. Antispam (campo trampa) ----------
if (trim((string)($_POST['web'] ?? '')) !== '') {
    responder(200, ['ok' => true]);
}

// ---------- 3. Validación de los datos ----------
$tiposDoc = ['Cédula de ciudadanía', 'Cédula de extranjería', 'PPT (Permiso por Protección Temporal)', 'Pasaporte'];
// Deben coincidir EXACTAMENTE con las opciones de trabaja-con-nosotros.html
$ciudades = ['Bogotá', 'Cajicá', 'Chía', 'Chipaque', 'Cota', 'Funza', 'La Calera', 'Madrid', 'Mosquera', 'Sibaté', 'Soacha', 'Tenjo'];
$localidades = ['Antonio Nariño', 'Barrios Unidos', 'Bosa', 'Chapinero', 'Ciudad Bolívar', 'Engativá', 'Fontibón', 'Kennedy', 'La Candelaria', 'Los Mártires', 'Puente Aranda', 'Rafael Uribe Uribe', 'San Cristóbal', 'Santa Fe', 'Suba', 'Sumapaz', 'Teusaquillo', 'Tunjuelito', 'Usaquén', 'Usme'];
$perfiles = ['Auxiliar de enfermería', 'Enfermero(a) profesional', 'Cuidador(a)', 'Otro'];

$d = [
    'nombre'         => campo('nombre', 60),
    'apellido'       => campo('apellido', 60),
    'tipo_documento' => campo('tipo_documento', 60),
    'documento'      => campo('documento', 20),
    'telefono'       => campo('telefono', 20),
    'correo'         => campo('correo', 120),
    'ciudad'         => campo('ciudad', 30),
    'localidad'      => campo('localidad', 30),
    'direccion'      => campo('direccion', 160),
    'perfil'         => campo('perfil', 40),
    'perfil_detalle' => campo('perfil_detalle', 160),
    'mensaje'        => texto('mensaje', 1500),
    'acepto'         => campo('acepto', 2),
];

$errores = [];
foreach (['nombre', 'apellido', 'tipo_documento', 'documento', 'telefono', 'correo', 'ciudad', 'localidad', 'direccion', 'perfil', 'mensaje'] as $c) {
    if ($d[$c] === '') $errores[] = $c;
}
if ($d['mensaje'] !== '' && preg_match_all('/./us', $d['mensaje']) < MIN_MENSAJE) $errores[] = 'mensaje';   // cuenta letras, no bytes
if ($d['tipo_documento'] !== '' && !in_array($d['tipo_documento'], $tiposDoc, true)) $errores[] = 'tipo_documento';
if ($d['documento'] !== '' && strlen(preg_replace('/[^0-9a-z]/i', '', $d['documento'])) < 5) $errores[] = 'documento';
if ($d['correo'] !== '' && !filter_var($d['correo'], FILTER_VALIDATE_EMAIL)) $errores[] = 'correo';
if ($d['telefono'] !== '' && strlen(preg_replace('/\D/', '', $d['telefono'])) < 7) $errores[] = 'telefono';
if ($d['ciudad'] !== '' && !in_array($d['ciudad'], $ciudades, true)) $errores[] = 'ciudad';
// Bogotá lleva una de sus localidades; cualquier otra ciudad, "No aplica"
if ($d['localidad'] !== '' && !($d['ciudad'] === 'Bogotá' ? in_array($d['localidad'], $localidades, true) : $d['localidad'] === 'No aplica')) $errores[] = 'localidad';
if ($d['perfil'] !== '' && !in_array($d['perfil'], $perfiles, true)) $errores[] = 'perfil';
if ($d['acepto'] !== 'si') $errores[] = 'acepto';

// ---------- 3b. Validación de la hoja de vida (PDF) ----------
$archivo = $_FILES['hoja_vida'] ?? null;
$errorPdf = '';
if (!$archivo || ($archivo['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
    $errorPdf = 'Adjunta tu hoja de vida en PDF.';
} elseif (in_array($archivo['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || $archivo['size'] > MAX_MB * 1024 * 1024) {
    $errorPdf = 'El archivo es demasiado grande. El máximo es ' . MAX_MB . ' MB.';
} elseif ($archivo['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($archivo['tmp_name'])) {
    $errorPdf = 'No pudimos recibir el archivo. Inténtalo de nuevo.';
} else {
    // ¿Es un PDF de verdad? Todo PDF empieza por "%PDF-"; además, si el servidor
    // tiene la extensión fileinfo, se confirma el tipo real del contenido.
    $cabecera = (string)file_get_contents($archivo['tmp_name'], false, null, 0, 5);
    $tipoReal = function_exists('finfo_open')
        ? (string)finfo_file(finfo_open(FILEINFO_MIME_TYPE), $archivo['tmp_name'])
        : 'application/pdf';
    if ($cabecera !== '%PDF-' || $tipoReal !== 'application/pdf') {
        $errorPdf = 'El archivo debe ser un PDF.';
    }
}
if ($errorPdf !== '') $errores[] = 'hoja_vida';

if ($errores) {
    responder(422, [
        'ok'     => false,
        'error'  => $errorPdf !== '' && count($errores) === 1 ? $errorPdf : 'Hay datos incompletos o no válidos.',
        'campos' => array_values(array_unique($errores)),
    ]);
}

// ---------- 4. Correo con la hoja de vida adjunta ----------
$nombreCompleto = "{$d['nombre']} {$d['apellido']}";
[$html, $txt] = cuerpoCorreo('Nueva postulación: Trabaja con nosotros', [
    'Datos del aspirante' => [
        'Nombre'              => $nombreCompleto,
        'Documento'           => "{$d['tipo_documento']} {$d['documento']}",
        'Teléfono / WhatsApp' => $d['telefono'],
        'Correo'              => $d['correo'],
        'Ciudad'              => $d['ciudad'],
    ] + ($d['ciudad'] === 'Bogotá' ? ['Localidad' => $d['localidad']] : []) + [
        'Dirección de residencia' => $d['direccion'],
    ],
    'Sobre su experiencia' => ['Perfil profesional' => $d['perfil']]
        + ($d['perfil_detalle'] !== '' ? ['Especialidad o estudios' => $d['perfil_detalle']] : [])
        + ['Mensaje' => $d['mensaje']],
], 'La hoja de vida va adjunta en PDF. La persona autorizó el tratamiento de sus datos para procesos de selección. Responde a este correo para escribirle directamente.');

if (!empty($config['modo_prueba'])) {
    responder(200, ['ok' => true, 'prueba' => true]);
}

// Nombre del adjunto: "Hoja-de-vida-Nombre-Apellido.pdf" (sin tildes ni símbolos).
// Las letras del español se cambian a mano: iconv da resultados distintos según el servidor
// (en Windows, "María" sale "Mar'ia"); iconv queda solo para otras letras con tilde.
$sinTildes = strtr($nombreCompleto, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N']);
$slug = preg_replace('/[^A-Za-z0-9]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $sinTildes) ?: 'aspirante');
$nombreAdjunto = 'Hoja-de-vida-' . trim($slug, '-') . '.pdf';

$mail = crearMailer($config);
try {
    $mail->addAddress($config['to_email_empleo'] ?? $config['to_email']);
    $mail->addReplyTo($d['correo'], $nombreCompleto);
    $mail->Subject = "Postulación: {$nombreCompleto} — {$d['ciudad']}";
    $mail->Body    = $html;
    $mail->AltBody = $txt;
    $mail->addAttachment($archivo['tmp_name'], $nombreAdjunto, PHPMailer\PHPMailer\PHPMailer::ENCODING_BASE64, 'application/pdf');
    $mail->send();
    responder(200, ['ok' => true]);
} catch (MailException $e) {
    error_log('aplicar.php: error al enviar — ' . $mail->ErrorInfo);
    responder(500, ['ok' => false, 'error' => 'No pudimos enviar tu postulación en este momento. Inténtalo más tarde.']);
}
