<?php
/* =================================================================
   ÁNGELES DE VIDA — php/comun.php
   Funciones compartidas por enviar.php (solicitudes de servicio) y
   aplicar.php (postulaciones "Trabaja con nosotros").
   La carpeta php/ no se puede abrir desde el navegador (php/.htaccess);
   estos archivos se cargan desde el disco con require.
   ================================================================= */

declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

/** Responde en JSON y termina. */
function responder(int $codigo, array $datos): void
{
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Carga config.php; si falta, responde con error. */
function cargarConfig(): array
{
    $ruta = dirname(__DIR__) . '/config.php';
    if (!is_file($ruta)) {
        error_log('Formulario: falta config.php');
        responder(500, ['ok' => false, 'error' => 'El formulario aún no está configurado.']);
    }
    return require $ruta;
}

/** Recorta a $max caracteres respetando tildes y ñ (UTF-8).
    Usa mbstring si el servidor la tiene; si no, una alternativa equivalente. */
function cortar(string $v, int $max): string
{
    if (function_exists('mb_substr')) return mb_substr($v, 0, $max, 'UTF-8');
    preg_match('/^.{0,' . $max . '}/us', $v, $m);
    return $m[0] ?? '';
}

/** Mayúsculas respetando tildes (con o sin mbstring). */
function mayusculas(string $v): string
{
    return function_exists('mb_strtoupper') ? mb_strtoupper($v, 'UTF-8') : strtoupper($v);
}

/** Lee un campo de texto del POST: sin espacios sobrantes y con longitud máxima. */
function campo(string $nombre, int $max = 200): string
{
    $v = trim((string)($_POST[$nombre] ?? ''));
    $v = preg_replace('/\s+/u', ' ', $v) ?? '';   // colapsa saltos de línea y espacios repetidos
    return cortar($v, $max);
}

/** Igual que campo() pero conserva saltos de línea (textos largos). */
function texto(string $nombre, int $max = 800): string
{
    $v = trim((string)($_POST[$nombre] ?? ''));
    return cortar(str_replace("\r\n", "\n", $v), $max);
}

/** Escapa texto para meterlo en el HTML del correo. */
function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

/** Construye el cuerpo del correo (HTML y texto plano) a partir de bloques
    ['Título del bloque' => ['Etiqueta' => 'valor', …], …]. */
function cuerpoCorreo(string $titulo, array $bloques, string $nota): array
{
    $html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#29435f;max-width:640px">'
          . '<h2 style="color:#1D528A;margin:0 0 4px">' . h($titulo) . '</h2>'
          . '<p style="margin:0 0 20px;color:#555">Recibida el ' . date('d/m/Y \a \l\a\s H:i') . ' desde el formulario de la web.</p>';
    $txt  = mayusculas($titulo) . "\nRecibida el " . date('d/m/Y H:i') . "\n";
    foreach ($bloques as $nombre => $campos) {
        $html .= '<h3 style="color:#1D528A;border-bottom:1px solid #ddd;padding-bottom:4px;margin:20px 0 8px">' . h($nombre) . '</h3><table style="border-collapse:collapse;width:100%">';
        $txt  .= "\n== " . mayusculas($nombre) . " ==\n";
        foreach ($campos as $etiqueta => $valor) {
            $html .= '<tr><td style="padding:6px 12px 6px 0;color:#777;vertical-align:top;white-space:nowrap">' . h($etiqueta)
                   . '</td><td style="padding:6px 0">' . nl2br(h($valor)) . '</td></tr>';
            $txt  .= "$etiqueta: $valor\n";
        }
        $html .= '</table>';
    }
    $html .= '<p style="margin-top:24px;font-size:13px;color:#777">' . h($nota) . '</p></div>';
    $txt  .= "\n$nota\n";
    return [$html, $txt];
}

/** Crea un PHPMailer ya configurado con el SMTP de config.php. */
function crearMailer(array $config): PHPMailer
{
    require_once __DIR__ . '/PHPMailer/Exception.php';
    require_once __DIR__ . '/PHPMailer/PHPMailer.php';
    require_once __DIR__ . '/PHPMailer/SMTP.php';

    $mail = new PHPMailer(true);
    $mail->CharSet    = 'UTF-8';
    $mail->isSMTP();
    $mail->Host       = $config['smtp_host'];
    $mail->Port       = (int)$config['smtp_port'];
    $mail->SMTPSecure = $config['smtp_secure'] === 'tls' ? PHPMailer::ENCRYPTION_STARTTLS : PHPMailer::ENCRYPTION_SMTPS;
    $mail->SMTPAuth   = true;
    $mail->Username   = $config['smtp_user'];
    $mail->Password   = $config['smtp_pass'];
    // El remitente DEBE ser la cuenta de tu dominio (si no, Gmail lo manda a spam)
    $mail->setFrom($config['smtp_user'], $config['from_name']);
    $mail->isHTML(true);
    return $mail;
}
