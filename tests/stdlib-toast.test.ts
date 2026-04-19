import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const toastStdPath = path.resolve(__dirname, '../std/toast.lm');
const toastStdSource = fs.readFileSync(toastStdPath, 'utf-8');

describe('@std/toast', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(toastStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('toastRoot');
    expect(js).toContain('toastPortal');
    expect(js).toContain('toastContent');
    expect(js).toContain('toastTitle');
    expect(js).toContain('toastDescription');
    expect(js).toContain('toastClose');
  });
});
