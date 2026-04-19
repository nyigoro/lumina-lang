import fs from 'node:fs';
import path from 'node:path';
import { analyzeLumina } from '../src/lumina/semantic.js';
import { inferProgram } from '../src/lumina/hm-infer.js';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const storeStdPath = path.resolve(__dirname, '../std/store.lm');
const storeStdSource = fs.readFileSync(storeStdPath, 'utf-8');

describe('@std/store', () => {
  test('typechecks and emits store helpers', () => {
    const ast = parseLuminaProgram(storeStdSource);
    const analysis = analyzeLumina(ast);
    const semanticErrors = analysis.diagnostics.filter((diag) => diag.severity === 'error');
    expect(semanticErrors).toHaveLength(0);

    const inferred = inferProgram(ast);
    const hmErrors = inferred.diagnostics.filter((diag) => diag.severity === 'error');
    expect(hmErrors).toHaveLength(0);

    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('createStore');
    expect(js).toContain('fromSignal');
    expect(js).toContain('toSignal');
    expect(js).toContain('selectMemo');
    expect(js).toContain('createSignal');
    expect(js).toContain('createMemo');
    expect(js).toContain('createContext');
    expect(js).toContain('provider');
    expect(js).toContain('useStore');
  });
});
