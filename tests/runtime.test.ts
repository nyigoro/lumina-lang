import { formatValue, Option, Result, LuminaPanic, io } from '../src/lumina-runtime.js';

const renderPlain = (value: unknown): string => formatValue(value, { color: false });

describe('Lumina runtime', () => {
  test('pretty-prints nested ADTs', () => {
    const value = Option.Some(Result.Ok([1, 2, 3]));
    const rendered = renderPlain(value);
    expect(rendered).toContain('Some');
    expect(rendered).toContain('Ok');
    expect(rendered).toContain('1');
    expect(rendered).toContain('2');
    expect(rendered).toContain('3');
  });

  test('cycle-safe formatting', () => {
    const obj: { self?: unknown } = {};
    obj.self = obj;
    const rendered = renderPlain(obj);
    expect(rendered).toContain('[Circular]');
  });

  test('Option helpers', () => {
    const some = Option.Some(5);
    const mapped = Option.map((x: unknown) => (x as number) * 2, some);
    expect(renderPlain(mapped)).toContain('Some(10)');

    const none = Option.None;
    const mappedNone = Option.map((x: unknown) => x, none);
    expect(renderPlain(mappedNone)).toContain('None');

    const chained = Option.and_then((x: unknown) => Option.Some((x as number) + 1), some);
    expect(renderPlain(chained)).toContain('Some(6)');

    const fallback = Option.or_else(() => Option.Some(99), none);
    expect(renderPlain(fallback)).toContain('Some(99)');

    expect(Option.unwrap_or(0, some)).toBe(5);
    expect(Option.unwrap_or(0, none)).toBe(0);

    expect(Option.is_some(some)).toBe(true);
    expect(Option.is_some(none)).toBe(false);
    expect(Option.is_none(some)).toBe(false);
    expect(Option.is_none(none)).toBe(true);
  });

  test('Result.unwrap_or', () => {
    const ok = Result.Ok(42);
    const err = Result.Err('nope');
    expect(Result.unwrap_or(0, ok)).toBe(42);
    expect(Result.unwrap_or(0, err)).toBe(0);
  });

  test('Result helpers', () => {
    const ok = Result.Ok(5);
    const mapped = Result.map((x: unknown) => (x as number) * 2, ok);
    expect(renderPlain(mapped)).toContain('Ok(10)');

    const chained = Result.and_then((x: unknown) => Result.Ok((x as number) + 1), ok);
    expect(renderPlain(chained)).toContain('Ok(6)');

    const err = Result.Err('bad');
    const errMapped = Result.map((x: unknown) => x, err);
    expect(renderPlain(errMapped)).toContain('Err');

    const recovered = Result.or_else((msg: unknown) => Result.Ok(String(msg).length), err);
    expect(renderPlain(recovered)).toContain('Ok(');

    expect(Result.is_ok(ok)).toBe(true);
    expect(Result.is_ok(err)).toBe(false);
    expect(Result.is_err(ok)).toBe(false);
    expect(Result.is_err(err)).toBe(true);
  });

  test('Option.unwrap throws LuminaPanic on None', () => {
    expect(() => Option.unwrap(Option.None)).toThrow(LuminaPanic);
    try {
      Option.unwrap(Option.None);
    } catch (err) {
      const panic = err as LuminaPanic;
      expect(panic.name).toBe('LuminaPanic');
      expect(panic.message).toContain('None');
      expect(panic.value).toBe(Option.None);
    }
  });

  test('io.printJson emits JSON string', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    io.printJson(Option.Some(3));
    expect(spy).toHaveBeenCalled();
    const output = String(spy.mock.calls[0]?.[0] ?? '');
    expect(output).toContain('"$tag": "Some"');
    expect(output).toContain('"$payload": 3');
    spy.mockRestore();
  });
});
