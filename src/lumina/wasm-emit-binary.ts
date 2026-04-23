import type {
  WasmCustomSection,
  WasmDebugMetadata,
  WasmFunctionImport,
  WasmTextFunction,
  WasmTextImmediate,
  WasmTextInstruction,
  WasmTextModule,
  WasmValType,
} from './wasm-module.js';

type ParsedMemory = {
  min: number;
  max?: number;
  exportName?: string;
};

type ParsedGlobal = {
  name: string;
  type: WasmValType;
  mutable: boolean;
  initOp: 'i32.const' | 'i64.const' | 'f64.const';
  initValue: number;
};

type ParsedExport = {
  name: string;
  kind: 'func' | 'memory' | 'global';
  target: string;
};

type ParsedData = {
  offset: number;
  bytes: Uint8Array;
};

type LabelFrame = {
  label?: string;
};

type BinaryEncodeContext = {
  functionIndices: Map<string, number>;
  globalIndices: Map<string, number>;
};

const WASM_MAGIC_AND_VERSION = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

const VALUE_TYPE_BYTES: Record<WasmValType, number> = {
  i32: 0x7f,
  i64: 0x7e,
  f64: 0x7c,
};

const OPCODES: Record<string, number> = {
  'unreachable': 0x00,
  'nop': 0x01,
  'br': 0x0c,
  'br_if': 0x0d,
  'return': 0x0f,
  'call': 0x10,
  'drop': 0x1a,
  'local.get': 0x20,
  'local.set': 0x21,
  'local.tee': 0x22,
  'global.get': 0x23,
  'global.set': 0x24,
  'i32.load': 0x28,
  'i64.load': 0x29,
  'f64.load': 0x2b,
  'i32.load8_u': 0x2d,
  'i32.store': 0x36,
  'i64.store': 0x37,
  'f64.store': 0x39,
  'i32.store8': 0x3a,
  'memory.size': 0x3f,
  'memory.grow': 0x40,
  'i32.const': 0x41,
  'i64.const': 0x42,
  'f64.const': 0x44,
  'i32.eqz': 0x45,
  'i32.eq': 0x46,
  'i32.ne': 0x47,
  'i32.lt_s': 0x48,
  'i32.lt_u': 0x49,
  'i32.gt_s': 0x4a,
  'i32.gt_u': 0x4b,
  'i32.le_s': 0x4c,
  'i32.le_u': 0x4d,
  'i32.ge_s': 0x4e,
  'i32.ge_u': 0x4f,
  'i64.eqz': 0x50,
  'i64.eq': 0x51,
  'i64.ne': 0x52,
  'i64.lt_s': 0x53,
  'i64.lt_u': 0x54,
  'i64.gt_s': 0x55,
  'i64.gt_u': 0x56,
  'i64.le_s': 0x57,
  'i64.le_u': 0x58,
  'i64.ge_s': 0x59,
  'i64.ge_u': 0x5a,
  'f64.eq': 0x61,
  'f64.ne': 0x62,
  'f64.lt': 0x63,
  'f64.gt': 0x64,
  'f64.le': 0x65,
  'f64.ge': 0x66,
  'i32.add': 0x6a,
  'i32.sub': 0x6b,
  'i32.mul': 0x6c,
  'i32.div_s': 0x6d,
  'i32.div_u': 0x6e,
  'i32.rem_s': 0x6f,
  'i32.rem_u': 0x70,
  'i32.and': 0x71,
  'i32.or': 0x72,
  'i32.xor': 0x73,
  'i32.shl': 0x74,
  'i32.shr_s': 0x75,
  'i32.shr_u': 0x76,
  'i64.add': 0x7c,
  'i64.sub': 0x7d,
  'i64.mul': 0x7e,
  'i64.div_s': 0x7f,
  'i64.div_u': 0x80,
  'i64.rem_s': 0x81,
  'i64.rem_u': 0x82,
  'i64.and': 0x83,
  'i64.or': 0x84,
  'i64.xor': 0x85,
  'i64.shl': 0x86,
  'i64.shr_s': 0x87,
  'i64.shr_u': 0x88,
  'f64.abs': 0x99,
  'f64.neg': 0x9a,
  'f64.add': 0xa0,
  'f64.sub': 0xa1,
  'f64.mul': 0xa2,
  'f64.div': 0xa3,
  'i32.wrap_i64': 0xa7,
  'i32.trunc_f64_s': 0xaa,
  'i32.trunc_f64_u': 0xab,
  'i64.extend_i32_s': 0xac,
  'i64.extend_i32_u': 0xad,
  'i64.trunc_f64_s': 0xb0,
  'i64.trunc_f64_u': 0xb1,
  'f64.convert_i32_s': 0xb7,
  'f64.convert_i32_u': 0xb8,
  'f64.convert_i64_s': 0xb9,
  'f64.convert_i64_u': 0xba,
};

