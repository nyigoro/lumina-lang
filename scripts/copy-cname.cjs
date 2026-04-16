const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const source = path.join(repoRoot, 'CNAME');
const fallbackSource = path.join(repoRoot, 'docs', 'CNAME');
const targetDir = path.join(repoRoot, 'docs');
const target = path.join(targetDir, 'CNAME');

const resolvedSource = fs.existsSync(source)
  ? source
  : (fs.existsSync(fallbackSource) ? fallbackSource : null);

if (!resolvedSource) {
  console.warn('CNAME not found at repo root or docs/. Skipping copy.');
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(resolvedSource, target);
console.log('Copied CNAME to docs/CNAME');
