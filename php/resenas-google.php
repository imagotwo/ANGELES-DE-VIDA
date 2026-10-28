<?php
/* =================================================================
   ÁNGELES DE VIDA — php/resenas-google.php
   Lee las reseñas del perfil de Google y las devuelve en un formato
   común para el carrusel de #testimonios (main.js, bloque 12):
     ['nombre', 'foto', 'enlace', 'estrellas' (1-5), 'texto', 'fecha' (ISO 8601)]
   Tres fuentes (se elige en config.php → 'resenas' → 'fuente'):
   - 'business': Google Business Profile API. Todas las reseñas, de la más nueva
                 a la más antigua. Requiere OAuth del dueño del perfil.
   - 'places':   Places API (New). Solo una API key, pero Google entrega como
                 máximo 5 reseñas, elegidas por relevancia (no por fecha).
   - 'demo':     reseñas de EJEMPLO (assets/data/resenas-demo.json) para ver el
                 diseño mientras no hay conexión. El carrusel las marca como ejemplo.
   Lo usa resenas.php. Esta carpeta no se puede abrir desde el navegador.
   ================================================================= */

declare(strict_types=1);

/** Petición HTTP que devuelve JSON decodificado. $post = campos de formulario (POST).
    Usa cURL si el servidor lo tiene; si no, file_get_contents. Lanza excepción si falla. */
function pedirJson(string $url, array $cabeceras = [], ?array $post = null): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => $cabeceras,
        ]);
        if ($post !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post));
        }
        $cuerpo = curl_exec($ch);
        $codigo = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error  = curl_error($ch);
        curl_close($ch);
        if ($cuerpo === false) throw new RuntimeException('Sin conexión con Google: ' . $error);
    } else {
        $opciones = ['method' => 'GET', 'header' => implode("\r\n", $cabeceras), 'timeout' => 10, 'ignore_errors' => true];
        if ($post !== null) {
            $opciones['method']  = 'POST';
            $opciones['header'] .= ($opciones['header'] ? "\r\n" : '') . 'Content-Type: application/x-www-form-urlencoded';
            $opciones['content'] = http_build_query($post);
        }
        $cuerpo = @file_get_contents($url, false, stream_context_create(['http' => $opciones]));
        if ($cuerpo === false) throw new RuntimeException('Sin conexión con Google.');
        preg_match('#^HTTP/\S+ (\d{3})#', $http_response_header[0] ?? '', $m);
        $codigo = (int)($m[1] ?? 0);
    }
    $datos = json_decode((string)$cuerpo, true);
    if ($codigo < 200 || $codigo >= 300 || !is_array($datos)) {
        $detalle = is_array($datos) ? ($datos['error']['message'] ?? $datos['error_description'] ?? '') : '';
        throw new RuntimeException("Google respondió $codigo. $detalle");
    }
    return $datos;
}

/** Quita la traducción automática que Google añade a algunos comentarios
    ("(Translated by Google) … (Original) …") y deja el texto que escribió la persona. */
function textoOriginal(string $t): string
{
    if (preg_match('/\(Original\)\s*(.+)$/su', $t, $m)) return trim($m[1]);
    return trim(preg_replace('/^\(Translated by Google\)\s*/u', '', $t) ?? $t);
}

/* ---------- Fuente 'business': Google Business Profile API ----------
   1. Cambia el refresh_token (permanente) por un access_token (dura 1 hora).
   2. Pide las reseñas de la ficha, ordenadas por fecha (más nuevas primero). */
