import { parseLuminaProgram } from './helpers/lumina-parser.js';

describe('Lumina parser UI framework coverage', () => {
  test('parses async resource and headless UI authoring shapes', () => {
    const source = `
      import { render } from "@std";
      import { renderToStringApp } from "@std/render";
      import { createDomHarness, mountApp, getById, click } from "@std/testing";
      import { defineCustomElement } from "@std/web_components";
      import { button, presenceCard } from "@std/ui";
      import { install, snapshot } from "@std/devtools";
      import { renderApp as renderStaticApp } from "@std/ssg";
      import { createResource, read } from "@std/resource";
      import { createStore, set, selectMemo } from "@std/store";
      import { checkbox, bindValue, submitProps } from "@std/forms";

      async fn loadProfile() -> string {
        "donald"
      }

      fn page(open: Signal<bool>) -> VNode {
        let form = createStore("draft");
        let ready = render.signal(false);
        let profile = createResource("profile", || loadProfile());
        let label = selectMemo(form, fn(value: string) -> string {
          value
        });

        render.suspense(render.text("Loading"), || [
          render.errorBoundary(render.text("Failed"), || [
            render.dialogRoot(open, || render.dialogPortal([
              render.dialogOverlay(render.props_class("overlay")),
                render.dialogContent(render.props_class("content"), [
                  render.dialogTitle(render.props_class("title"), [render.text("Profile")]),
                  render.text(read(profile)),
                  presenceCard(open, 0, [
                    button(0, [render.text("Open")])
                  ]),
                  checkbox(ready, render.props_class("ready"), [render.text("Ready")]),
                  render.element("input", bindValue(form), []),
                  render.element("button", submitProps(fn() -> void {
                    set(form, render.memo_get(label));
                  }), [render.text("Save")])
              ])
            ]))
          ])
        ])
      }

      fn boot() -> string {
        let harness = createDomHarness();
        let renderer = render.create_dom_renderer();
        let mounted = mountApp(harness, page, render.signal(false));
        click(getById(harness, "missing"));
        let _ = mounted;
        let __ = renderer;
        let ___ = defineCustomElement("lumina-page", page, 0);
        let ____ = install();
        let _____ = snapshot();
        let ______ = renderStaticApp(page, render.signal(false), 0);
        renderToStringApp(page, render.signal(false))
      }
    `.trim() + '\n';

    const ast = parseLuminaProgram(source);
    expect(ast.type).toBe('Program');
    expect(ast.body.some((stmt) => stmt.type === 'FnDecl' && stmt.name === 'page')).toBe(true);
  });

  test('parses component declarations as function declarations', () => {
    const source = `
      import { render } from "@std";

      component Counter(label: string) -> VNode {
        let count = render.state(1);
        render.element("button", 0, [render.text(label), render.text(render.get(count))])
      }
    `.trim() + '\n';

    const ast = parseLuminaProgram(source);
    expect(ast.type).toBe('Program');
    expect(ast.body.some((stmt) => stmt.type === 'FnDecl' && stmt.name === 'Counter')).toBe(true);
  });
});
