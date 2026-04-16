import luminaGrammarRaw from '../../src/grammar/lumina.peg?raw';
import preludeRaw from '../../std/prelude.lm?raw';
import { compileGrammar as compileLuminaGrammar } from '../../src/grammar/index';
import { BrowserProjectContext } from '../../src/project/browser-context';
import { lowerLumina } from '../../src/lumina/lower';
import { optimizeIR } from '../../src/lumina/optimize';
import { generateJS } from '../../src/lumina/codegen';

export type CompileResult = {
  ok: boolean;
  js: string;
  diagnostics: Array<{ severity: string; message: string; line?: number }>;
};

const compileLuminaSource = (source: string): CompileResult => {
  try {
    const parser = compileLuminaGrammar(luminaGrammarRaw);
    const project = new BrowserProjectContext(parser, { preludeText: preludeRaw });
    project.addOrUpdateDocument('main.lm', source, 1);

    const diagnostics = project.getDiagnostics('main.lm').map(diagnostic => ({
      severity: diagnostic.severity,
      message: diagnostic.message,
      line: diagnostic.location?.start?.line,
    }));
    const hasErrors = diagnostics.some(diagnostic => diagnostic.severity === 'error');
    if (hasErrors) {
      return {
        ok: false,
        js: '',
        diagnostics,
      };
    }

    const ast = project.getDocumentAst('main.lm');
    if (!ast) {
      return {
        ok: false,
        js: '',
        diagnostics: [{ severity: 'error', message: 'No AST produced for main.lm' }],
      };
    }

    const lowered = lowerLumina(ast as never);
    const optimized = optimizeIR(lowered);
    const js = optimized ? generateJS(optimized as never).code : '// No JavaScript output generated.';

    return {
      ok: true,
      js,
      diagnostics,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      js: '',
      diagnostics: [{ severity: 'error', message }],
    };
  }
};

(globalThis as Record<string, unknown>).compileLuminaSource = compileLuminaSource;
