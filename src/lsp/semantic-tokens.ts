import { SemanticTokensBuilder, type SemanticTokens, type SemanticTokensLegend } from 'vscode-languageserver/node';
import { createLuminaLexer } from '../lumina/lexer.js';
import type { SymbolInfo } from '../lumina/semantic.js';

export const semanticTokenTypes = [
  'keyword',
  'string',
  'number',
  'operator',
  'variable',
  'function',
  'class',
  'type',
  'comment',
] as const;

export const semanticTokenModifiers = [
  'declaration',
  'definition',
  'readonly',
  'defaultLibrary',
] as const;

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes: [...semanticTokenTypes],
  tokenModifiers: [...semanticTokenModifiers],
};

const builtinTypes = new Set([
  'int',
  'float',
  'string',
  'bool',
  'void',
  'any',
  'i8',
  'i32',
  'i64',
  'i128',
  'u8',
  'u16',
  'u32',
  'u64',
  'u128',
  'f32',
  'f64',
  'usize',
  'VNode',
  'Signal',
  'Memo',
  'Effect',
  'Renderer',
]);

const declarationKeywords = new Set(['fn', 'let', 'struct', 'enum', 'type', 'trait', 'impl']);

type TokenLike = {
  type: string;
  text: string;
  line?: number;
  col?: number;
};

function buildSymbolKindMap(symbols: SymbolInfo[]): Map<string, 'function' | 'class' | 'variable'> {
  const map = new Map<string, 'function' | 'class' | 'variable'>();
  for (const sym of symbols) {
    if (sym.kind === 'function') map.set(sym.name, 'function');
    else if (sym.kind === 'type') map.set(sym.name, 'class');
    else map.set(sym.name, 'variable');
  }
  return map;
}

function modifierMask(modifiers: (typeof semanticTokenModifiers)[number][]): number {
  let mask = 0;
  for (const modifier of modifiers) {
    const index = semanticTokenModifiers.indexOf(modifier);
    if (index >= 0) mask |= 1 << index;
  }
  return mask;
}

function previousSignificantToken(tokens: TokenLike[], index: number): TokenLike | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (token.type !== 'ws' && token.type !== 'newline' && token.type !== 'comment') return token;
  }
  return null;
}

function nextSignificantToken(tokens: TokenLike[], index: number): TokenLike | null {
  for (let i = index + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type !== 'ws' && token.type !== 'newline' && token.type !== 'comment') return token;
  }
  return null;
}

export function buildSemanticTokensData(text: string, symbols: SymbolInfo[]): number[] {
  const symbolMap = buildSymbolKindMap(symbols);
  const builder = new SemanticTokensBuilder();
  const lexer = createLuminaLexer();
  lexer.reset(text);
  const tokens = [...lexer] as TokenLike[];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'ws' || token.type === 'newline') continue;
    let tokenType: (typeof semanticTokenTypes)[number] | null = null;
    const modifiers: (typeof semanticTokenModifiers)[number][] = [];
    if (token.type === 'keyword') tokenType = 'keyword';
    else if (token.type === 'string') tokenType = 'string';
    else if (token.type === 'number') tokenType = 'number';
    else if (token.type === 'op') tokenType = 'operator';
    else if (token.type === 'comment') tokenType = 'comment';
    else if (token.type === 'identifier') {
      const previous = previousSignificantToken(tokens, index);
      const next = nextSignificantToken(tokens, index);
      if (builtinTypes.has(token.text)) {
        tokenType = 'type';
        modifiers.push('defaultLibrary');
      } else if (next?.type === 'op' && next.text === '!') {
        tokenType = 'function';
        modifiers.push('declaration');
      } else {
        tokenType = symbolMap.get(token.text) ?? 'variable';
      }
      if (previous?.type === 'keyword' && declarationKeywords.has(previous.text)) {
        modifiers.push('declaration', 'definition');
      }
    }
    if (!tokenType) continue;
    const line = Math.max(0, (token.line ?? 1) - 1);
    const char = Math.max(0, (token.col ?? 1) - 1);
    builder.push(line, char, token.text.length, semanticTokenTypes.indexOf(tokenType), modifierMask(modifiers));
  }
  return builder.build().data;
}

export function buildSemanticTokens(text: string, symbols: SymbolInfo[]): SemanticTokens {
  return { data: buildSemanticTokensData(text, symbols) };
}
