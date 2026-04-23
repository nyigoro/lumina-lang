// tests/compile-grammar.test.ts
import { clearCompiledGrammarCache, compileGrammar } from '../src/index';
import { formatCompilationError } from '../src/utils/format';
import { Location } from '../src/utils/types';

describe('compileGrammar', () => {
  beforeEach(() => {
    clearCompiledGrammarCache();
  });

  it('should compile valid grammar and return a parser', () => {
    const grammar = `
      Expression
        = head:Term tail:(_ ("+" / "-") _ Term)* {
            return tail.reduce(
              (result, element) => {
                if (element[1] === "+") return result + element[3];
                return result - element[3];
              },
              head
            );
          }

      Term
        = head:Factor tail:(_ ("*" / "/") _ Factor)* {
            return tail.reduce(
              (result, element) => {
                if (element[1] === "*") return result * element[3];
                return result / element[3];
              },
              head
            );
          }

      Factor
        = "(" _ expr:Expression _ ")" { return expr; }
        / number:Number

      Number
        = digits:[0-9]+ {
            return parseInt(digits.join(""), 10);
          }

      _ "whitespace"
        = [ \\t\\n\\r]*
    `;

    const parser = compileGrammar(grammar);
    expect(parser).toBeDefined();
    const result = parser.parse('2 + 3 * 4');
    expect(result).toBe(14);
  });

  it('reuses compiled parsers for identical grammar and options', () => {
    const grammar = `
      Start = digits:[0-9]+ { return parseInt(digits.join(""), 10); }
    `;

    const first = compileGrammar(grammar, { cache: true, optimize: 'speed' });
    const second = compileGrammar(grammar, { cache: true, optimize: 'speed' });

    expect(first).not.toBe(second);
    expect(first.parse).toBe(second.parse);
    expect(second.parse('42')).toBe(42);
  });

  it('does not reuse parsers when relevant compile options differ', () => {
    const grammar = `
      Start = digits:[0-9]+ { return parseInt(digits.join(""), 10); }
    `;

    const speed = compileGrammar(grammar, { cache: true, optimize: 'speed' });
    const size = compileGrammar(grammar, { cache: true, optimize: 'size' });

    expect(speed.parse).not.toBe(size.parse);
  });

  it('should throw and format syntax error for invalid grammar', () => {
    const badGrammar = `
      Expression
        = Term "+" Term
        // Missing definition for Term
    `;

    try {
      compileGrammar(badGrammar);
      throw new Error('Expected compileGrammar to throw');
    } catch (err: unknown) {
      const formatted = formatCompilationError((err as { message: string; location: Location | undefined }).message, badGrammar);
      expect(formatted).toMatch(/Rule\s+"Term"\s+is\s+not\s+defined/);
    }
  });
});
