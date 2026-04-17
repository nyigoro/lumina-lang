import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const menuStdPath = path.resolve(__dirname, '../std/menu.lm');
const menuStdSource = fs.readFileSync(menuStdPath, 'utf-8');

describe('@std/menu', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(menuStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('menuRoot');
    expect(js).toContain('menuPortal');
    expect(js).toContain('menuTrigger');
    expect(js).toContain('menuContent');
    expect(js).toContain('menuItem');
  });
});
