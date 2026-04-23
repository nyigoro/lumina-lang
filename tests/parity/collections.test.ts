import { parityTest, supportsParityWasm, type ParityTestCase } from './parity-harness.js';

jest.setTimeout(20_000);

const cases: ParityTestCase[] = [
  {
    name: 'vec push pop len parity',
    source: `
      import { vec } from "@std";

      fn main() -> i32 {
        let v = vec.new();
        vec.push(v, 10);
        vec.push(v, 20);
        vec.pop(v);
        return vec.len(v);
      }
    `,
    expectedRet: 1,
  },
  {
    name: 'vec iterator helpers parity',
    source: `
      import { vec } from "@std";

      fn main() -> i32 {
        let v = vec.new();
        vec.push(v, 1);
        vec.push(v, 2);
        vec.push(v, 3);
        let mapped = vec.map(v, |x| x * 2);
        return vec.fold(mapped, 0, |acc, x| acc + x);
      }
    `,
    expectedRet: 12,
  },
  {
    name: 'hashmap insert remove len parity',
    source: `
      import { hashmap } from "@std";

      fn main() -> i32 {
        let m = hashmap.new();
        hashmap.insert(m, 1, 9);
        hashmap.insert(m, 2, 4);
        hashmap.get(m, 2);
        hashmap.remove(m, 1);
        return hashmap.len(m);
      }
    `,
    expectedRet: 1,
  },
  {
    name: 'hashset contains parity',
    source: `
      import { hashset } from "@std";

      fn main() -> i32 {
        let s = hashset.new();
        let inserted = hashset.insert(s, 4);
        let has = hashset.contains(s, 4);
        if (inserted && has) {
          return hashset.len(s);
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
];

describe('JS/WASM parity: collections', () => {
  const available = supportsParityWasm();
  const parityEach = available ? it.each : it.skip.each;

  it('detects wat2wasm availability for collection parity', () => {
    if (!available) {
      console.warn('Skipping collection parity tests: wat2wasm not available in PATH');
    }
    expect(typeof available).toBe('boolean');
  });

  parityEach(cases)('$name', async (spec) => {
    const result = await parityTest(spec);
    expect(result.match).toBe(true);
    if (!result.match) {
      throw new Error(result.diff ?? `Parity mismatch for ${spec.name}`);
    }
  });
});