function resenasBusiness(array $c): array
{
    foreach (['client_id', 'client_secret', 'refresh_token', 'account_id', 'location_id'] as $k) {
        if (empty($c[$k])) throw new RuntimeException("Falta '$k' en config.php (resenas → business).");
    }
    $token = pedirJson('https://oauth2.googleapis.com/token', [], [
        'client_id'     => $c['client_id'],
        'client_secret' => $c['client_secret'],
        'refresh_token' => $c['refresh_token'],
        'grant_type'    => 'refresh_token',
    ]);
    $url = 'https://mybusiness.googleapis.com/v4/accounts/' . rawurlencode((string)$c['account_id'])
         . '/locations/' . rawurlencode((string)$c['location_id'])
         . '/reviews?pageSize=50&orderBy=' . rawurlencode('updateTime desc');
    $datos = pedirJson($url, ['Authorization: Bearer ' . $token['access_token']]);

    $numeros = ['ONE' => 1, 'TWO' => 2, 'THREE' => 3, 'FOUR' => 4, 'FIVE' => 5];
    $resenas = [];
    foreach ($datos['reviews'] ?? [] as $r) {
        $resenas[] = [
            'nombre'    => (string)($r['reviewer']['displayName'] ?? 'Cliente de Google'),
            'foto'      => (string)($r['reviewer']['profilePhotoUrl'] ?? ''),
            'enlace'    => '',
            'estrellas' => $numeros[$r['starRating'] ?? ''] ?? 0,
            'texto'     => textoOriginal((string)($r['comment'] ?? '')),
            'fecha'     => (string)($r['createTime'] ?? ''),
        ];
    }
    return [
        'resenas'  => $resenas,
        'promedio' => isset($datos['averageRating']) ? (float)$datos['averageRating'] : null,
        'total'    => isset($datos['totalReviewCount']) ? (int)$datos['totalReviewCount'] : null,
    ];
}

/* ---------- Fuente 'places': Places API (New) ----------
   Una sola petición con la API key. Máximo 5 reseñas (límite de Google). */
function resenasPlaces(array $c): array
{
    foreach (['api_key', 'place_id'] as $k) {
        if (empty($c[$k])) throw new RuntimeException("Falta '$k' en config.php (resenas → places).");
    }
    $datos = pedirJson(
        'https://places.googleapis.com/v1/places/' . rawurlencode((string)$c['place_id']) . '?languageCode=es',
        ['X-Goog-Api-Key: ' . $c['api_key'], 'X-Goog-FieldMask: rating,userRatingCount,googleMapsUri,reviews']
    );
    $resenas = [];
    foreach ($datos['reviews'] ?? [] as $r) {
        $resenas[] = [
            'nombre'    => (string)($r['authorAttribution']['displayName'] ?? 'Cliente de Google'),
            'foto'      => (string)($r['authorAttribution']['photoUri'] ?? ''),
            'enlace'    => (string)($r['authorAttribution']['uri'] ?? ''),
            'estrellas' => (int)($r['rating'] ?? 0),
            // originalText = lo que escribió la persona; text = traducción al español
            'texto'     => trim((string)($r['originalText']['text'] ?? $r['text']['text'] ?? '')),
            'fecha'     => (string)($r['publishTime'] ?? ''),
        ];
    }
    return [
        'resenas'  => $resenas,
        'promedio' => isset($datos['rating']) ? (float)$datos['rating'] : null,
        'total'    => isset($datos['userRatingCount']) ? (int)$datos['userRatingCount'] : null,
        'url'      => (string)($datos['googleMapsUri'] ?? ''),
    ];
}

/* ---------- Fuente 'demo': reseñas de ejemplo ----------
   El archivo guarda "hace_dias" en vez de una fecha fija para que el ejemplo
   no envejezca: la fecha se calcula a partir de hoy. */
function resenasDemo(): array
{
    $datos = json_decode((string)@file_get_contents(dirname(__DIR__) . '/assets/data/resenas-demo.json'), true);
    if (!is_array($datos)) throw new RuntimeException('No se pudo leer assets/data/resenas-demo.json');
    foreach ($datos['resenas'] as &$r) {
        $r['fecha'] = date(DATE_ATOM, time() - (int)($r['hace_dias'] ?? 0) * 86400);
        unset($r['hace_dias']);
    }
    unset($r);
    $datos['demo'] = true;
    return $datos;
}

/** Deja solo las reseñas que se publican: con comentario y de 4 o 5 estrellas,
    de la más nueva a la más antigua, como máximo $max. */
function filtrarResenas(array $resenas, int $max): array
{
    $resenas = array_values(array_filter($resenas, fn($r) => $r['texto'] !== '' && $r['estrellas'] >= 4));
    usort($resenas, fn($a, $b) => strcmp($b['fecha'], $a['fecha']));   // ISO 8601: el orden de texto es el de fecha
    return array_slice($resenas, 0, $max);
}
