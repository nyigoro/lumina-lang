import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import vm from 'node:vm';
import { compileGrammar, type CompiledGrammar } from '../grammar/index.js';
import { type LuminaProgram, type LuminaStatement, type LuminaExpr } from '../lumina/ast.js';
import { generateJS } from '../lumina/codegen.js';
import { generateJSFromAst } from '../lumina/codegen-js.js';
import { comptimePass } from '../lumina/comptime.js';
import { inferProgram } from '../lumina/hm-infer.js';
import { inlinePass } from '../lumina/inline.js';
import { createLuminaLexer, luminaSyncTokenTypes, type LuminaToken } from '../lumina/lexer.js';
import { lowerLumina } from '../lumina/lower.js';
import { monomorphize } from '../lumina/monomorphize.js';
import { analyzeLumina } from '../lumina/semantic.js';
import { fuseVecPipelines } from '../lumina/stream-fusion.js';
import { type ConstExpr, type Type } from '../lumina/types.js';
import { type Diagnostic } from '../parser/index.js';
import { parseWithPanicRecovery } from '../project/panic.js';
import { classifyInput, contextSource, createReplContext, extractDeclarationName, type ReplContext } from './context.js';
import { replCompleter } from './completer.js';
import { printResult } from './printer.js';

export interface ReplEnvironment {
  parser: CompiledGrammar<unknown>;
  grammarPath?: string;
  lexer: ReturnType<typeof createLuminaLexer>;
}

export type ReplResult =
  | { kind: 'empty' }
  | { kind: 'value'; value: unknown; type: string; diagnostics?: Diagnostic[] }
  | { kind: 'declaration'; name: string; diagnostics?: Diagnostic[] }
  | { kind: 'error'; diagnostics: Diagnostic[] };

type ReadlineWithHistory = readline.Interface & { history: string[] };
type EvaluationTarget =
  | { kind: 'binding'; resultName: string }
  | { kind: 'wrapper'; wrapperName: string; wrapperMode: 'body' | 'return' };

const REPL_HISTORY_FILE = path.join(os.homedir(), '.lumina_repl_history');
const syncKeywordValues = ['import', 'type', 'struct', 'enum', 'fn', 'let', 'return', 'if', 'else', 'for', 'while', 'match', 'extern', 'pub'];

function writeStdout(line: string): void {
  process.stdout.write(`${line}\n`);
}

function writeStderr(line: string): void {
  process.stderr.write(`${line}\n`);
}

export async function createReplEnvironment(grammarPath: string): Promise<ReplEnvironment> {
  const grammarText = await fsPromises.readFile(grammarPath, 'utf-8');
  return createReplEnvironmentFromGrammar(grammarText, grammarPath);
}

export function createReplEnvironmentFromGrammar(grammarText: string, grammarPath?: string): ReplEnvironment {
  return {
  parser: compileGrammar(grammarText, { cache: true }),
    grammarPath,
    lexer: createLuminaLexer(),
  };
}

export async function evalInput(input: string, ctx: ReplContext, env: ReplEnvironment): Promise<ReplResult> {
  return evaluateSource(input, ctx, env, 'auto');
}

export async function loadSource(input: string, ctx: ReplContext, env: ReplEnvironment): Promise<ReplResult> {
  return evaluateSource(input, ctx, env, 'declaration');
}

export function needsMoreInput(input: string): boolean {
  if (/\\\s*$/.test(input)) return true;

  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (!inDouble && !inBacktick && ch === '\'') {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      continue;
    }

    if (inSingle || inDouble || inBacktick) continue;

    if (ch === '(') parenDepth += 1;
    if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === '[') bracketDepth += 1;
    if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (ch === '{') braceDepth += 1;
    if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
  }

  return parenDepth > 0 || bracketDepth > 0 || braceDepth > 0 || inSingle || inDouble || inBacktick;
}

