import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const checkboxStdPath = path.resolve(__dirname, '../std/checkbox.lm');
const checkboxStdSource = fs.readFileSync(checkboxStdPath, 'utf-8');

describe('@std/checkbox', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(checkboxStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('checkboxRoot');
    expect(js).toContain('checkboxIndicator');
  });
});
