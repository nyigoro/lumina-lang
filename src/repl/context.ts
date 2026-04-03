import type { SymbolTable as LuminaSymbolTable } from '../lumina/semantic.js';

export interface ReplContext {
  declarations: string[];
  symbolTable: LuminaSymbolTable | null;
  history: string[];
  sessionId: number;
}

export function createReplContext(): ReplContext {
  return {
    declarations: [],
    symbolTable: null,
    history: [],
    sessionId: 0,
  };
}

export function contextSource(ctx: ReplContext): string {
  return ctx.declarations.join('\n\n');
}

export function classifyInput(input: string): 'declaration' | 'expression' {
  const trimmed = input.trim();
  return declarationPattern.test(trimmed) ? 'declaration' : 'expression';
}

export function extractDeclarationName(input: string): string | null {
  const trimmed = input.trim();
  for (const pattern of declarationNamePatterns) {
    const match = pattern.exec(trimmed);
    if (match?.[1]) return match[1];
  }
  if (/^(?:pub\s+)?impl\b/.test(trimmed)) return 'impl';
  if (/^(?:pub\s+)?import\b/.test(trimmed)) return 'import';
  if (/^(?:pub\s+)?use\b/.test(trimmed)) return 'use';
  return null;
}

const declarationPattern =
  /^(?:(?:pub|export)\s+)?(?:(?:async|comptime)\s+)?(?:fn|struct|type|enum|trait|impl|let|import|use|macro_rules)\b/;

const declarationNamePatterns = [
  /^(?:pub\s+)?(?:async\s+)?(?:comptime\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^(?:pub\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^(?:pub\s+)?type\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^(?:pub\s+)?enum\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^(?:pub\s+)?trait\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^(?:pub\s+)?let\s+(?:mut\s+|ref\s+mut\s+|ref\s+)?([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^(?:pub\s+)?macro_rules\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
];
