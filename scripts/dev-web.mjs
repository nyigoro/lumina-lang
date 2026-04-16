import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;
const keepAlive = setInterval(() => {}, 1000);

function start(name, prefix) {
  const useWindowsShell = process.platform === 'win32';
  const command = useWindowsShell ? 'cmd.exe' : npmCommand;
  const args = useWindowsShell
    ? ['/d', '/s', '/c', `${npmCommand} --prefix ${prefix} run dev`]
    : ['--prefix', prefix, 'run', 'dev'];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  console.log(`[${name}] starting`);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    if (signal || code) {
      console.error(`[${name}] exited with ${signal ?? `code ${code}`}`);
      shutdown('SIGTERM');
      clearInterval(keepAlive);
      process.exit(code ?? 1);
    }
  });

  children.push(child);
}

function shutdown(signal) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
  clearInterval(keepAlive);
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
  clearInterval(keepAlive);
  process.exit(0);
});

start('docs-site', 'docs-site');
start('playground', 'playground');
start('demo', 'demo');
