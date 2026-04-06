import fs from 'node:fs';
import path from 'node:path';
import { compileGrammar } from '../src/grammar/index.js';
import { analyzeLumina } from '../src/lumina/semantic.js';
import { inferProgram } from '../src/lumina/hm-infer.js';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { render } from '../src/lumina-runtime.js';
import type { LuminaProgram } from '../src/lumina/ast.js';

const grammarPath = path.resolve(__dirname, '../examples/lumina.peg');
const luminaGrammar = fs.readFileSync(grammarPath, 'utf-8');
const parser = compileGrammar(luminaGrammar);

const parseProgram = (source: string): LuminaProgram => parser.parse(source) as LuminaProgram;

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

  test('stdlib wrappers typecheck and emit render runtime calls', () => {
    const source = `
      import {
        props_class,
        props_id,
        props_style,
        props_value,
        props_placeholder,
        props_href,
        props_disabled,
        props_on_input,
        props_on_change,
        props_key,
        props_merge,
        vnode,
        text
      } from "@std/render";

      fn main() -> VNode {
        let base = props_merge(props_class("field"), props_id("name"));
        let input = props_merge(
          props_merge(base, props_style("color:red")),
          props_merge(
            props_merge(props_value("hello"), props_placeholder("Enter...")),
            props_merge(
              props_on_input(|value| {
                let _ = value;
              }),
              props_on_change(|value| {
                let _ = value;
              })
            )
          )
        );
        let _link = props_href("/home");
        let _disabled = props_disabled(true);
        let _key = props_key("item-1");
        vnode("input", input, [text("ok")])
      }
    `.trim() + '\n';

    const ast = parseProgram(source);
    const analysis = analyzeLumina(ast);
    const semanticErrors = analysis.diagnostics.filter((diag) => diag.severity === 'error');
    expect(semanticErrors).toHaveLength(0);

    const inferred = inferProgram(ast);
    const hmErrors = inferred.diagnostics.filter((diag) => diag.severity === 'error');
    expect(hmErrors).toHaveLength(0);

    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('props_id("name")');
    expect(js).toContain('props_style("color:red")');
    expect(js).toContain('props_value("hello")');
    expect(js).toContain('props_placeholder("Enter...")');
    expect(js).toContain('props_href("/home")');
    expect(js).toContain('props_disabled(true)');
    expect(js).toContain('props_on_input(function(value)');
    expect(js).toContain('props_on_change(function(value)');
    expect(js).toContain('props_key("item-1")');
  });
});
