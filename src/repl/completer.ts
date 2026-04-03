import type { ReplContext } from './context.js';

const commandCandidates = [':help', ':clear', ':ctx', ':load', ':quit', ':exit'];

const keywordCandidates = [
  'fn',
  'async',
  'let',
  'mut',
  'ref',
  'if',
  'else',
  'match',
  'while',
  'for',
  'in',
  'return',
  'struct',
  'enum',
  'type',
  'trait',
  'impl',
  'pub',
  'true',
  'false',
  'await',
  'import',
];

const moduleCandidates = ['@std/io', '@std/iter', '@std/math', '@std/query', '@std/reactive', '@std/render'];

export function replCompleter(line: string, ctx: ReplContext): [string[], string] {
  const token = currentToken(line);
  if (token.startsWith(':')) {
    const hits = commandCandidates.filter((candidate) => candidate.startsWith(token));
    return [hits.length > 0 ? hits : commandCandidates, token];
  }

  const declaredNames = new Set<string>();
  for (const symbol of ctx.symbolTable?.list() ?? []) {
    if (symbol.name.startsWith('__lumina_repl_')) continue;
    declaredNames.add(symbol.name);
  }

  const candidates = Array.from(new Set([...declaredNames, ...keywordCandidates, ...moduleCandidates])).sort();
  const hits = token.length > 0 ? candidates.filter((candidate) => candidate.startsWith(token)) : candidates;
  return [hits.length > 0 ? hits : candidates, token];
}

function currentToken(line: string): string {
  const match = /[:@./A-Za-z0-9_-]*$/.exec(line);
  return match?.[0] ?? '';
}
