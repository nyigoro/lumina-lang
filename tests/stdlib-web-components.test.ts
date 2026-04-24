import fs from 'node:fs';
import path from 'node:path';
import { analyzeLumina } from '../src/lumina/semantic.js';
import { inferProgram } from '../src/lumina/hm-infer.js';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

const webComponentsStdPath = path.resolve(__dirname, '../std/web_components.lm');
const webComponentsStdSource = fs.readFileSync(webComponentsStdPath, 'utf-8');

describe('@std/web_components', () => {
  test('typechecks and emits custom element helpers', () => {
    const ast = parseLuminaProgram(webComponentsStdSource);
    const analysis = analyzeLumina(ast);
    const semanticErrors = analysis.diagnostics.filter((diag) => diag.severity === 'error');
    expect(semanticErrors).toHaveLength(0);

    const inferred = inferProgram(ast);
    const hmErrors = inferred.diagnostics.filter((diag) => diag.severity === 'error');
    expect(hmErrors).toHaveLength(0);

    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('mountCustomElement');
    expect(js).toContain('defineCustomElement');
  });
});
