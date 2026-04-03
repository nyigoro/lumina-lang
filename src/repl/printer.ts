import { inspect } from 'node:util';
import type { Diagnostic } from '../parser/index.js';
import type { ReplResult } from './repl.js';

export function printResult(result: ReplResult): void {
  if (result.kind === 'empty') return;

  if (result.kind === 'error') {
    printDiagnostics(result.diagnostics);
    return;
  }

  if (result.diagnostics && result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics);
  }

  if (result.kind === 'declaration') {
    console.log(`defined: ${result.name}`);
    return;
  }

  console.log(`=> ${formatValue(result.value)} : ${result.type}`);
}

export function formatValue(value: unknown): string {
  if (value === undefined) return '()';
  if (typeof value === 'string') return JSON.stringify(value);
  return inspect(value, {
    colors: false,
    depth: 6,
    breakLength: 80,
    sorted: true,
  });
}

function printDiagnostics(diagnostics: readonly Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const code = diagnostic.code ? `[${diagnostic.code}] ` : '';
    console.error(`${diagnostic.severity}: ${code}${diagnostic.message}`);
    if (diagnostic.location?.start) {
      console.error(`  --> line ${diagnostic.location.start.line}, column ${diagnostic.location.start.column}`);
    }
  }
}
