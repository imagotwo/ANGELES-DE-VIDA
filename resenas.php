<?php
/* =================================================================
   ÁNGELES DE VIDA — resenas.php
   Entrega las reseñas de Google al carrusel de #testimonios (main.js, bloque 12).
   Responde siempre en JSON:
     { ok, fuente, demo?, actualizado, promedio, total, url, resenas: [ … ] }

   Flujo:
   1. Si hay una copia guardada (caché) más reciente que 'cache_minutos', la devuelve
      sin llamar a Google (rápido y sin gastar la cuota de la API).
   2. Si no, pide las reseñas a la fuente elegida en config.php (business / places / demo),
      deja las 9 más recientes con comentario y 4-5 estrellas, y guarda la caché.
   3. Si Google falla, devuelve la última caché aunque esté vencida (el carrusel no
      se queda vacío por un corte momentáneo). Sin caché, responde ok:false y el
      carrusel no se muestra.
   Las claves de Google están en config.php (nunca llegan al navegador) y la lógica
   de cada fuente en php/resenas-google.php.
   ================================================================= */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Bogota');
require __DIR__ . '/php/comun.php';
require __DIR__ . '/php/resenas-google.php';

const MAX_RESENAS = 9;

$config  = cargarConfig();
$cfg     = $config['resenas'] ?? [];
$fuente  = in_array($cfg['fuente'] ?? '', ['business', 'places', 'demo'], true) ? $cfg['fuente'] : 'demo';
$minutos = max(5, (int)($cfg['cache_minutos'] ?? 60));
$cache   = __DIR__ . '/php/cache/resenas-' . $fuente . '.json';

// El navegador puede guardar la respuesta 5 minutos; la caché del servidor dura más.
header('Cache-Control: public, max-age=300');

// ---------- 1. Caché vigente ----------
if ($fuente !== 'demo' && is_file($cache) && time() - filemtime($cache) < $minutos * 60) {
    readfile($cache);
    exit;
}

// ---------- 2. Pedir a Google ----------
try {
    $datos = match ($fuente) {
        'business' => resenasBusiness($cfg['business'] ?? []),
        'places'   => resenasPlaces($cfg['places'] ?? []),
        default    => resenasDemo(),
    };
    $respuesta = [
        'ok'          => true,
        'fuente'      => $fuente,
        'demo'        => !empty($datos['demo']),
        'actualizado' => date(DATE_ATOM),
        'promedio'    => $datos['promedio'] ?? null,
        'total'       => $datos['total'] ?? null,
        // Enlace "Ver todas en Google": el de config.php o, en Places, el que da Google
        'url'         => ($cfg['url_perfil'] ?? '') ?: ($datos['url'] ?? ''),
        'resenas'     => filtrarResenas($datos['resenas'], MAX_RESENAS),
    ];
    $json = json_encode($respuesta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($fuente !== 'demo') {
        if (!is_dir(dirname($cache))) @mkdir(dirname($cache), 0755, true);
        @file_put_contents($cache, $json, LOCK_EX);
    }
    echo $json;
} catch (Throwable $e) {
    error_log('Reseñas (' . $fuente . '): ' . $e->getMessage());
    // ---------- 3. Google falló: última caché disponible ----------
    if (is_file($cache)) {
        readfile($cache);
        exit;
    }
    responder(502, ['ok' => false, 'error' => 'No se pudieron cargar las reseñas.']);
}