const MEMORY_ALIGN: Record<string, number> = {
  'i32.load': 2,
  'i64.load': 3,
  'f64.load': 3,
  'i32.load8_u': 0,
  'i32.store': 2,
  'i64.store': 3,
  'f64.store': 3,
  'i32.store8': 0,
};

const stripDollar = (value: string): string => value.replace(/^\$/, '');

const concatBytes = (...parts: Array<Uint8Array | number[]>): Uint8Array => {
  const arrays = parts.map((part) => (part instanceof Uint8Array ? part : Uint8Array.from(part)));
  const total = arrays.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const encodeU32 = (value: number): number[] => {
  let remaining = Math.max(0, Math.trunc(value >>> 0));
  const out: number[] = [];
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    out.push(byte);
  } while (remaining !== 0);
  return out;
};

const encodeS32 = (value: number): number[] => {
  let remaining = Math.trunc(value);
  const out: number[] = [];
  let more = true;
  while (more) {
    let byte = remaining & 0x7f;
    remaining >>= 7;
    const signBitSet = (byte & 0x40) !== 0;
    more = !((remaining === 0 && !signBitSet) || (remaining === -1 && signBitSet));
    if (more) byte |= 0x80;
    out.push(byte);
  }
  return out;
};

const encodeS64 = (value: bigint): number[] => {
  let remaining = BigInt.asIntN(64, value);
  const out: number[] = [];
  let more = true;
  while (more) {
    let byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    const signBitSet = (byte & 0x40) !== 0;
    more = !((remaining === 0n && !signBitSet) || (remaining === -1n && signBitSet));
    if (more) byte |= 0x80;
    out.push(byte);
  }
  return out;
};

const encodeF64 = (value: number): Uint8Array => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value, true);
  return out;
};

const encodeName = (value: string): Uint8Array => {
  const bytes = new TextEncoder().encode(value);
  return concatBytes(encodeU32(bytes.length), bytes);
};

const encodeVector = (parts: Uint8Array[]): Uint8Array =>
  concatBytes(encodeU32(parts.length), ...parts);

const encodeSection = (id: number, payload: Uint8Array): Uint8Array =>
  concatBytes([id], encodeU32(payload.length), payload);

const encodeCustomSection = (name: string, data: string | Uint8Array): Uint8Array => {
  const payloadBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return encodeSection(0, concatBytes(encodeName(name), payloadBytes));
};

const parseMemorySnippets = (snippets: string[]): ParsedMemory[] => {
  const memories: ParsedMemory[] = [];
  for (const snippet of snippets) {
    for (const line of snippet.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('(memory')) continue;
      const exportMatch = trimmed.match(/\(export "([^"]+)"\)/);
      const numericParts = [...trimmed.matchAll(/\b\d+\b/g)].map((match) => Number(match[0]));
      if (numericParts.length === 0) {
        throw new Error(`Unsupported memory declaration: ${trimmed}`);
      }
      memories.push({
        min: numericParts[0],
        max: numericParts.length > 1 ? numericParts[1] : undefined,
        exportName: exportMatch?.[1],
      });
    }
  }
  return memories;
};

