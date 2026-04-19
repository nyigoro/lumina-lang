import fs from 'node:fs';
import path from 'node:path';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const radioStdPath = path.resolve(__dirname, '../std/radio.lm');
const radioStdSource = fs.readFileSync(radioStdPath, 'utf-8');

describe('@std/radio', () => {
  test('emits runtime helper calls', () => {
    const ast = parseLuminaProgram(radioStdSource);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('radioGroup');
    expect(js).toContain('radioItem');
    expect(js).toContain('radioIndicator');
  });
});
