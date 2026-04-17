import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';
const tabsStdPath = path.resolve(__dirname, '../std/tabs.lm');
const tabsStdSource = fs.readFileSync(tabsStdPath, 'utf-8');

describe('@std/tabs', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(tabsStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('tabsRoot');
    expect(js).toContain('tabsList');
    expect(js).toContain('tabsTrigger');
    expect(js).toContain('tabsPanel');
  });
});
