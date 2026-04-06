import luminaGrammarRaw from '../src/grammar/lumina.peg?raw';
import preludeRaw from '../std/prelude.lm?raw';
import { compileGrammar as compileLuminaGrammar } from '../src/grammar/index';
import { BrowserProjectContext } from '../src/project/browser-context';
import { lowerLumina } from '../src/lumina/lower';
import { optimizeIR } from '../src/lumina/optimize';
import { generateJS } from '../src/lumina/codegen';

export interface CompileDiagnostic {
  severity: string;
  message: string;
  line?: number;
}

export interface CompileResult {
  ok: boolean;
  js: string;
  output: string;
  diagnostics: CompileDiagnostic[];
}

export function compileLuminaSource(source: string): CompileResult {
  try {
    const parser = compileLuminaGrammar(luminaGrammarRaw);
    const project = new BrowserProjectContext(parser, { preludeText: preludeRaw });
    project.registerVirtualFile(
      'lib/math.lm',
      'pub fn add(a: int, b: int) -> int { return a + b; }'
    );
    project.addOrUpdateDocument('main.lm', source, 1);

    const diagnostics = project.getDiagnostics('main.lm').map((d) => ({
      severity: d.severity,
      message: d.message,
      line: d.location?.start?.line,
    }));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    if (errors.length > 0) {
      const output = `// Errors:\n${diagnostics.map((d) => {
        const prefix = d.line ? `line ${d.line}: ` : '';
        return `${prefix}${d.message}`;
      }).join('\n')}`;
      return { ok: false, js: '', output, diagnostics };
    }

    const ast = project.getDocumentAst('main.lm');
    if (!ast) {
      return {
        ok: false,
        js: '',
        output: '// Error: No AST produced',
        diagnostics: [{ severity: 'error', message: 'No AST produced' }],
      };
    }

    const lowered = lowerLumina(ast as never);
    const optimized = optimizeIR(lowered);
    const js = optimized ? generateJS(optimized as never).code : '// IR optimized away';
    return { ok: true, js, output: js, diagnostics };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : String(error);
    return {
      ok: false,
      js: '',
      output: `// Error:\n${message}`,
      diagnostics: [{ severity: 'error', message }],
    };
  }
}

const bridgeTarget = globalThis as Record<string, unknown>;
bridgeTarget.luminaCompile = compileLuminaSource;
bridgeTarget.luminaCompileOutput = (source: string): string => compileLuminaSource(source).output;
bridgeTarget.luminaCompileStatus = (source: string): string =>
  compileLuminaSource(source).ok ? 'ok' : 'error';
