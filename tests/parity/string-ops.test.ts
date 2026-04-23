import { parityTest, supportsParityWasm, type ParityTestCase } from './parity-harness.js';

jest.setTimeout(20_000);

const cases: ParityTestCase[] = [
  {
    name: 'unicode length parity',
    source: `
      import { str } from "@std";

      fn main() -> i32 {
        let emoji = "\\u{1F44D}";
        if (str.length(emoji) == 2) {
          return 1;
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
  {
    name: 'empty string slice parity',
    source: `
      fn main() -> i32 {
        let s = "Hello";
        let cut = s[0..0];
        if (cut == "") {
          return 1;
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
  {
    name: 'interpolated string parity',
    source: `
      fn main() -> i32 {
        let who = "Lumina";
        let msg = "Hello {who}";
        if (msg == "Hello Lumina") {
          return 1;
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
];

describe('JS/WASM parity: string operations', () => {
  const available = supportsParityWasm();
  const parityEach = available ? it.each : it.skip.each;

  it('detects wat2wasm availability for runtime string parity', () => {
    if (!available) {
      console.warn('Skipping runtime string parity tests: wat2wasm not available in PATH');
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
