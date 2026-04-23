export type WasmValType = 'i32' | 'i64' | 'f64';

export interface WasmFunctionImport {
  kind: 'func';
  module: string;
  name: string;
  as: string;
  params: WasmValType[];
  results?: WasmValType[];
}

export interface WasmNamedValue {
  name: string;
  type: WasmValType;
}

export interface WasmCustomSection {
  name: string;
  data: string | Uint8Array;
}

export interface WasmDebugMetadata {
  version: 1;
  targetProfile: 'wasm' | 'wasm-web' | 'wasm-standalone';
  sourceFile?: string;
  functionNames: string[];
  exportNames: string[];
  importNames: string[];
}

export type WasmTextImmediate = string | number;

export interface WasmRawInstruction {
  kind: 'raw';
  text: string;
}

export interface WasmOpInstruction {
  kind: 'op';
  op: string;
  immediates?: WasmTextImmediate[];
}

export interface WasmIfInstruction {
  kind: 'if';
  results?: WasmValType[];
  thenBody: WasmTextInstruction[];
  elseBody?: WasmTextInstruction[];
}

export interface WasmBlockInstruction {
  kind: 'block';
  label?: string;
  results?: WasmValType[];
  body: WasmTextInstruction[];
}

export interface WasmLoopInstruction {
  kind: 'loop';
  label?: string;
  results?: WasmValType[];
  body: WasmTextInstruction[];
}

export type WasmTextInstruction =
  | WasmRawInstruction
  | WasmOpInstruction
  | WasmIfInstruction
  | WasmBlockInstruction
  | WasmLoopInstruction;

export interface WasmTextFunction {
  name: string;
  params: WasmNamedValue[];
  results?: WasmValType[];
  locals?: WasmNamedValue[];
  body: WasmTextInstruction[];
  commentsBefore?: string[];
  commentsAfter?: string[];
}

export interface WasmTextModule {
  imports: WasmFunctionImport[];
  memories: string[];
  globals: string[];
  functions: WasmTextFunction[];
  exports: string[];
  data: string[];
  customs: string[];
  customSections: WasmCustomSection[];
  debugMetadata: WasmDebugMetadata | null;
}

export const createEmptyWasmTextModule = (): WasmTextModule => ({
  imports: [],
  memories: [],
  globals: [],
  functions: [],
  exports: [],
  data: [],
  customs: [],
  customSections: [],
  debugMetadata: null,
});

export const wasmFuncImport = (
  module: string,
  name: string,
  as: string,
  params: WasmValType[],
  results: WasmValType[] = []
): WasmFunctionImport => ({
  kind: 'func',
  module,
  name,
  as,
  params,
  results,
});

export const wasmTextFunction = (
  name: string,
  params: WasmNamedValue[],
  body: WasmTextInstruction[],
  options: {
    results?: WasmValType[];
    locals?: WasmNamedValue[];
    commentsBefore?: string[];
    commentsAfter?: string[];
  } = {}
): WasmTextFunction => ({
  name,
  params,
  body,
  results: options.results ?? [],
  locals: options.locals ?? [],
  commentsBefore: options.commentsBefore ?? [],
  commentsAfter: options.commentsAfter ?? [],
});

export const wasmRaw = (text: string): WasmRawInstruction => ({
  kind: 'raw',
  text,
});

export const wasmOp = (op: string, ...immediates: WasmTextImmediate[]): WasmOpInstruction => ({
  kind: 'op',
  op,
  immediates,
});

export const wasmIf = (
  thenBody: WasmTextInstruction[],
  elseBody: WasmTextInstruction[] = [],
  results: WasmValType[] = []
): WasmIfInstruction => ({
  kind: 'if',
  thenBody,
  elseBody,
  results,
});

export const wasmBlock = (
  body: WasmTextInstruction[],
  options: { label?: string; results?: WasmValType[] } = {}
): WasmBlockInstruction => ({
  kind: 'block',
  label: options.label,
  results: options.results ?? [],
  body,
});

export const wasmLoop = (
  body: WasmTextInstruction[],
  options: { label?: string; results?: WasmValType[] } = {}
): WasmLoopInstruction => ({
  kind: 'loop',
  label: options.label,
  results: options.results ?? [],
  body,
});
