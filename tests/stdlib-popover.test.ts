import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const popoverStdPath = path.resolve(__dirname, '../std/popover.lm');
const popoverStdSource = fs.readFileSync(popoverStdPath, 'utf-8');

describe('@std/popover', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(popoverStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('popoverRoot');
    expect(js).toContain('popoverPortal');
    expect(js).toContain('popoverTrigger');
    expect(js).toContain('popoverContent');
  });
});
