import { analyzeForTarget, parityTest, supportsParityWasm, type ParityTestCase } from './parity-harness.js';

jest.setTimeout(20_000);

const hardErrors = (diagnostics: Array<{ severity: string }>) =>
  diagnostics.filter((diagnostic) => diagnostic.severity === 'error');

const cases: ParityTestCase[] = [
  {
    name: 'immediate lambda call',
    source: 'fn main() -> i32 { (|x| x + 1)(5) }',
    expectedRet: 6,
  },
  {
    name: 'nested immediate lambda call',
    source: 'fn main() -> i32 { (|f| f(3))(|x| x + 1) }',
    expectedRet: 4,
  },
];

describe('JS/WASM parity: immediate lambda calls', () => {
  it.each(cases)('$name passes semantic analysis on JS and WASM targets', ({ source }) => {
    expect(hardErrors(analyzeForTarget(source, 'esm'))).toHaveLength(0);
    expect(hardErrors(analyzeForTarget(source, 'wasm'))).toHaveLength(0);
  });

  const available = supportsParityWasm();
  const parityEach = available ? it.each : it.skip.each;

  parityEach(cases)('$name executes identically on both targets', async (spec) => {
    const result = await parityTest(spec);
    expect(result.match).toBe(true);
    if (!result.match) {
      throw new Error(result.diff ?? `Parity mismatch for ${spec.name}`);
    }
  });
});