const parseGlobalSnippets = (snippets: string[]): ParsedGlobal[] => {
  const globals: ParsedGlobal[] = [];
  for (const snippet of snippets) {
    for (const line of snippet.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('(global')) continue;
      const match = trimmed.match(
        /^\(global\s+\$([^\s()]+)\s+(?:\(mut\s+(i32|i64|f64)\)|(i32|i64|f64))\s+\(((i32|i64|f64)\.const)\s+([^)]+)\)\)$/
      );
      if (!match) {
        throw new Error(`Unsupported global declaration: ${trimmed}`);
      }
      const mutable = Boolean(match[2]);
      const type = (match[2] ?? match[3]) as WasmValType;
      const initOp = match[4] as ParsedGlobal['initOp'];
      const rawValue = match[6].trim();
      globals.push({
        name: match[1],
        type,
        mutable,
        initOp,
        initValue: Number(rawValue),
      });
    }
  }
  return globals;
};

const parseExportSnippets = (snippets: string[]): ParsedExport[] => {
  const exports: ParsedExport[] = [];
  for (const snippet of snippets) {
    for (const line of snippet.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('(export')) continue;
      const match = trimmed.match(/^\(export "([^"]+)" \((func|memory|global) \$?([^)]+)\)\)$/);
      if (!match) throw new Error(`Unsupported export declaration: ${trimmed}`);
      exports.push({
        name: match[1],
        kind: match[2] as ParsedExport['kind'],
        target: match[3],
      });
    }
  }
  return exports;
};

const decodeDataString = (literal: string): Uint8Array => {
  const bytes: number[] = [];
  for (let i = 0; i < literal.length; i += 1) {
    const ch = literal[i];
    if (ch === '\\') {
      const hex = literal.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        i += 2;
        continue;
      }
      if (i + 1 < literal.length) {
        bytes.push(literal.charCodeAt(i + 1));
        i += 1;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0));
  }
  return Uint8Array.from(bytes);
};

const parseDataSnippets = (snippets: string[]): ParsedData[] => {
  const data: ParsedData[] = [];
  for (const snippet of snippets) {
    for (const line of snippet.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('(data')) continue;
      const match = trimmed.match(/^\(data \(i32\.const (\d+)\) "((?:\\.|[^"])*)"\)/);
      if (!match) throw new Error(`Unsupported data declaration: ${trimmed}`);
      data.push({
        offset: Number(match[1]),
        bytes: decodeDataString(match[2]),
      });
    }
  }
  return data;
};

const encodeLimits = (min: number, max?: number): Uint8Array =>
  max == null ? concatBytes([0x00], encodeU32(min)) : concatBytes([0x01], encodeU32(min), encodeU32(max));

const encodeMemoryImmediate = (op: string, immediates: WasmTextImmediate[] = []): Uint8Array => {
  let align = MEMORY_ALIGN[op];
  let offset = 0;
  for (const immediate of immediates) {
    const text = String(immediate);
    const alignMatch = text.match(/^align=(\d+)$/);
    if (alignMatch) {
      const rawAlign = Number(alignMatch[1]);
      align = rawAlign > 0 ? Math.log2(rawAlign) : 0;
      continue;
    }
    const offsetMatch = text.match(/^offset=(\d+)$/);
    if (offsetMatch) {
      offset = Number(offsetMatch[1]);
    }
  }
  return concatBytes(encodeU32(align), encodeU32(offset));
};

const resolveLocalIndex = (name: WasmTextImmediate | undefined, localIndices: Map<string, number>): number => {
  if (typeof name === 'number') return name;
  const key = stripDollar(String(name));
  const resolved = localIndices.get(key);
  if (resolved == null) {
    throw new Error(`Unknown local '${String(name)}' in WASM binary emission`);
  }
  return resolved;
};