export async function startLuminaRepl(grammarPath: string): Promise<void> {
  const env = await createReplEnvironment(grammarPath);
  const ctx = createReplContext();

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'lumina> ',
      completer: (line: string) => replCompleter(line, ctx),
      terminal: true,
    });

    loadHistory(rl as ReadlineWithHistory);

    writeStdout('Lumina REPL');
    writeStdout('Commands: :help, :clear, :ctx, :load <file>, :exit');
    rl.prompt();

    let buffer = '';

    rl.on('line', async (line) => {
      const trimmed = line.trim();

      if (!buffer && trimmed.startsWith(':')) {
        const handled = await handleCommand(trimmed, ctx, env, rl);
        if (handled === 'exit') return;
        rl.prompt();
        return;
      }

      const nextInput = buffer ? `${buffer}\n${line}` : line;
      if (needsMoreInput(nextInput)) {
        buffer = nextInput;
        rl.setPrompt('.....> ');
        rl.prompt();
        return;
      }

      rl.pause();
      rl.setPrompt('lumina> ');
      buffer = '';

      const normalized = nextInput.replace(/\\\s*$/gm, '').trimEnd();
      if (normalized.trim().length > 0) {
        ctx.history.push(normalized);
        saveHistoryLine(normalized);
      }

      try {
        const result = await evalInput(normalized, ctx, env);
        printResult(result);
      } catch (error) {
        printResult({ kind: 'error', diagnostics: [runtimeDiagnostic(error)] });
      } finally {
        rl.resume();
        rl.prompt();
      }
    });

    rl.on('SIGINT', () => {
      rl.close();
    });

    rl.on('close', () => {
      writeStdout('Bye.');
      resolve();
    });
  });
}

async function handleCommand(
  line: string,
  ctx: ReplContext,
  env: ReplEnvironment,
  rl: readline.Interface
): Promise<'handled' | 'exit'> {
  if (line === ':help') {
    writeStdout('  :help       Show this message');
    writeStdout('  :clear      Clear accumulated declarations');
    writeStdout('  :ctx        Show the current declaration context');
    writeStdout('  :load FILE  Load a Lumina source file into the current session');
    writeStdout('  :exit       Exit the REPL');
    return 'handled';
  }

  if (line === ':clear') {
    ctx.declarations.length = 0;
    ctx.symbolTable = null;
    writeStdout('Context cleared.');
    return 'handled';
  }

  if (line === ':ctx') {
    writeStdout(contextSource(ctx) || '(empty)');
    return 'handled';
  }

  if (line === ':exit' || line === ':quit') {
    rl.close();
    return 'exit';
  }

  if (line.startsWith(':load ')) {
    const target = line.slice(6).trim();
    if (!target) {
      writeStderr('error: missing file path for :load');
      return 'handled';
    }
    const resolved = path.resolve(target);
    try {
      const source = await fsPromises.readFile(resolved, 'utf-8');
      const result = await loadSource(source, ctx, env);
      if (result.kind === 'error') {
        printResult(result);
      } else {
        if (result.kind !== 'empty' && result.diagnostics && result.diagnostics.length > 0) {
          printResult({ kind: 'declaration', name: path.basename(resolved), diagnostics: result.diagnostics });
        } else {
          writeStdout(`loaded: ${resolved}`);
        }
      }
    } catch (error) {
      printResult({ kind: 'error', diagnostics: [runtimeDiagnostic(error, 'REPL-LOAD')] });
    }
    return 'handled';
  }

  writeStderr(`error: unknown command '${line}'`);
  return 'handled';
}

