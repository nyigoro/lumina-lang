import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const multiselectStdPath = path.resolve(__dirname, '../std/multiselect.lm');
const multiselectStdSource = fs.readFileSync(multiselectStdPath, 'utf-8');

describe('@std/multiselect', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(multiselectStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('multiselectRoot');
    expect(js).toContain('multiselectPortal');
    expect(js).toContain('multiselectTrigger');
    expect(js).toContain('multiselectContent');
    expect(js).toContain('multiselectItem');
    expect(js).toContain('multiselectIndicator');
  });
});