const resolveBranchDepth = (name: WasmTextImmediate | undefined, labelStack: LabelFrame[]): number => {
  if (typeof name === 'number') return name;
  const target = String(name);
  for (let depth = 0; depth < labelStack.length; depth += 1) {
    const frame = labelStack[labelStack.length - 1 - depth];
    if (frame.label === target || frame.label === stripDollar(target)) return depth;
  }
  throw new Error(`Unknown label '${target}' in WASM binary emission`);
};

const encodeInstruction = (
  instruction: WasmTextInstruction,
  ctx: BinaryEncodeContext,
  localIndices: Map<string, number>,
  labelStack: LabelFrame[]
): Uint8Array => {
  if (instruction.kind === 'raw') {
    const trimmed = instruction.text.trim();
    if (trimmed.length === 0) return new Uint8Array();
    if (trimmed.startsWith(';;')) return new Uint8Array();
    if (trimmed.includes('(') || trimmed.includes(')')) {
      throw new Error(`Unsupported raw instruction during binary emission: ${trimmed}`);
    }
    const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
    return encodeInstruction(
      { kind: 'op', op: parts[0], immediates: parts.slice(1) },
      ctx,
      localIndices,
      labelStack
    );
  }

  if (instruction.kind === 'block' || instruction.kind === 'loop') {
    const opcode = instruction.kind === 'block' ? 0x02 : 0x03;
    const blockType =
      (instruction.results?.length ?? 0) === 0
        ? new Uint8Array([0x40])
        : new Uint8Array([VALUE_TYPE_BYTES[instruction.results![0]]]);
    if ((instruction.results?.length ?? 0) > 1) {
      throw new Error('Multi-value block results are not yet supported in binary emission');
    }
    const nextStack = [...labelStack, { label: instruction.label }];
    return concatBytes(
      [opcode],
      blockType,
      encodeInstructionList(instruction.body, ctx, localIndices, nextStack),
      [0x0b]
    );
  }

  if (instruction.kind === 'if') {
    const blockType =
      (instruction.results?.length ?? 0) === 0
        ? new Uint8Array([0x40])
        : new Uint8Array([VALUE_TYPE_BYTES[instruction.results![0]]]);
    if ((instruction.results?.length ?? 0) > 1) {
      throw new Error('Multi-value if results are not yet supported in binary emission');
    }
    const nextStack = [...labelStack, {}];
    const thenBytes = encodeInstructionList(instruction.thenBody, ctx, localIndices, nextStack);
    const elseBytes = encodeInstructionList(instruction.elseBody ?? [], ctx, localIndices, nextStack);
    return (instruction.elseBody?.length ?? 0) > 0
      ? concatBytes([0x04], blockType, thenBytes, [0x05], elseBytes, [0x0b])
      : concatBytes([0x04], blockType, thenBytes, [0x0b]);
  }

  const opcode = OPCODES[instruction.op];
  if (opcode == null) {
    throw new Error(`Unsupported WASM opcode '${instruction.op}'`);
  }
  const immediates = instruction.immediates ?? [];

  switch (instruction.op) {
    case 'local.get':
    case 'local.set':
    case 'local.tee':
      return concatBytes([opcode], encodeU32(resolveLocalIndex(immediates[0], localIndices)));
    case 'global.get':
    case 'global.set': {
      const name = stripDollar(String(immediates[0] ?? ''));
      const index = ctx.globalIndices.get(name);
      if (index == null) throw new Error(`Unknown global '${name}' in WASM binary emission`);
      return concatBytes([opcode], encodeU32(index));
    }
    case 'call': {
      const name = stripDollar(String(immediates[0] ?? ''));
      const index = ctx.functionIndices.get(name);
      if (index == null) throw new Error(`Unknown function '${name}' in WASM binary emission`);
      return concatBytes([opcode], encodeU32(index));
    }
    case 'br':
    case 'br_if':
      return concatBytes([opcode], encodeU32(resolveBranchDepth(immediates[0], labelStack)));
    case 'memory.size':
    case 'memory.grow':
      return concatBytes([opcode], [0x00]);
    case 'i32.load':
    case 'i64.load':
    case 'f64.load':
    case 'i32.load8_u':
    case 'i32.store':
    case 'i64.store':
    case 'f64.store':
    case 'i32.store8':
      return concatBytes([opcode], encodeMemoryImmediate(instruction.op, immediates));
    case 'i32.const':
      return concatBytes([opcode], encodeS32(Number(immediates[0] ?? 0)));
    case 'i64.const':
      return concatBytes([opcode], encodeS64(BigInt(String(immediates[0] ?? 0))));
    case 'f64.const':
      return concatBytes([opcode], encodeF64(Number(immediates[0] ?? 0)));
    default:
      return new Uint8Array([opcode]);
  }
};