async function evaluateSource(
  input: string,
  ctx: ReplContext,
  env: ReplEnvironment,
  mode: 'auto' | 'declaration'
): Promise<ReplResult> {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'empty' };

  const declarationMode = mode === 'declaration' || classifyInput(trimmed) === 'declaration';
  const evalId = declarationMode ? null : ctx.sessionId++;
  const resultName = evalId === null ? null : `__lumina_repl_result_${evalId}`;
  const wrapperName = evalId === null ? null : `__lumina_repl_eval_${evalId}`;
  const attemptedSources = declarationMode || !resultName || !wrapperName
    ? [{ source: buildSource(ctx, trimmed), target: null as EvaluationTarget | null }]
    : [
        { source: buildSource(ctx, trimmed, { kind: 'binding', resultName }), target: { kind: 'binding', resultName } as EvaluationTarget },
        {
          source: buildSource(ctx, trimmed, { kind: 'wrapper', wrapperName, wrapperMode: 'return' }),
          target: { kind: 'wrapper', wrapperName, wrapperMode: 'return' } as EvaluationTarget,
        },
        {
          source: buildSource(ctx, trimmed, { kind: 'wrapper', wrapperName, wrapperMode: 'body' }),
          target: { kind: 'wrapper', wrapperName, wrapperMode: 'body' } as EvaluationTarget,
        },
      ];

  let parsed: { program: LuminaProgram | null; diagnostics: Diagnostic[] } | null = null;
  let program: LuminaProgram | null = null;
  let selectedTarget: EvaluationTarget | null = null;

  for (const candidate of attemptedSources) {
    const nextParsed = parseProgram(candidate.source, env);
    if (!parsed) parsed = nextParsed;
    if (nextParsed.program && !hasErrors(nextParsed.diagnostics)) {
      parsed = nextParsed;
      program = materializeImplicitReturns(nextParsed.program);
      selectedTarget = candidate.target;
      break;
    }
  }

  if (!parsed || !program) {
    return { kind: 'error', diagnostics: parsed?.diagnostics ?? [runtimeDiagnostic('Failed to parse REPL input', 'REPL-PARSE')] };
  }

  const analysis = analyzeLumina(program, { stopOnUnresolvedMemberError: true });
  if (hasErrors(analysis.diagnostics)) {
    return { kind: 'error', diagnostics: mergeDiagnostics(parsed.diagnostics, analysis.diagnostics) };
  }

  const typedProgram = cloneProgram(program);
  const inferred = inferProgram(typedProgram, { useRowPolymorphism: true });
  if (hasErrors(inferred.diagnostics)) {
    return { kind: 'error', diagnostics: mergeDiagnostics(parsed.diagnostics, analysis.diagnostics, inferred.diagnostics) };
  }

  const executableProgram = cloneProgram(program);
  const monomorphized = monomorphize(executableProgram, { inferredCalls: inferred.inferredCalls });
  const comptimeResult = comptimePass(monomorphized);
  if (hasErrors(comptimeResult.diagnostics ?? [])) {
    return {
      kind: 'error',
      diagnostics: mergeDiagnostics(parsed.diagnostics, analysis.diagnostics, inferred.diagnostics, comptimeResult.diagnostics ?? []),
    };
  }
  const inlined = inlinePass(comptimeResult.ast as never).ast;
  const fused = fuseVecPipelines(inlined as never);
  let generated: { code: string; map?: unknown };
  let warnings = collectNonErrorDiagnostics(parsed.diagnostics, analysis.diagnostics, inferred.diagnostics, comptimeResult.diagnostics ?? []);

  if (programUsesAstOnlySyntax(fused)) {
    const codegenAnalysis = analyzeLumina(fused as never, { stopOnUnresolvedMemberError: true });
    if (hasErrors(codegenAnalysis.diagnostics)) {
      return {
        kind: 'error',
        diagnostics: mergeDiagnostics(
          parsed.diagnostics,
          analysis.diagnostics,
          inferred.diagnostics,
          comptimeResult.diagnostics ?? [],
          codegenAnalysis.diagnostics
        ),
      };
    }

    warnings = collectNonErrorDiagnostics(
      parsed.diagnostics,
      analysis.diagnostics,
      inferred.diagnostics,
      comptimeResult.diagnostics ?? [],
      codegenAnalysis.diagnostics
    );
    generated = generateJSFromAst(fused as never, {
      target: 'cjs',
      includeRuntime: false,
      traitMethodResolutions: codegenAnalysis.traitMethodResolutions,
    });
  } else {
    const lowered = lowerLumina(fused as never);
    generated = generateJS(lowered, {
      target: 'cjs',
      includeRuntime: false,
    });
  }

  try {
    const sandbox = createSandbox();
    vm.runInContext(generated.code, sandbox, { timeout: 1000 });
    ctx.symbolTable = analysis.symbols;
    if (declarationMode || !selectedTarget) {
      ctx.declarations.push(trimmed);
      return {
        kind: 'declaration',
        name: extractDeclarationName(trimmed) ?? 'declaration',
        diagnostics: warnings.length > 0 ? warnings : undefined,
      };
    }

    const value = await Promise.resolve(
      selectedTarget.kind === 'binding'
        ? vm.runInContext(selectedTarget.resultName, sandbox, { timeout: 1000 })
        : vm.runInContext(`${selectedTarget.wrapperName}()`, sandbox, { timeout: 1000 })
    );
    const inferredType = inferResultType(
      typedProgram,
      inferred,
      selectedTarget.kind === 'binding' ? selectedTarget.resultName : selectedTarget.wrapperName
    );
    return {
      kind: 'value',
      value,
      type: inferredType,
      diagnostics: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      kind: 'error',
      diagnostics: [runtimeDiagnostic(error)],
    };
  }
}

