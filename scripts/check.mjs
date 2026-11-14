// npm run check — validate site/config.js without building.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateConfig } from './validate-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { config } = await import(pathToFileURL(path.join(root, 'site/config.js')).href);
const { errors, warnings } = validateConfig(config);
warnings.forEach((w) => console.log('  aviso  ' + w));
errors.forEach((e) => console.error('  ✗ ' + e));
console.log(errors.length ? `\n${errors.length} error(es).` : '\n✓ config.js correcto.');
process.exit(errors.length ? 1 : 0);