const encodeInstructionList = (
  instructions: WasmTextInstruction[],
  ctx: BinaryEncodeContext,
  localIndices: Map<string, number>,
  labelStack: LabelFrame[]
): Uint8Array => concatBytes(...instructions.map((instruction) => encodeInstruction(instruction, ctx, localIndices, labelStack)));

const encodeFunctionBody = (
  fn: WasmTextFunction,
  ctx: BinaryEncodeContext
): Uint8Array => {
  const params = fn.params ?? [];
  const locals = fn.locals ?? [];
  const localIndices = new Map<string, number>();
  params.forEach((param, index) => localIndices.set(param.name, index));
  locals.forEach((local, index) => localIndices.set(local.name, params.length + index));

  const localGroups = new Map<WasmValType, number>();
  for (const local of locals) {
    localGroups.set(local.type, (localGroups.get(local.type) ?? 0) + 1);
  }
  const encodedGroups = Array.from(localGroups.entries()).map(([type, count]) =>
    concatBytes(encodeU32(count), [VALUE_TYPE_BYTES[type]])
  );
  const body = encodeInstructionList(fn.body, ctx, localIndices, []);
  const payload = concatBytes(encodeVector(encodedGroups), body, [0x0b]);
  return concatBytes(encodeU32(payload.length), payload);
};

const parseFunctionTypeKey = (params: WasmValType[], results: WasmValType[]): string =>
  `${params.join(',')}->${results.join(',')}`;

const encodeTypeSection = (imports: WasmFunctionImport[], functions: WasmTextFunction[]) => {
  const signatures = new Map<string, number>();
  const encoded: Uint8Array[] = [];
  const getIndex = (params: WasmValType[], results: WasmValType[]) => {
    const key = parseFunctionTypeKey(params, results);
    const existing = signatures.get(key);
    if (existing != null) return existing;
    const index = encoded.length;
    signatures.set(key, index);
    encoded.push(
      concatBytes(
        [0x60],
        encodeU32(params.length),
        params.map((param) => VALUE_TYPE_BYTES[param]),
        encodeU32(results.length),
        results.map((result) => VALUE_TYPE_BYTES[result])
      )
    );
    return index;
  };

  const importTypeIndices = imports.map((spec) => getIndex(spec.params, spec.results ?? []));
  const functionTypeIndices = functions.map((fn) => getIndex(fn.params.map((param) => param.type), fn.results ?? []));
  return {
    section: encodeSection(1, encodeVector(encoded)),
    importTypeIndices,
    functionTypeIndices,
  };
};

const encodeImportSection = (imports: WasmFunctionImport[], typeIndices: number[]): Uint8Array | null => {
  if (imports.length === 0) return null;
  const entries = imports.map((spec, index) =>
    concatBytes(encodeName(spec.module), encodeName(spec.name), [0x00], encodeU32(typeIndices[index]))
  );
  return encodeSection(2, encodeVector(entries));
};

