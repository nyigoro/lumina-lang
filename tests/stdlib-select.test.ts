import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const selectStdPath = path.resolve(__dirname, '../std/select.lm');
const selectStdSource = fs.readFileSync(selectStdPath, 'utf-8');

describe('@std/select', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(selectStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('selectRoot');
    expect(js).toContain('selectPortal');
    expect(js).toContain('selectTrigger');
    expect(js).toContain('selectContent');
    expect(js).toContain('selectItem');
    expect(js).toContain('selectIndicator');
  });
});
