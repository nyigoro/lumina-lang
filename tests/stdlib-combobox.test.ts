import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const comboboxStdPath = path.resolve(__dirname, '../std/combobox.lm');
const comboboxStdSource = fs.readFileSync(comboboxStdPath, 'utf-8');

describe('@std/combobox', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(comboboxStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('comboboxRoot');
    expect(js).toContain('comboboxPortal');
    expect(js).toContain('comboboxInput');
    expect(js).toContain('comboboxContent');
    expect(js).toContain('comboboxItem');
    expect(js).toContain('comboboxIndicator');
  });
});