const encodeFunctionSection = (functions: WasmTextFunction[], typeIndices: number[]): Uint8Array | null => {
  if (functions.length === 0) return null;
  const payload = concatBytes(encodeU32(functions.length), ...typeIndices.map((index) => Uint8Array.from(encodeU32(index))));
  return encodeSection(3, payload);
};

const encodeMemorySection = (memories: ParsedMemory[]): Uint8Array | null => {
  if (memories.length === 0) return null;
  const entries = memories.map((memory) => encodeLimits(memory.min, memory.max));
  return encodeSection(5, encodeVector(entries));
};

const encodeInitExpr = (global: ParsedGlobal): Uint8Array => {
  const opcode = OPCODES[global.initOp];
  if (global.initOp === 'i64.const') {
    return concatBytes([opcode], encodeS64(BigInt(Math.trunc(global.initValue))), [0x0b]);
  }
  if (global.initOp === 'f64.const') {
    return concatBytes([opcode], encodeF64(global.initValue), [0x0b]);
  }
  return concatBytes([opcode], encodeS32(Math.trunc(global.initValue)), [0x0b]);
};

const encodeGlobalSection = (globals: ParsedGlobal[]): Uint8Array | null => {
  if (globals.length === 0) return null;
  const entries = globals.map((global) =>
    concatBytes([VALUE_TYPE_BYTES[global.type], global.mutable ? 0x01 : 0x00], encodeInitExpr(global))
  );
  return encodeSection(6, encodeVector(entries));
};

const encodeExportSection = (
  exports: ParsedExport[],
  memories: ParsedMemory[],
  ctx: BinaryEncodeContext
): Uint8Array | null => {
  const entries: Uint8Array[] = [];
  memories.forEach((memory, index) => {
    if (!memory.exportName) return;
    entries.push(concatBytes(encodeName(memory.exportName), [0x02], encodeU32(index)));
  });
  for (const entry of exports) {
    if (entry.kind === 'func') {
      const index = ctx.functionIndices.get(stripDollar(entry.target));
      if (index == null) throw new Error(`Unknown exported function '${entry.target}'`);
      entries.push(concatBytes(encodeName(entry.name), [0x00], encodeU32(index)));
      continue;
    }
    if (entry.kind === 'global') {
      const index = ctx.globalIndices.get(stripDollar(entry.target));
      if (index == null) throw new Error(`Unknown exported global '${entry.target}'`);
      entries.push(concatBytes(encodeName(entry.name), [0x03], encodeU32(index)));
      continue;
    }
    const memoryIndex = Number(entry.target);
    entries.push(concatBytes(encodeName(entry.name), [0x02], encodeU32(Number.isFinite(memoryIndex) ? memoryIndex : 0)));
  }
  if (entries.length === 0) return null;
  return encodeSection(7, encodeVector(entries));
};

const encodeCodeSection = (functions: WasmTextFunction[], ctx: BinaryEncodeContext): Uint8Array | null => {
  if (functions.length === 0) return null;
  const bodies = functions.map((fn) => encodeFunctionBody(fn, ctx));
  return encodeSection(10, encodeVector(bodies));
};

const encodeDataSection = (data: ParsedData[]): Uint8Array | null => {
  if (data.length === 0) return null;
  const entries = data.map((segment) =>
    concatBytes([0x00], [OPCODES['i32.const']], encodeS32(segment.offset), [0x0b], encodeU32(segment.bytes.length), segment.bytes)
  );
  return encodeSection(11, encodeVector(entries));
};

