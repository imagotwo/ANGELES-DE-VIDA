/* =================================================================
   ÁNGELES DE VIDA — publicar.mjs
   Arma la carpeta  publicar/  con SOLO lo que se sube al hosting:
   - styles.css y main.js MINIFICADOS (los originales no se tocan).
   - En los .html, styles.css y main.js llevan ?v=<huella> (cambia en cada
     versión): así el navegador descarga lo nuevo aunque tenga copia guardada.
   - Deja fuera lo que no va al servidor: borradores .md, Word, tests, git,
     config.example.php, reseñas de ejemplo y este mismo script.

   Uso (en la carpeta del proyecto):   node publicar.mjs
   Necesita Node e internet la primera vez (descarga esbuild con npx).
   Después: comprime el CONTENIDO de publicar/ en un .zip, súbelo a la carpeta
   enfermerasangelesdevida.com del hosting (su "raíz del documento"; NO public_html)
   y extráelo allí (cPanel → Administrador de archivos).
   ================================================================= */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const SALIDA = 'publicar';
const ESBUILD = 'esbuild@0.24.2';

// Archivos sueltos de la raíz que van al servidor (los .html se añaden solos)
const ARCHIVOS = ['.htaccess', '.user.ini', 'robots.txt', 'sitemap.xml',
  'enviar.php', 'aplicar.php', 'resenas.php', 'config.php'];   // diagnostico.php: solo si hace falta revisar el correo
// Carpetas completas, con lo que se excluye de cada una
const CARPETAS = { assets: ['assets/data/resenas-demo.json'], php: ['php/cache'] };

// ---------- 1. Carpeta limpia ----------
// Se vacía su contenido (no se borra la carpeta): así funciona aunque esté abierta en el Explorador
mkdirSync(SALIDA, { recursive: true });
for (const f of readdirSync(SALIDA)) rmSync(join(SALIDA, f), { recursive: true, force: true });

// ---------- 2. Copiar ----------
for (const f of ARCHIVOS) {
  if (!existsSync(f)) { console.warn(`⚠ Falta ${f} (no se copia)`); continue; }
  cpSync(f, join(SALIDA, f));
}
for (const [dir, fuera] of Object.entries(CARPETAS)) {
  cpSync(dir, join(SALIDA, dir), { recursive: true, filter: (src) => !fuera.some((x) => src.replace(/\\/g, '/').startsWith(x)) });
}

// ---------- 3. Minificar CSS y JS ----------
for (const f of ['styles.css', 'main.js']) {
  execSync(`npx --yes ${ESBUILD} ${f} --minify --legal-comments=none --outfile=${SALIDA}/${f} --log-level=warning`, { stdio: 'inherit' });
}

// ---------- 4. HTML: ?v=<huella> en styles.css y main.js, y enlaces sin .html ----------
// Enlaces internos: en los originales llevan .html (así funcionan en el PC con Live Server);
// en la versión publicada se quitan (privacidad.html#x → privacidad#x), porque el .htaccess
// sirve /privacidad como privacidad.html.
const huella = (f) => createHash('md5').update(readFileSync(join(SALIDA, f))).digest('hex').slice(0, 8);
const v = { 'styles.css': huella('styles.css'), 'main.js': huella('main.js') };
const paginas = readdirSync('.').filter((f) => f.endsWith('.html'));
for (const p of paginas) {
  const html = readFileSync(p, 'utf8')
    .replace(/(href|src)="(styles\.css|main\.js)"/g, (_, attr, f) => `${attr}="${f}?v=${v[f]}"`)
    .replace(/href="([a-z0-9-]+)\.html(#[^"]*)?"/g, (_, pag, ancla = '') => `href="${pag}${ancla}"`);
  writeFileSync(join(SALIDA, p), html);
}

// ---------- 5. Resumen ----------
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('\nMinificación (tamaño → minificado → comprimido gzip, lo que viaja por la red):');
for (const f of ['styles.css', 'main.js']) {
  const min = readFileSync(join(SALIDA, f));
  console.log(`  ${f.padEnd(11)} ${kb(statSync(f).size).padStart(9)} → ${kb(min.length).padStart(8)} → ${kb(gzipSync(min).length).padStart(7)}`);
}
console.log(`\nPáginas: ${paginas.join(', ')}`);
if (/'modo_prueba'\s*=>\s*true/.test(readFileSync('config.php', 'utf8')))
  console.warn('\n⚠ config.php tiene modo_prueba => true: los formularios NO enviarán correo hasta ponerlo en false.');
console.log(`\n✔ Listo: sube el contenido de la carpeta "${SALIDA}/" a la carpeta enfermerasangelesdevida.com del hosting (no a public_html).`);