function buildSource(
  ctx: ReplContext,
  input: string,
  target: EvaluationTarget | null = null
): string {
  const declarations = contextSource(ctx);
  const parts: string[] = [];
  if (declarations.trim().length > 0) {
    parts.push(declarations.trimEnd());
  }
  if (target?.kind === 'binding') {
    parts.push(`let ${target.resultName} = ${input}`);
  } else if (target?.kind === 'wrapper') {
    const wrapped = input
      .split(/\r?\n/)
      .map((line) => (line.length > 0 ? `  ${line}` : ''))
      .join('\n');
    if (target.wrapperMode === 'return') {
      parts.push(`fn ${target.wrapperName}() {\n  return ${input}\n}`);
    } else {
      parts.push(`fn ${target.wrapperName}() {\n${wrapped}\n}`);
    }
  } else {
    parts.push(input);
  }
  return parts.join('\n\n').trimEnd() + '\n';
}

function parseProgram(source: string, env: ReplEnvironment): { program: LuminaProgram | null; diagnostics: Diagnostic[] } {
  const parsed = parseWithPanicRecovery<LuminaProgram>(env.parser, source, {
    syncTokenTypes: luminaSyncTokenTypes,
    syncKeywordValues,
    lexer: (input: string) => {
      const stream = env.lexer.reset(input);
      return {
        [Symbol.iterator]: function* () {
          for (const token of stream as Iterable<LuminaToken>) {
            yield token;
          }
        },
      };
    },
  });

  const payload = parsed.result;
  if (!payload || typeof payload !== 'object' || !('success' in payload) || payload.success !== true) {
    return { program: null, diagnostics: parsed.diagnostics };
  }

  return {
    program: payload.result as LuminaProgram,
    diagnostics: parsed.diagnostics,
  };
}

function inferResultType(program: LuminaProgram, inferred: ReturnType<typeof inferProgram>, resultName: string): string {
  const wrapper = program.body.find(
    (stmt): stmt is Extract<LuminaStatement, { type: 'FnDecl' }> => stmt.type === 'FnDecl' && stmt.name === resultName
  );
  if (wrapper) {
    const resultType = findLastStatementType(wrapper.body.body, inferred) ?? inferred.inferredFnReturns.get(resultName) ?? null;
    return resultType ? formatType(unwrapPromiseType(resultType)) : 'unknown';
  }

  const binding = program.body.find(
    (stmt): stmt is Extract<LuminaStatement, { type: 'Let' }> => stmt.type === 'Let' && stmt.name === resultName
  );
  if (binding) {
    const resultType = getExprType(binding.value, inferred);
    return resultType ? formatType(unwrapPromiseType(resultType)) : 'unknown';
  }

  return 'unknown';
}

function findLastStatementType(
  statements: LuminaStatement[],
  inferred: ReturnType<typeof inferProgram>
): Type | null {
  const last = statements[statements.length - 1];
  if (!last) return null;
  if (last.type === 'ExprStmt') {
    return getExprType(last.expr, inferred);
  }
  if (last.type === 'Return') {
    return getExprType(last.value, inferred);
  }
  if (last.type === 'Block') {
    return findLastStatementType(last.body, inferred);
  }
  return null;
}

function getExprType(expr: LuminaExpr, inferred: ReturnType<typeof inferProgram>): Type | null {
  if (typeof expr.id !== 'number') return null;
  return inferred.inferredExprs.get(expr.id) ?? null;
}

function unwrapPromiseType(type: Type): Type {
  return type.kind === 'promise' ? unwrapPromiseType(type.inner) : type;
}

function formatType(type: Type): string {
  switch (type.kind) {
    case 'primitive':
      return normalizePrimitiveType(type.name);
    case 'hole':
      return '_';
    case 'variable':
      return `unknown(t${type.id})`;
    case 'function':
      return `(${type.args.map(formatType).join(', ')}) -> ${formatType(type.returnType)}`;
    case 'adt': {
      const typeArgs = type.params.map(formatType);
      const constArgs = (type.constArgs ?? []).map(formatConstExpr);
      const args = [...typeArgs, ...constArgs];
      return args.length > 0 ? `${type.name}<${args.join(', ')}>` : type.name;
    }
    case 'array':
      return type.size ? `[${formatType(type.element)}; ${formatConstExpr(type.size)}]` : `[${formatType(type.element)}]`;
    case 'row': {
      const fields = Array.from(type.fields.entries()).map(([name, value]) => `${name}: ${formatType(value)}`);
      const tail = type.tail ? ` | ${formatType(type.tail)}` : '';
      return `{ ${fields.join(', ')}${tail} }`;
    }
    case 'promise':
      return `Promise<${formatType(type.inner)}>`;
    default:
      return 'unknown';
  }
}

