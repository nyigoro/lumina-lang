import fs from 'node:fs';
import path from 'node:path';
import { runLumina } from '../src/bin/lumina-core.js';

const tempDirs: string[] = [];

function createWorkspace(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(process.cwd(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeFile(filePath: string, source: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, 'utf-8');
}

async function runCommand(argv: string[]) {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalExit = process.exit;
  let exitCode: number | null = null;

  console.log = (...args: unknown[]) => {
    logs.push(args.map((value) => String(value)).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map((value) => String(value)).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    logs.push(args.map((value) => String(value)).join(' '));
  };
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`EXIT:${exitCode}`);
  }) as typeof process.exit;

  try {
    await runLumina(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.startsWith('EXIT:')) throw error;
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    process.exit = originalExit;
  }

  return { logs, errors, exitCode };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('capability CLI targets', () => {
  test('compile --target js --module cjs emits CommonJS output', async () => {
    const root = createWorkspace('.tmp-capability-cli-js-');
    const entry = path.join(root, 'main.lm');
    const outPath = path.join(root, 'dist', 'index.cjs');
    writeFile(entry, 'fn main() -> i32 { 42 }\n');

    const result = await runCommand(['compile', entry, '--target', 'js', '--module', 'cjs', '--out', outPath]);

    expect(result.exitCode).toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.readFileSync(outPath, 'utf-8')).toContain('module.exports');
  });

  test('check --target wasm-standalone rejects web capability usage', async () => {
    const root = createWorkspace('.tmp-capability-cli-standalone-');
    const entry = path.join(root, 'main.lm');
    writeFile(
      entry,
      'import * as dom from "@std/dom";\nfn main() {\n  dom.create_element("div");\n}\n'
    );

    const result = await runCommand(['check', entry, '--target', 'wasm-standalone']);

    expect(result.exitCode).toBe(1);
    expect(result.errors.join('\n')).toContain('CAP-001');
  });

  test('compile --target wasm-web reports missing host capability diagnostics', async () => {
    const root = createWorkspace('.tmp-capability-cli-wasm-web-');
    const entry = path.join(root, 'main.lm');
    const outPath = path.join(root, 'dist', 'index.wasm');
    writeFile(
      entry,
      'import * as webgpu from "@std/webgpu";\nfn main() {\n  webgpu.is_available();\n}\n'
    );

    const result = await runCommand(['compile', entry, '--target', 'wasm-web', '--out', outPath]);

    expect(result.exitCode).toBe(1);
    expect(result.errors.join('\n')).toContain('CAP-002');
  });
});
