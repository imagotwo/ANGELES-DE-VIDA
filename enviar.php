<?php
/* =================================================================
   ÁNGELES DE VIDA — enviar.php
   Recibe el formulario "Solicita tu servicio" (main.js, bloque 10) y
   envía la solicitud por correo usando el SMTP de Hostinger.

   Flujo:
   1. Solo acepta POST y siempre responde en JSON: { ok: true|false, error?: "..." }.
   2. Antispam: si el campo trampa "web" llega relleno, finge éxito y no envía.
   3. Vuelve a validar TODOS los campos (la validación del navegador se
      puede saltar; la del servidor no).
   4. Construye el correo (HTML + texto plano) escapando los datos.
   5. Lo envía con PHPMailer a 'to_email'. "Responder a" = correo de quien solicita.
   La configuración (cuenta, contraseña, destino) está en config.php y las
   funciones compartidas en php/comun.php.
   ================================================================= */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Bogota');
require __DIR__ . '/php/comun.php';

use PHPMailer\PHPMailer\Exception as MailException;

// ---------- 1. Solo POST ----------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    responder(405, ['ok' => false, 'error' => 'Método no permitido.']);
}
$config = cargarConfig();

// ---------- 2. Antispam (campo trampa) ----------
if (trim((string)($_POST['web'] ?? '')) !== '') {
    responder(200, ['ok' => true]);   // a un robot le decimos "ok" para que no insista
}

// ---------- 3. Validación ----------
$servicios   = ['Cuidado en casa', 'Adultos mayores', 'Citas médicas', 'Hospitalario', 'Postoperatorio', 'Curaciones'];
$modalidades = ['Turno de día', 'Turno de noche', '24 horas', 'Por definir'];
$lugares     = ['casa' => 'Casa', 'hospital' => 'Hospital'];

$d = [
    'nombre'      => campo('nombre', 80),
    'telefono'    => campo('telefono', 20),
    'correo'      => campo('correo', 120),
    'servicio'    => campo('servicio', 40),
    'modalidad'   => campo('modalidad', 40),
    'fecha_inicio'=> campo('fecha_inicio', 10),
    'fecha_fin'   => campo('fecha_fin', 10),
    'lugar'       => campo('lugar', 10),
    'direccion'   => campo('direccion', 160),
    'hospital'    => campo('hospital', 120),
    'paciente'    => campo('paciente', 80),
    'edad'        => campo('edad', 3),
    'diagnostico' => texto('diagnostico', 600),
    'condicion'   => texto('condicion', 800),
    'acepto'      => campo('acepto', 2),
];

$errores = [];
foreach (['nombre', 'telefono', 'correo', 'servicio', 'modalidad', 'fecha_inicio', 'fecha_fin', 'lugar', 'direccion', 'paciente', 'edad', 'diagnostico', 'condicion'] as $c) {
    if ($d[$c] === '') $errores[] = $c;
}
if ($d['correo'] !== '' && !filter_var($d['correo'], FILTER_VALIDATE_EMAIL)) $errores[] = 'correo';
if ($d['telefono'] !== '' && strlen(preg_replace('/\D/', '', $d['telefono'])) < 7) $errores[] = 'telefono';
if ($d['servicio'] !== '' && !in_array($d['servicio'], $servicios, true)) $errores[] = 'servicio';
if ($d['modalidad'] !== '' && !in_array($d['modalidad'], $modalidades, true)) $errores[] = 'modalidad';
if ($d['lugar'] !== '' && !isset($lugares[$d['lugar']])) $errores[] = 'lugar';
if ($d['lugar'] === 'hospital' && $d['hospital'] === '') $errores[] = 'hospital';
if ($d['lugar'] !== 'hospital') $d['hospital'] = '';           // solo aplica si es hospital
if ($d['edad'] !== '' && (!ctype_digit($d['edad']) || (int)$d['edad'] > 120)) $errores[] = 'edad';
// Rango de fechas: formato válido, inicio desde hoy, fin igual o posterior al inicio
/** Convierte AAAA-MM-DD en fecha; null si no es una fecha real. */
function fechaValida(string $v): ?DateTime
{
    $f = DateTime::createFromFormat('!Y-m-d', $v);
    return ($f && $f->format('Y-m-d') === $v) ? $f : null;
}
$ini = fechaValida($d['fecha_inicio']);
$fin = fechaValida($d['fecha_fin']);
if ($d['fecha_inicio'] !== '' && (!$ini || $ini < new DateTime('today'))) $errores[] = 'fecha_inicio';
if ($d['fecha_fin'] !== '' && (!$fin || ($ini && $fin < $ini))) $errores[] = 'fecha_fin';
if ($d['acepto'] !== 'si') $errores[] = 'acepto';

if ($errores) {
    responder(422, ['ok' => false, 'error' => 'Hay datos incompletos o no válidos.', 'campos' => array_values(array_unique($errores))]);
}

// ---------- 4. Contenido del correo ----------
$dias = (int)$ini->diff($fin)->days + 1;   // ambos días incluidos
$fechaLegible = $dias === 1
    ? $ini->format('d/m/Y') . ' (1 día)'
    : 'Del ' . $ini->format('d/m/Y') . ' al ' . $fin->format('d/m/Y') . " ($dias días)";
[$html, $txt] = cuerpoCorreo('Nueva solicitud de servicio', [
    'Tus datos'   => ['Nombre' => $d['nombre'], 'Teléfono / WhatsApp' => $d['telefono'], 'Correo' => $d['correo']],
    'El servicio' => ['Tipo de servicio' => $d['servicio'], 'Modalidad / horario' => $d['modalidad'], 'Fechas' => $fechaLegible,
                      'Lugar' => $lugares[$d['lugar']], 'Dirección' => $d['direccion']]
                     + ($d['hospital'] !== '' ? ['Hospital / clínica' => $d['hospital']] : []),
    'El paciente' => ['Nombre' => $d['paciente'], 'Edad' => $d['edad'] . ' años', 'Diagnóstico(s)' => $d['diagnostico'], 'Condición' => $d['condicion']],
], 'La persona autorizó el tratamiento de sus datos personales y de salud para gestionar esta solicitud. Responde a este correo para escribirle directamente.');

// Modo prueba: todo validado, pero sin enviar (útil antes de configurar el correo)
if (!empty($config['modo_prueba'])) {
    responder(200, ['ok' => true, 'prueba' => true]);
}

// ---------- 5. Envío con PHPMailer (SMTP de Hostinger) ----------
$mail = crearMailer($config);
try {
    $mail->addAddress($config['to_email']);
    $mail->addReplyTo($d['correo'], $d['nombre']);     // "Responder" en Gmail le escribe al cliente
    $mail->Subject = "Nueva solicitud: {$d['servicio']} — {$d['nombre']}";
    $mail->Body    = $html;
    $mail->AltBody = $txt;
    $mail->send();
    responder(200, ['ok' => true]);
} catch (MailException $e) {
    error_log('enviar.php: error al enviar — ' . $mail->ErrorInfo);   // queda en el registro de errores de Hostinger
    responder(500, ['ok' => false, 'error' => 'No pudimos enviar la solicitud en este momento.']);
}