const encodeNameSection = (imports: WasmFunctionImport[], functions: WasmTextFunction[]): Uint8Array | null => {
  const functionEntries: Uint8Array[] = [];
  imports.forEach((spec, index) => {
    functionEntries.push(concatBytes(encodeU32(index), encodeName(stripDollar(spec.as))));
  });
  const importedCount = imports.length;
  functions.forEach((fn, index) => {
    functionEntries.push(concatBytes(encodeU32(importedCount + index), encodeName(fn.name)));
  });

  const localEntries: Uint8Array[] = [];
  functions.forEach((fn, index) => {
    const names = [...(fn.params ?? []), ...(fn.locals ?? [])];
    if (names.length === 0) return;
    const encodedNames = names.map((name, localIndex) => concatBytes(encodeU32(localIndex), encodeName(name.name)));
    localEntries.push(concatBytes(encodeU32(importedCount + index), encodeVector(encodedNames)));
  });

  const subsections: Uint8Array[] = [];
  if (functionEntries.length > 0) {
    const payload = encodeVector(functionEntries);
    subsections.push(concatBytes([0x01], encodeU32(payload.length), payload));
  }
  if (localEntries.length > 0) {
    const payload = encodeVector(localEntries);
    subsections.push(concatBytes([0x02], encodeU32(payload.length), payload));
  }
  if (subsections.length === 0) return null;
  const content = concatBytes(encodeName('name'), ...subsections);
  return encodeSection(0, content);
};

const encodeDebugSection = (metadata: WasmDebugMetadata | null): Uint8Array | null => {
  if (!metadata) return null;
  return encodeCustomSection('lumina.debug', JSON.stringify(metadata));
};

const encodeAdditionalCustomSections = (sections: WasmCustomSection[]): Uint8Array[] =>
  sections.map((section) => encodeCustomSection(section.name, section.data));

export const emitWasmBinary = (
  module: WasmTextModule,
  options: { includeNameSection?: boolean; includeDebugSection?: boolean } = {}
): Uint8Array => {
  const parsedMemories = parseMemorySnippets(module.memories);
  const parsedGlobals = parseGlobalSnippets(module.globals);
  const parsedExports = parseExportSnippets(module.exports);
  const parsedData = parseDataSnippets(module.data);

  const functionIndices = new Map<string, number>();
  module.imports.forEach((spec, index) => functionIndices.set(stripDollar(spec.as), index));
  module.functions.forEach((fn, index) => functionIndices.set(fn.name, module.imports.length + index));

  const globalIndices = new Map<string, number>();
  parsedGlobals.forEach((global, index) => globalIndices.set(global.name, index));

  const typeInfo = encodeTypeSection(module.imports, module.functions);
  const ctx: BinaryEncodeContext = { functionIndices, globalIndices };

  const sections: Uint8Array[] = [typeInfo.section];
  const importSection = encodeImportSection(module.imports, typeInfo.importTypeIndices);
  if (importSection) sections.push(importSection);
  const functionSection = encodeFunctionSection(module.functions, typeInfo.functionTypeIndices);
  if (functionSection) sections.push(functionSection);
  const memorySection = encodeMemorySection(parsedMemories);
  if (memorySection) sections.push(memorySection);
  const globalSection = encodeGlobalSection(parsedGlobals);
  if (globalSection) sections.push(globalSection);
  const exportSection = encodeExportSection(parsedExports, parsedMemories, ctx);
  if (exportSection) sections.push(exportSection);
  const codeSection = encodeCodeSection(module.functions, ctx);
  if (codeSection) sections.push(codeSection);
  const dataSection = encodeDataSection(parsedData);
  if (dataSection) sections.push(dataSection);
  if (options.includeDebugSection !== false) {
    const debugSection = encodeDebugSection(module.debugMetadata);
    if (debugSection) sections.push(debugSection);
  }
  sections.push(...encodeAdditionalCustomSections(module.customSections));
  if (options.includeNameSection !== false) {
    const nameSection = encodeNameSection(module.imports, module.functions);
    if (nameSection) sections.push(nameSection);
  }

  return concatBytes(WASM_MAGIC_AND_VERSION, ...sections);
};
