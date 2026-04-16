import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const run = (command, args) => {
  const needsShell = process.platform === 'win32' && command.toLowerCase().endsWith('.cmd');
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: needsShell,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const copyIfExists = async (fromFile, toFile) => {
  try {
    await fs.mkdir(path.dirname(toFile), { recursive: true });
    await fs.copyFile(fromFile, toFile);
  } catch {
    // Ignore missing files so the build script stays resilient during scaffolding.
  }
};

run(process.execPath, ['scripts/build-docs.mjs']);
run(npmCmd, ['--prefix', 'demo', 'run', 'build']);
run(npmCmd, ['--prefix', 'docs-site', 'run', 'build']);
run(npmCmd, ['--prefix', 'playground', 'run', 'build']);

await copyIfExists(path.join(repoRoot, 'docs', '404.html'), path.join(repoRoot, 'docs', 'docs', '404.html'));
await copyIfExists(path.join(repoRoot, 'docs', '404.html'), path.join(repoRoot, 'docs', 'playground', '404.html'));
