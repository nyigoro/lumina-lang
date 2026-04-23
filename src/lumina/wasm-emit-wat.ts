import type {
  WasmBlockInstruction,
  WasmFunctionImport,
  WasmLoopInstruction,
  WasmNamedValue,
  WasmTextFunction,
  WasmTextInstruction,
  WasmTextModule,
} from './wasm-module.js';

const renderFunctionImport = (spec: WasmFunctionImport): string => {
  const params = spec.params.map((param) => ` (param ${param})`).join('');
  const results = (spec.results ?? []).map((result) => ` (result ${result})`).join('');
  return `  (import "${spec.module}" "${spec.name}" (func ${spec.as}${params}${results}))`;
};

const appendSnippets = (lines: string[], snippets: string[]) => {
  for (const snippet of snippets) {
    if (!snippet || snippet.trim().length === 0) continue;
    lines.push(snippet);
  }
};

const appendCustomSectionComments = (
  lines: string[],
  sections: WasmTextModule['customSections']
) => {
  for (const section of sections) {
    const size = typeof section.data === 'string' ? new TextEncoder().encode(section.data).length : section.data.length;
    lines.push(`  ;; custom section ${section.name} (${size} bytes)`);
  }
};

const renderNamedValues = (values: WasmNamedValue[], kind: 'param' | 'local'): string =>
  values.map((value) => `(${kind} $${value.name} ${value.type})`).join(' ');

const renderResults = (results: string[] | undefined): string =>
  (results ?? []).map((result) => ` (result ${result})`).join('');

const renderBlockHeader = (
  keyword: 'block' | 'loop',
  instruction: WasmBlockInstruction | WasmLoopInstruction
): string => {
  const label = instruction.label ? ` ${instruction.label}` : '';
  return `(${keyword}${label}${renderResults(instruction.results)}`;
};

const renderInstructionLines = (instruction: WasmTextInstruction, indent: string): string[] => {
  if (instruction.kind === 'raw') return [`${indent}${instruction.text}`];
  if (instruction.kind === 'op') {
    const immediates = (instruction.immediates ?? []).map(String);
    return [`${indent}${[instruction.op, ...immediates].join(' ')}`];
  }
  if (instruction.kind === 'if') {
    const lines: string[] = [`${indent}if${renderResults(instruction.results)}`];
    for (const item of instruction.thenBody) {
      lines.push(...renderInstructionLines(item, `${indent}  `));
    }
    if ((instruction.elseBody ?? []).length > 0) {
      lines.push(`${indent}else`);
      for (const item of instruction.elseBody ?? []) {
        lines.push(...renderInstructionLines(item, `${indent}  `));
      }
    }
    lines.push(`${indent}end`);
    return lines;
  }
  if (instruction.kind === 'block') {
    const lines: string[] = [`${indent}${renderBlockHeader('block', instruction)}`];
    for (const item of instruction.body) {
      lines.push(...renderInstructionLines(item, `${indent}  `));
    }
    lines.push(`${indent})`);
    return lines;
  }
  const loopInstruction = instruction as WasmLoopInstruction;
  const lines: string[] = [`${indent}${renderBlockHeader('loop', loopInstruction)}`];
  for (const item of loopInstruction.body) {
    lines.push(...renderInstructionLines(item, `${indent}  `));
  }
  lines.push(`${indent})`);
  return lines;
};

const renderFunction = (fn: WasmTextFunction): string => {
  const lines: string[] = [];
  lines.push(...(fn.commentsBefore ?? []));
  const params = renderNamedValues(fn.params, 'param');
  const results = (fn.results ?? []).map((result) => `(result ${result})`).join(' ');
  const header = ['  (func', `$${fn.name}`, params, results].filter((part) => part && part.trim().length > 0).join(' ');
  lines.push(header);
  const locals = fn.locals ?? [];
  if (locals.length > 0) {
    lines.push(`  ${renderNamedValues(locals, 'local')}`);
  }
  for (const instruction of fn.body) {
    lines.push(...renderInstructionLines(instruction, '    '));
  }
  lines.push('  )');
  lines.push(...(fn.commentsAfter ?? []));
  return lines.join('\n');
};

export const emitWAT = (module: WasmTextModule): string => {
  const lines: string[] = ['(module'];
  module.imports.forEach((spec) => {
    lines.push(renderFunctionImport(spec));
  });
  appendSnippets(lines, module.memories);
  appendSnippets(lines, module.globals);
  module.functions.forEach((fn) => {
    lines.push(renderFunction(fn));
  });
  appendSnippets(lines, module.exports);
  appendSnippets(lines, module.data);
  appendSnippets(lines, module.customs);
  appendCustomSectionComments(lines, module.customSections);
  lines.push(')');
  return lines.join('\n') + '\n';
};
