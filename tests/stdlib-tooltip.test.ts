import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const tooltipStdPath = path.resolve(__dirname, '../std/tooltip.lm');
const tooltipStdSource = fs.readFileSync(tooltipStdPath, 'utf-8');

describe('@std/tooltip', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(tooltipStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('tooltipRoot');
    expect(js).toContain('tooltipPortal');
    expect(js).toContain('tooltipTrigger');
    expect(js).toContain('tooltipContent');
  });
});
