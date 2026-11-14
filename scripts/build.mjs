// Production build: validates config, copies site/ → dist/, and pre-renders the
// Spanish page into index.html and privacidad.html (fast first paint, works
// without JavaScript). No bundler needed.
//
//   npm run build
//   SITE_URL=https://user.github.io/repo/ npm run build   (GitHub Actions sets this)
//   RSVP_ENDPOINT=https://script.google.com/macros/s/…/exec npm run build  (optional override)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateConfig } from './validate-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'site');
const out = path.resolve(root, process.env.OUT_DIR || 'dist');

const { config } = await import(pathToFileURL(path.join(src, 'config.js')).href + `?t=${Date.now()}`);
if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL.replace(/\/+$/, '') + '/';
if (process.env.RSVP_ENDPOINT) config.rsvp.endpoint = process.env.RSVP_ENDPOINT;

const { errors, warnings } = validateConfig(config);
for (const w of warnings) console.log('  aviso  ' + w);
if (errors.length) {
  console.error('\nHay errores en site/config.js; no se publica nada:\n');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

const { renderHeader, renderMain, renderFooter, renderPrivacy, photoFiles } = await import(pathToFileURL(path.join(src, 'assets/js/render.js')).href);
const { ui } = await import(pathToFileURL(path.join(src, 'assets/js/ui.js')).href);

// Every photo in config.js must exist, otherwise the site would show broken images.
const photos = [config.photos?.hero, config.photos?.story, ...(config.photos?.gallery || [])].filter(Boolean);
const missing = photos.flatMap((p) => {
  const f = photoFiles(p);
  const files = f.srcset ? f.srcset.split(', ').map((x) => x.split(' ')[0]) : [f.src];
  return files.filter((x) => !/^https?:/.test(x) && !fs.existsSync(path.join(src, x)));
});
if (missing.length) {
  console.error('\nFaltan fotos que aparecen en site/config.js:\n' + missing.map((m) => '  ✗ site/' + m).join('\n'));
  console.error('Preparadlas con: python3 scripts/process_photos.py ruta/foto.jpg nombre');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

const version = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 8);
const base = new URL(config.siteUrl).pathname;
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const fill = (file, map) => {
  const p = path.join(out, file);
  let html = fs.readFileSync(p, 'utf8');
  for (const [k, v] of Object.entries(map)) html = html.split(`{{${k}}}`).join(v);
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error(`Placeholder sin rellenar en ${file}`);
  fs.writeFileSync(p, html);
};

fill('index.html', {
  TITLE: attr(ui.es.htmlTitle),
  DESCRIPTION: attr(ui.es.metaDescription),
  SITE_URL: attr(config.siteUrl),
  VERSION: version,
  HEADER: renderHeader(config, 'es'),
  MAIN: renderMain(config, 'es'),
  FOOTER: renderFooter(config, 'es'),
});
fill('privacidad.html', { VERSION: version, PRIVACY: renderPrivacy(config, 'es'), BACK: ui.es.backHome });
fill('404.html', { VERSION: version, BASE: base });

// Build-time endpoint override must reach the browser too.
if (process.env.RSVP_ENDPOINT) {
  const cfgPath = path.join(out, 'config.js');
  const txt = fs.readFileSync(cfgPath, 'utf8').replace(/endpoint:\s*'[^']*'/, `endpoint: '${process.env.RSVP_ENDPOINT}'`);
  fs.writeFileSync(cfgPath, txt);
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`\n✓ Web generada en dist/ (base ${base}, versión ${version})`);
