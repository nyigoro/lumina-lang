import { parityTest, supportsParityWasm, type ParityTestCase } from './parity-harness.js';

jest.setTimeout(30_000);

const cases: ParityTestCase[] = [
  {
    name: 'math abs int parity',
    source: `
      import * as math from "@std/math";
      fn main() -> i32 {
        return math.abs(0 - 5);
      }
    `,
    expectedRet: 5,
  },
  {
    name: 'math abs float parity',
    source: `
      import * as math from "@std/math";
      fn main() -> i32 {
        if (math.abs(0.0 - 3.5) > 3.0) {
          return 1;
        } else {
          return 0;
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
  {
    name: 'vec any parity',
    source: `
      import { vec } from "@std";
      fn main() -> i32 {
        let v = vec.new();
        vec.push(v, 1);
        let ok = vec.any(v, |x| x > 0);
        if (ok) {
          return 1;
        } else {
          return 0;
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
  {
    name: 'vec all parity',
    source: `
      import { vec } from "@std";
      fn main() -> i32 {
        let v = vec.new();
        vec.push(v, 1);
        vec.push(v, 2);
        let ok = vec.all(v, |x| x > 0);
        if (ok) {
          return 1;
        } else {
          return 0;
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
  {
    name: 'vec take/skip parity',
    source: 'import { vec } from "@std"; fn main() -> i32 { let v = vec.new(); vec.push(v, 1); vec.push(v, 2); vec.push(v, 3); let t = vec.take(v, 2); let s = vec.skip(v, 1); return vec.len(t) + vec.len(s); }',
    expectedRet: 4,
  },
  {
    name: 'fixed array slice parity',
    source: 'fn main() -> i32 { let arr: [i32; 4] = [1, 2, 3, 4]; let s = arr[1..3]; return s[0] + s[1]; }',
    expectedRet: 5,
  },
  {
    name: 'struct pattern parity',
    source: 'struct Pair { left: i32, right: i32 } fn main() -> i32 { let p = Pair { left: 4, right: 5 }; return match p { Pair { left: a, right: b } => a + b }; }',
    expectedRet: 9,
  },
  {
    name: 'while let parity',
    source: `
      enum Option { Some(i32), None }
      fn next(i: i32) -> Option {
        if (i < 3) {
          return Option.Some(i);
        } else {
          return Option.None;
        }
        return Option.None;
      }
      fn main() -> i32 {
        let mut i = 0;
        let mut total = 0;
        while let Some(v) = next(i) {
          total = total + v;
          i = i + 1;
        }
        return total;
      }
    `,
    expectedRet: 3,
  },
  {
    name: 'if let parity',
    source: `
      enum Option { Some(i32), None }
      fn main() -> i32 {
        let v = Option.Some(9);
        if let Some(x) = v {
          return x;
        } else {
          return 0;
        }
        return 0;
      }
    `,
    expectedRet: 9,
  },
  {
    name: 'guarded match parity',
    source: 'struct User { age: i32 } fn main() -> i32 { let user = User { age: 10 }; return match user { User { age: n } if n > 5 => n, _ => 0 }; }',
    expectedRet: 10,
  },
  {
    name: 'trait method dispatch parity',
    source: `
      trait Printable {
        fn print(self: Self) -> string;
      }
      struct User { name: string }
      impl Printable for User {
        fn print(self: Self) -> string {
          return str.concat("U:", self.name);
        }
      }
      fn main() -> i32 {
        let u = User { name: "A" };
        if (u.print() == "U:A") {
          return 1;
        } else {
          return 0;
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
  {
    name: 'nested gadt parity',
    source: 'enum Expr<T> { Lit(i32): Expr<i32>, Bool(bool): Expr<bool>, If(Expr<bool>, Expr<T>, Expr<T>): Expr<T> } fn eval(e: Expr<i32>) -> i32 { match e { Expr.If(Expr.Bool(true), Expr.Lit(n), _) => n, Expr.If(Expr.Bool(false), _, Expr.Lit(m)) => m, Expr.Lit(v) => v } } fn main() -> i32 { eval(Expr.If(Expr.Bool(true), Expr.Lit(4), Expr.Lit(9))) }',
    expectedRet: 4,
  },
  {
    name: 'tuple match parity',
    source: 'fn pair() -> (i32, i32) { return (1, 2); } fn main() -> i32 { let p = pair(); return match p { (a, b) => a + b }; }',
    expectedRet: 3,
  },
  {
    name: 'range equality parity',
    source: `
      fn main() -> i32 {
        let r = 0..3;
        if (r == r) {
          return 1;
        } else {
          return 0;
        }
        return 0;
      }
    `,
    expectedRet: 1,
  },
];

describe('shared core parity expansion', () => {
  const available = supportsParityWasm();
  const parityEach = available ? it.each : it.skip.each;

  it('detects wat2wasm availability', () => {
    if (!available) {
      console.warn('Skipping shared-core parity tests: wat2wasm not available in PATH');
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
