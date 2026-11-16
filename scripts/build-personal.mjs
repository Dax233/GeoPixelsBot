// GPL-3.0; derived artifact retains Dax233 and nymtuta attribution.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/build-personal.mjs <output.user.js>');
const input = fileURLToPath(new URL('../ghostBot.user.js', import.meta.url));
if (resolve(output) === resolve(input)) throw new Error('Do not overwrite the contribution source');
const personal = readFileSync(input, 'utf8')
  .replace('const DEFAULT_LANGUAGE = "auto";', 'const DEFAULT_LANGUAGE = "fr";')
  .replace(/^(\/\/ @name\s+)(.+)$/m, '$1$2 — Français (local)')
  .replace(/^(\/\/ @updateURL\s+).+$/m, '$1none')
  .replace(/^(\/\/ @downloadURL\s+).+$/m, '$1none');
mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(output, personal, 'utf8');
console.log(`Personal French copy: ${resolve(output)}`);
