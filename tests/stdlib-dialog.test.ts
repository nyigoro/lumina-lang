import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';
const dialogStdPath = path.resolve(__dirname, '../std/dialog.lm');
const dialogStdSource = fs.readFileSync(dialogStdPath, 'utf-8');

describe('@std/dialog', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(dialogStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('dialogRoot');
    expect(js).toContain('dialogPortal');
    expect(js).toContain('dialogTrigger');
    expect(js).toContain('dialogOverlay');
    expect(js).toContain('dialogContent');
    expect(js).toContain('dialogTitle');
    expect(js).toContain('dialogDescription');
    expect(js).toContain('dialogClose');
  });
});
