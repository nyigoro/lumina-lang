import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

type CompilerModule = {
  compileGrammar: (grammar: string) => unknown;
  parseLumina: (parser: unknown, input: string, options?: Record<string, unknown>) => unknown;
  generateJSFromAst: (
    program: unknown,
    options?: { target?: 'esm' | 'cjs'; includeRuntime?: boolean; sourceMap?: boolean; sourceFile?: string; sourceContent?: string }
  ) => { code: string };
};

const importStatementRegex = /^\s*import\s+.+?from\s+["']([^"']+)["'];?\s*$/gm;

const normalizeSpecifier = (fromDir: string, toFile: string): string => {
  let relativePath = path.relative(fromDir, toFile).replace(/\\/g, '/');
  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
};

const collectPublicExports = (source: string): string[] => {
  const patterns = [
    /^\s*pub\s+fn\s+([A-Za-z_][A-Za-z0-9_]*)/gm,
    /^\s*pub\s+let\s+([A-Za-z_][A-Za-z0-9_]*)/gm,
    /^\s*pub\s+struct\s+([A-Za-z_][A-Za-z0-9_]*)/gm,
    /^\s*pub\s+enum\s+([A-Za-z_][A-Za-z0-9_]*)/gm,
  ];
  const names = new Set<string>();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) names.add(match[1]);
    }
  }
  return Array.from(names);
};

const appendExports = (code: string, names: string[]): string => {
  if (names.length === 0) return code;
  return `${code.trimEnd()}\nexport { ${Array.from(new Set(names)).join(', ')} };\n`;
};

const collectLocalImportStatements = (source: string): string[] => {
  const statements: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importStatementRegex.exec(source)) !== null) {
    const spec = match[1];
    if (spec.startsWith('./') || spec.startsWith('../')) {
      statements.push(match[0].trim());
    }
  }
  return statements;
};

export function luminaPlugin(): Plugin {
  const demoRoot = path.resolve(__dirname);
  const repoRoot = path.resolve(demoRoot, '..');
  const grammarPath = path.join(repoRoot, 'src', 'grammar', 'lumina.peg');
  const runtimePath = path.join(repoRoot, 'dist', 'lumina-runtime.js');

  let compilerPromise: Promise<CompilerModule> | null = null;
  let parserPromise: Promise<unknown> | null = null;

  const getCompiler = async (): Promise<CompilerModule> => {
    if (!compilerPromise) {
      compilerPromise = import(pathToFileUrl(path.join(repoRoot, 'dist', 'index.js')).href) as Promise<CompilerModule>;
    }
    return compilerPromise;
  };

  const getParser = async (): Promise<unknown> => {
    if (!parserPromise) {
      parserPromise = (async () => {
        const compiler = await getCompiler();
        const grammar = fs.readFileSync(grammarPath, 'utf-8');
        return compiler.compileGrammar(grammar);
      })();
    }
    return parserPromise;
  };

  const compileModule = async (id: string): Promise<string> => {
    const compiler = await getCompiler();
    const parser = await getParser();
    const source = fs.readFileSync(id, 'utf-8');
    const ast = compiler.parseLumina(parser, source, { grammarSource: id });
    const generated = compiler.generateJSFromAst(ast, {
      target: 'esm',
      includeRuntime: true,
      sourceMap: false,
      sourceFile: id,
      sourceContent: source,
    });
    const runtimeSpecifier = normalizeSpecifier(path.dirname(id), runtimePath);
    const rewritten = generated.code.replace(/from\s+["']\.\/lumina-runtime\.js["']/g, `from ${JSON.stringify(runtimeSpecifier)}`);
    const localImports = collectLocalImportStatements(source);
    const withLocalImports = localImports.length > 0 ? `${localImports.join('\n')}\n${rewritten}` : rewritten;
    return appendExports(withLocalImports, collectPublicExports(source));
  };

  return {
    name: 'vite-plugin-lumina',
    enforce: 'pre',
    async transform(_code, id) {
      if (!id.endsWith('.lm')) return null;
      try {
        return {
          code: await compileModule(id),
          map: null,
        };
      } catch (error) {
        this.error(`Lumina plugin error in ${id}:\n${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    },
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.lm')) return;
      server.ws.send({ type: 'full-reload' });
    },
  };
}

function pathToFileUrl(filePath: string): URL {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return new URL(`file://${withLeadingSlash}`);
}
