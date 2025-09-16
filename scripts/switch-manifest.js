#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const mode = (process.argv[2] || '').toLowerCase();
if (!['dev', 'prod'].includes(mode)) {
  console.error('Usage: node scripts/switch-manifest.js <dev|prod>');
  process.exit(1);
}

const root = path.resolve(process.cwd());
const extDir = path.join(root, 'extension');
const src = path.join(extDir, mode === 'prod' ? 'manifest.prod.json' : 'manifest.dev.json');
const dest = path.join(extDir, 'manifest.json');

if (!fs.existsSync(src)) {
  console.error(`Source manifest not found: ${src}`);
  process.exit(2);
}

fs.copyFileSync(src, dest);
console.log(`Wrote ${dest} from ${path.basename(src)}`);
