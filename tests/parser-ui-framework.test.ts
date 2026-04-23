import { parseLuminaProgram } from './helpers/lumina-parser.js';

describe('Lumina parser UI framework coverage', () => {
  test('parses async resource and headless UI authoring shapes', () => {
    const source = `
      import { render } from "@std";
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
    `.trim() + '\n';

    const ast = parseLuminaProgram(source);
    expect(ast.type).toBe('Program');
    expect(ast.body.some((stmt) => stmt.type === 'FnDecl' && stmt.name === 'page')).toBe(true);
  });
});
