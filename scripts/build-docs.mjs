import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(repoRoot, 'docs-content');
const outputPath = path.join(repoRoot, 'docs-site', 'public', 'docs-bundle.json');

const sectionOrder = [
  'Getting Started',
  'Why Lumina?',
  'JS vs WASM',
  'Capabilities',
  'Stdlib',
  'Web-Native Roadmap',
  'Contributing',
  'Security/Support',
  'More Docs',
];

const docConfig = new Map([
  ['GETTING_STARTED.md', { slug: 'getting-started', section: 'Getting Started' }],
  ['WHY_LUMINA.md', { slug: 'why-lumina', section: 'Why Lumina?' }],
  ['WHEN_TO_USE_JS_VS_WASM.md', { slug: 'js-vs-wasm', section: 'JS vs WASM' }],
  ['CAPABILITIES.md', { slug: 'capabilities', section: 'Capabilities' }],
  ['STDLIB.md', { slug: 'stdlib', section: 'Stdlib' }],
  ['WEB_NATIVE_ROADMAP.md', { slug: 'web-native-roadmap', section: 'Web-Native Roadmap' }],
  ['CONTRIBUTING.md', { slug: 'contributing', section: 'Contributing' }],
  ['SECURITY.md', { slug: 'security', section: 'Security/Support' }],
  ['SUPPORT.md', { slug: 'support', section: 'Security/Support' }],
]);

const slugify = value =>
  value
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');

const collectMarkdownFiles = async directory => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files;
};

const readDocFiles = async () => {
  const docsFiles = await collectMarkdownFiles(docsDir);
  const rootFiles = ['CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md'].map(file => path.join(repoRoot, file));
  return [...docsFiles, ...rootFiles];
};

const extractTitle = (source, fallback) => {
  const match = source.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? fallback;
};

const resolveDocHref = (currentLookupKey, href, slugByLookupKey) => {
  if (/^(?:[a-z]+:|#|\/)/i.test(href)) return href;

  const [rawTarget] = href.split('#');
  if (!rawTarget) return href;

  const currentDir = currentLookupKey.includes('/') ? path.posix.dirname(currentLookupKey) : '.';
  const candidate = currentDir === '.'
    ? path.posix.normalize(rawTarget)
    : path.posix.normalize(path.posix.join(currentDir, rawTarget));
  const candidateKeys = [candidate];

  if (candidate.toLowerCase().endsWith('.md')) {
    // already covered
  } else {
    candidateKeys.push(`${candidate}.md`);
    candidateKeys.push(path.posix.join(candidate, 'README.md'));
  }

  const slug = candidateKeys.map(key => slugByLookupKey.get(key)).find(Boolean);
  return slug ? `#/${slug}` : href;
};

const rewriteDocLinks = (html, currentLookupKey, slugByLookupKey) =>
  html.replace(/href="([^"]+)"/g, (match, href) => {
    const nextHref = resolveDocHref(currentLookupKey, href, slugByLookupKey);
    return `href="${nextHref}"`;
  });

const sectionRank = section => {
  const index = sectionOrder.indexOf(section);
  return index === -1 ? sectionOrder.indexOf('More Docs') : index;
};

const buildManifest = async () => {
  const files = await readDocFiles();
  const entries = [];

  for (const file of files) {
    const source = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '');
    const isDocsContentFile = file.startsWith(docsDir);
    const relativePath = isDocsContentFile ? path.relative(docsDir, file) : path.basename(file);
    const lookupKey = relativePath.replace(/\\/g, '/');
    const baseName = path.basename(file);
    const meta = docConfig.get(baseName) ?? { slug: slugify(lookupKey), section: 'More Docs' };
    const sourcePath = isDocsContentFile ? `docs-content/${lookupKey}` : path.relative(repoRoot, file).replace(/\\/g, '/');
    entries.push({
      lookupKey,
      slug: meta.slug,
      section: meta.section,
      sourcePath,
      title: extractTitle(source, baseName.replace(/_/g, ' ').replace(/\.md$/i, '')),
      source,
    });
  }

  const slugByLookupKey = new Map(entries.map(entry => [entry.lookupKey, entry.slug]));
  const pages = entries.map(({ lookupKey, source, ...entry }) => ({
    ...entry,
    html: rewriteDocLinks(marked.parse(source), lookupKey, slugByLookupKey),
  }));

  pages.sort((left, right) => {
    const bySection = sectionRank(left.section) - sectionRank(right.section);
    if (bySection !== 0) return bySection;
    return left.title.localeCompare(right.title);
  });

  return {
    pages,
    index: pages.map(({ slug, title, section, sourcePath }) => ({ slug, title, section, sourcePath })),
  };
};

const main = async () => {
  const manifest = await buildManifest();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${manifest.pages.length} pages`);
};

await main();