function formatConstExpr(expr: ConstExpr): string {
  switch (expr.kind) {
    case 'const-literal':
      return String(expr.value);
    case 'const-param':
      return expr.name;
    case 'const-unary':
      return `${expr.op}${formatConstExpr(expr.expr)}`;
    case 'const-binary':
      return `${formatConstExpr(expr.left)} ${expr.op} ${formatConstExpr(expr.right)}`;
    case 'const-call':
      return `${expr.name}(${expr.args.map(formatConstExpr).join(', ')})`;
    case 'const-if':
      return `if ${formatConstExpr(expr.condition)} { ${formatConstExpr(expr.thenExpr)} } else { ${formatConstExpr(expr.elseExpr)} }`;
    default:
      return '_';
  }
}

function normalizePrimitiveType(name: string): string {
  if (name === 'int') return 'i32';
  if (name === 'float') return 'f64';
  if (name === 'usize') return 'u32';
  return name;
}

function materializeImplicitReturns(program: LuminaProgram): LuminaProgram {
  for (const statement of program.body) {
    if (statement.type === 'FnDecl') {
      materializeFunctionBody(statement.body.body);
    }
  }
  return program;
}

function materializeFunctionBody(statements: LuminaStatement[]): void {
  const last = statements[statements.length - 1];
  if (!last || last.type !== 'ExprStmt') return;
  statements[statements.length - 1] = {
    type: 'Return',
    value: last.expr,
    location: last.location,
  };
}

function programUsesAstOnlySyntax(program: unknown): boolean {
  const visitExpr = (expr: unknown): boolean => {
    if (!expr || typeof expr !== 'object') return false;
    const node = expr as { type?: string; [key: string]: unknown };
    if (
      node.type === 'Lambda' ||
      node.type === 'ListComprehension' ||
      node.type === 'ArrayLiteral' ||
      node.type === 'TupleLiteral' ||
      node.type === 'SelectExpr'
    ) {
      return true;
    }
    switch (node.type) {
      case 'Binary':
        return visitExpr(node.left) || visitExpr(node.right);
      case 'Call':
        return visitExpr(node.receiver) || (Array.isArray(node.args) ? node.args.some((arg) => visitExpr(arg)) : false);
      case 'ArrayLiteral':
        return Array.isArray(node.elements) ? node.elements.some((element) => visitExpr(element)) : false;
      case 'Member':
        return visitExpr(node.object);
      case 'StructLiteral':
        return Array.isArray(node.fields)
          ? node.fields.some((field) => visitExpr((field as { value?: unknown }).value))
          : false;
      case 'MatchExpr':
        return (
          visitExpr(node.value) ||
          (Array.isArray(node.arms)
            ? node.arms.some((arm) => {
                const armNode = arm as { body?: unknown; guard?: unknown; pattern?: { type?: string } };
                if (armNode.guard && visitExpr(armNode.guard)) return true;
                const patternType = armNode.pattern?.type;
                if (patternType && patternType !== 'EnumPattern' && patternType !== 'WildcardPattern') return true;
                return visitExpr(armNode.body);
              })
            : false)
        );
      case 'IsExpr':
      case 'Cast':
      case 'Await':
      case 'Try':
      case 'Move':
        return visitExpr(node.value ?? node.expr ?? node.target);
      case 'InterpolatedString':
        return Array.isArray(node.parts)
          ? node.parts.some((part) => typeof part === 'object' && part !== null && visitExpr(part))
          : false;
      case 'SelectExpr':
        return Array.isArray(node.arms)
          ? node.arms.some((arm) => {
              const armNode = arm as { value?: unknown; body?: unknown };
              return visitExpr(armNode.value) || visitExpr(armNode.body);
            })
          : false;
      case 'Range':
        return visitExpr(node.start) || visitExpr(node.end);
      case 'Index':
        return visitExpr(node.object) || visitExpr(node.index);
      default:
        return false;
    }
  };

  const visitStmt = (stmt: unknown): boolean => {
    if (!stmt || typeof stmt !== 'object') return false;
    const node = stmt as { type?: string; [key: string]: unknown };
    switch (node.type) {
      case 'FnDecl':
        return Array.isArray((node.body as { body?: unknown[] } | undefined)?.body)
          ? (node.body as { body: unknown[] }).body.some((inner) => visitStmt(inner))
          : false;
      case 'LetElse':
      case 'IfLet':
      case 'WhileLet':
      case 'Break':
      case 'Continue':
        return true;
      case 'Let':
      case 'Return':
      case 'ExprStmt':
        return visitExpr(node.value ?? node.expr);
      case 'Assign':
        return visitExpr(node.target) || visitExpr(node.value);
      case 'If':
        return visitExpr(node.condition) || visitStmt(node.thenBlock) || (node.elseBlock ? visitStmt(node.elseBlock) : false);
      case 'While':
        return visitExpr(node.condition) || visitStmt(node.body);
      case 'MatchStmt':
        return (
          visitExpr(node.value) ||
          (Array.isArray(node.arms)
            ? node.arms.some((arm) => {
                const armNode = arm as { body?: unknown; guard?: unknown; pattern?: { type?: string } };
                if (armNode.guard && visitExpr(armNode.guard)) return true;
                const patternType = armNode.pattern?.type;
                if (patternType && patternType !== 'EnumPattern' && patternType !== 'WildcardPattern') return true;
                return visitStmt(armNode.body);
              })
            : false)
        );
      case 'Block':
      case 'Program':
        return Array.isArray(node.body) ? node.body.some((inner) => visitStmt(inner)) : false;
      default:
        return false;
    }
  };

  const body = (program as { body?: unknown[] } | null)?.body;
  return Array.isArray(body) ? body.some((stmt) => visitStmt(stmt)) : false;
}

