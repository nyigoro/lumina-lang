import fs from 'node:fs';
import path from 'node:path';
import { replCompleter } from '../src/repl/completer.js';
import { classifyInput, contextSource, createReplContext } from '../src/repl/context.js';
import { createReplEnvironmentFromGrammar, evalInput, needsMoreInput } from '../src/repl/repl.js';

const grammarPath = path.resolve(__dirname, '../src/grammar/lumina.peg');
const env = createReplEnvironmentFromGrammar(fs.readFileSync(grammarPath, 'utf-8'), grammarPath);

describe('Lumina REPL', () => {
  it('returns empty for blank input', async () => {
    const ctx = createReplContext();
    await expect(evalInput('   ', ctx, env)).resolves.toEqual({ kind: 'empty' });
  });

  it('evaluates expressions and reports inferred types', async () => {
    const ctx = createReplContext();
    const result = await evalInput('1 + 2', ctx, env);
    expect(result.kind).toBe('value');
    if (result.kind !== 'value') return;
    expect(result.value).toBe(3);
    expect(result.type).toBe('i32');
  });

  it('persists function declarations across evaluations', async () => {
    const ctx = createReplContext();
    const declaration = await evalInput('fn double(x: int) -> int { x * 2 }', ctx, env);
    expect(declaration.kind).toBe('declaration');
    if (declaration.kind !== 'declaration') return;
    expect(declaration.name).toBe('double');

    const result = await evalInput('double(21)', ctx, env);
    expect(result.kind).toBe('value');
    if (result.kind !== 'value') return;
    expect(result.value).toBe(42);
    expect(result.type).toBe('i32');
  });

  it('persists top-level let bindings across evaluations', async () => {
    const ctx = createReplContext();
    const declaration = await evalInput('let x = 10', ctx, env);
    expect(declaration.kind).toBe('declaration');

    const result = await evalInput('x + 1', ctx, env);
    expect(result.kind).toBe('value');
    if (result.kind !== 'value') return;
    expect(result.value).toBe(11);
  });

  it('returns structured parse diagnostics for syntax errors', async () => {
    const ctx = createReplContext();
    const result = await evalInput('1 +', ctx, env);
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')).toBe(true);
  });

  it('returns semantic diagnostics for type errors', async () => {
    const ctx = createReplContext();
    const result = await evalInput('let flag: bool = 1', ctx, env);
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')).toBe(true);
  });

  it('classifies declarations and accumulates context source', () => {
    const ctx = createReplContext();
    expect(classifyInput('fn answer() -> int { 42 }')).toBe('declaration');
    expect(classifyInput('1 + 2')).toBe('expression');

    ctx.declarations.push('let x = 1', 'fn answer() -> int { 42 }');
    expect(contextSource(ctx)).toContain('let x = 1');
    expect(contextSource(ctx)).toContain('fn answer() -> int { 42 }');
  });

  it('detects multiline input using delimiter balance', () => {
    expect(needsMoreInput('fn answer() {')).toBe(true);
    expect(needsMoreInput('fn answer() {\n  42\n}')).toBe(false);
    expect(needsMoreInput('[1, 2, 3')).toBe(true);
    expect(needsMoreInput('[1, 2, 3]')).toBe(false);
  });

  it('offers declared symbols in completion results', async () => {
    const ctx = createReplContext();
    await evalInput('fn double(x: int) -> int { x * 2 }', ctx, env);
    const [hits, token] = replCompleter('dou', ctx);
    expect(token).toBe('dou');
    expect(hits).toContain('double');
  });
});
