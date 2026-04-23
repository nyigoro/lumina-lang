import { parityTest, supportsParityWasm, type ParityTestCase } from './parity-harness.js';

jest.setTimeout(20_000);

const cases: ParityTestCase[] = [
  {
    name: 'async await parity',
    source: `
      async fn work() -> i32 { return 3; }
      async fn main() -> i32 {
        let v = await work();
        return v + 2;
      }
    `,
    expectedRet: 5,
  },
  {
    name: 'chained await parity',
    source: `
      async fn one() -> i32 { return 1; }
      async fn two(x: i32) -> i32 { return x + 2; }
      async fn main() -> i32 {
        let a = await one();
        let b = await two(a);
        return b + 3;
      }
    `,
    expectedRet: 6,
  },
  {
    name: 'async calls async parity',
    source: `
      async fn leaf() -> i32 { return 7; }
      async fn mid() -> i32 {
        let v = await leaf();
        return v * 2;
      }
      async fn main() -> i32 {
        return await mid();
      }
    `,
    expectedRet: 14,
  },
  {
    name: 'await in while loop parity',
    source: `
      async fn step(v: i32) -> i32 { return v + 1; }
      async fn main() -> i32 {
        let mut i = 0;
        let mut acc = 0;
        while (i < 4) {
          let next = await step(i);
          acc = acc + next;
          i = i + 1;
        }
        return acc;
      }
    `,
    expectedRet: 10,
  },
  {
    name: 'await in for loop parity',
    source: `
      async fn val(v: i32) -> i32 { return v * 2; }
      async fn main() -> i32 {
        let mut total = 0;
        for i in 1..0 {
          total = total + await val(i);
        }
        return total;
      }
    `,
    expectedRet: 0,
  },
  {
    name: 'three-level async nesting parity',
    source: `
      async fn leaf(v: i32) -> i32 { return v + 1; }
      async fn mid(v: i32) -> i32 { return await leaf(v) * 2; }
      async fn top(v: i32) -> i32 { return await mid(v) + 3; }
      async fn main() -> i32 { return await top(4); }
    `,
    expectedRet: 13,
  },
  {
    name: 'mixed sync and async parity',
    source: `
      fn seed() -> i32 { return 5; }
      async fn plus(v: i32) -> i32 { return v + 2; }
      async fn main() -> i32 {
        let base = seed();
        return await plus(base);
      }
    `,
    expectedRet: 7,
  },
  {
    name: 'async result propagation parity',
    source: `
      enum Result<T, E> { Ok(T), Err(E) }

      async fn step(v: i32) -> Result<i32, string> {
        return Result.Ok(v + 1);
      }

      async fn chain(v: i32) -> Result<i32, string> {
        let first = await step(v)?;
        let second = await step(first)?;
        return Result.Ok(second);
      }

      async fn main() -> i32 {
        let out = await chain(3);
        return match out {
          Ok(v) => v,
          Err(_) => 0
        };
      }
    `,
    expectedRet: 5,
  },
];

describe('JS/WASM parity: async behavior', () => {
  const available = supportsParityWasm();
  const parityEach = available ? it.each : it.skip.each;

  it('detects wat2wasm availability for async parity', () => {
    if (!available) {
      console.warn('Skipping async parity tests: wat2wasm not available in PATH');
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