function createSandbox(): vm.Context {
  const module = { exports: {} as Record<string, unknown> };
  const sandbox = {
    AbortController,
    AbortSignal,
    Array,
    Boolean,
    Buffer,
    Date,
    Error,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    RegExp,
    Set,
    String,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    WeakMap,
    WeakSet,
    clearInterval,
    clearTimeout,
    console,
    crypto: globalThis.crypto,
    fetch: globalThis.fetch,
    performance: globalThis.performance,
    queueMicrotask,
    setInterval,
    setTimeout,
    structuredClone: globalThis.structuredClone,
    module,
    exports: module.exports,
  } as Record<string, unknown>;

  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  return vm.createContext(sandbox);
}

function cloneProgram(program: LuminaProgram): LuminaProgram {
  return JSON.parse(JSON.stringify(program)) as LuminaProgram;
}

function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

function collectNonErrorDiagnostics(...groups: ReadonlyArray<readonly Diagnostic[]>): Diagnostic[] {
  return filterInternalDiagnostics(dedupeDiagnostics(groups.flat().filter((diagnostic) => diagnostic.severity !== 'error')));
}

function mergeDiagnostics(...groups: ReadonlyArray<readonly Diagnostic[]>): Diagnostic[] {
  return filterInternalDiagnostics(dedupeDiagnostics(groups.flat()));
}

function dedupeDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const next: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.severity,
      diagnostic.code ?? '',
      diagnostic.message,
      diagnostic.location?.start.line ?? '',
      diagnostic.location?.start.column ?? '',
      diagnostic.location?.end.line ?? '',
      diagnostic.location?.end.column ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(diagnostic);
  }
  return next;
}

function runtimeDiagnostic(error: unknown, code = 'REPL-RUNTIME'): Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  return {
    severity: 'error',
    code,
    message,
    source: 'lumina-repl',
  };
}

function filterInternalDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((diagnostic) => !/__lumina_repl_(?:eval|result)_\d+/.test(diagnostic.message));
}

function loadHistory(rl: ReadlineWithHistory): void {
  try {
    if (!fs.existsSync(REPL_HISTORY_FILE)) return;
    const entries = fs
      .readFileSync(REPL_HISTORY_FILE, 'utf-8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    rl.history = entries.reverse();
  } catch {
    // Ignore history load errors.
  }
}

function saveHistoryLine(line: string): void {
  try {
    fs.appendFileSync(REPL_HISTORY_FILE, `${line}\n`);
  } catch {
    // Ignore history save errors.
  }
}
