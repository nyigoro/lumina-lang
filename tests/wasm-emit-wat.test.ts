import { emitWAT } from '../src/lumina/wasm-emit-wat.js';
import {
  createEmptyWasmTextModule,
  wasmBlock,
  wasmFuncImport,
  wasmIf,
  wasmLoop,
  wasmOp,
  wasmTextFunction,
} from '../src/lumina/wasm-module.js';

describe('WASM WAT emitter', () => {
  it('renders a structured top-level module in stable section order', () => {
    const module = createEmptyWasmTextModule();
    module.imports.push(wasmFuncImport('env', 'print_int', '$print_int', ['i32']));
    module.memories.push('  (memory (export "memory") 1)');
    module.globals.push('  (global $heap_ptr (mut i32) (i32.const 4096))');
    module.functions.push(wasmTextFunction('main', [], [wasmOp('i32.const', 1)], { results: ['i32'] }));
    module.exports.push('  (export "main" (func $main))');
    module.data.push('  (data (i32.const 32) "\\68\\69")');

    expect(emitWAT(module)).toBe(
      [
        '(module',
        '  (import "env" "print_int" (func $print_int (param i32)))',
        '  (memory (export "memory") 1)',
        '  (global $heap_ptr (mut i32) (i32.const 4096))',
        '  (func $main (result i32)',
        '    i32.const 1',
        '  )',
        '  (export "main" (func $main))',
        '  (data (i32.const 32) "\\68\\69")',
        ')',
        '',
      ].join('\n')
    );
  });

  it('renders nested structured control flow instructions', () => {
    const module = createEmptyWasmTextModule();
    module.functions.push(
      wasmTextFunction(
        'main',
        [],
        [
          wasmBlock(
            [
              wasmLoop(
                [
                  wasmOp('local.get', '$flag'),
                  wasmIf([wasmOp('br', '$done')], [wasmOp('return')]),
                ],
                { label: '$work' }
              ),
            ],
            { label: '$done' }
          ),
        ],
        { locals: [{ name: 'flag', type: 'i32' }] }
      )
    );

    expect(emitWAT(module)).toContain('(block $done');
    expect(emitWAT(module)).toContain('(loop $work');
    expect(emitWAT(module)).toContain('if');
    expect(emitWAT(module)).toContain('else');
    expect(emitWAT(module)).toContain('br $done');
  });
});
