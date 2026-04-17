import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { render } from '../src/lumina-runtime.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

describe('render prop helpers', () => {
  test('new props return the expected object shape', () => {
    expect(render.props_id('foo')).toEqual({ id: 'foo' });
    expect(render.props_style('color:red')).toEqual({ style: 'color:red' });
    expect(render.props_value('hello')).toEqual({ value: 'hello' });
    expect(render.props_placeholder('Enter...')).toEqual({ placeholder: 'Enter...' });
    expect(render.props_href('/home')).toEqual({ href: '/home' });
    expect(render.props_disabled(true)).toEqual({ disabled: true });
    expect(render.props_key('item-1')).toEqual({ key: 'item-1' });
  });

  test('input and change handlers extract string values', () => {
    const onInput = jest.fn();
    const onChange = jest.fn();
    const inputProps = render.props_on_input(onInput) as { onInput?: (event: Event) => void };
    const changeProps = render.props_on_change(onChange) as { onChange?: (event: Event) => void };

    inputProps.onInput?.({ target: { value: 'typed text' } } as unknown as Event);
    changeProps.onChange?.({ target: { value: 'changed text' } } as unknown as Event);

    expect(onInput).toHaveBeenCalledWith('typed text');
    expect(onChange).toHaveBeenCalledWith('changed text');
  });

  test('props_merge composes new helpers with existing props', () => {
    const handler = jest.fn();
    const merged = render.props_merge(render.props_class('x'), render.props_id('y')) as {
      className?: string;
      id?: string;
    };
    expect(merged).toEqual({ className: 'x', id: 'y' });

    const mergedHandler = render.props_merge(render.props_class('x'), render.props_on_input(handler)) as {
      className?: string;
      onInput?: (event: Event) => void;
    };
    expect(mergedHandler.className).toBe('x');
    expect(typeof mergedHandler.onInput).toBe('function');
    mergedHandler.onInput?.({ target: { value: 'merged value' } } as unknown as Event);
    expect(handler).toHaveBeenCalledWith('merged value');
  });

  test('props_merge composes classes, styles, and event handlers instead of overwriting', () => {
    const left = jest.fn(() => false);
    const right = jest.fn();
    const preventDefault = jest.fn();

    const merged = render.props_merge(
      {
        className: 'base',
        style: 'color:red',
        onClick: left,
      },
      {
        className: 'accent',
        style: 'background:blue',
        onClick: right,
      }
    ) as {
      className?: string;
      style?: string;
      onClick?: (event: Event) => void;
    };

    expect(merged.className).toBe('base accent');
    expect(merged.style).toBe('color:red;background:blue');

    merged.onClick?.({ preventDefault } as unknown as Event);
    expect(left).toHaveBeenCalledTimes(1);
    expect(right).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test('compose_handlers chains callbacks directly', () => {
    const left = jest.fn();
    const right = jest.fn();
    const composed = render.compose_handlers(left, right);

    composed?.('payload');

    expect(left).toHaveBeenCalledWith('payload');
    expect(right).toHaveBeenCalledWith('payload');
  });

  test('stdlib wrappers emit render runtime calls for composition helpers', () => {
    const source = `
      import {
        children,
        composeHandlers,
        createContext,
        slot,
        text,
        useContext,
        withContext
      } from "@std/render";

      fn main() -> VNode {
        let theme = createContext("light");
        let _click = composeHandlers(0, 0);
        let _items = children(text("item"));
        let _wrapped = withContext(theme, "dark", slot(text(useContext(theme)), 0));
        text("done")
      }
    `.trim() + '\n';

    const ast = parseLuminaProgram(source);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('createContext("light")');
    expect(js).toContain('withContext(theme, "dark"');
    expect(js).toContain('useContext(theme)');
    expect(js).toContain('composeHandlers');
    expect(js).toContain('children(text("item"))');
    expect(js).toContain('slot(text(useContext(theme)), 0)');
  });
});
