import { analyzeLumina } from '../src/lumina/semantic.js';
import { inferProgram } from '../src/lumina/hm-infer.js';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import { parseLuminaProgram } from './helpers/lumina-parser.js';

describe('@std/render module', () => {
  it('typechecks signal/memo/effect usage', () => {
    const source = `
      import { render } from "@std";

      fn main() -> i32 {
        let count = render.signal(1);
        let dom = render.create_dom_renderer();
        let ssr = render.create_ssr_renderer();
        let canvas = render.create_canvas_renderer();
        let tty = render.create_terminal_renderer();
        let doubled = render.memo(|| render.get(count) * 2);
        let fx = render.effect(|| {
          let _value = render.memo_get(doubled);
        });
        let container = 0;
        let mounted = render.mount_reactive(dom, container, || render.text("ok"));
        let hydrated = render.hydrate(ssr, container, render.text("ssr"));
        let _html = render.render_to_string(render.text("x"));
        let _tty = render.render_to_terminal(render.text("x"));

        render.set(count, 2);
        render.dispose_effect(fx);
        render.dispose_reactive(mounted);
        render.unmount(hydrated);
        let _ = canvas;
        let __ = tty;
        render.memo_get(doubled)
      }
    `.trim() + '\n';

    const ast = parseLuminaProgram(source);
    const analysis = analyzeLumina(ast);
    const semanticErrors = analysis.diagnostics.filter((diag) => diag.severity === 'error');
    expect(semanticErrors).toHaveLength(0);

    const inferred = inferProgram(ast);
    const hmErrors = inferred.diagnostics.filter((diag) => diag.severity === 'error');
    expect(hmErrors).toHaveLength(0);
  });

  it('emits render runtime calls in JS codegen', () => {
    const source = `
      import { render } from "@std";

      fn main() -> void {
        let s = render.signal(0);
        render.set(s, 1);
      }
    `.trim() + '\n';

    const ast = parseLuminaProgram(source);
    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('render.signal');
    expect(js).toContain('render.set');
  });

  it('supports language-level reactive/render wrappers', () => {
    const source = `
      import { createSignal, get, set, createMemo, createEffect } from "@std/reactive";
      import { vnode, text, mount_reactive, createDomRenderer } from "@std/render";

      fn view(count: Signal<i32>) -> VNode {
        vnode("div", 0, [text("Count: "), text(get(count))])
      }

      fn main() -> i32 {
        let count = createSignal(0);
        let memo = createMemo(|| get(count) + 1);
        let fx = createEffect(|| {
          let _value = get(count);
        });
        let renderer = createDomRenderer();
        let container = 0;
        let mounted = mount_reactive(renderer, container, || view(count));
        set(count, 1);
        let _ = memo;
        let __ = fx;
        let ___ = mounted;
        get(count)
      }
    `.trim() + '\n';

    const ast = parseLuminaProgram(source);
    const analysis = analyzeLumina(ast);
    const semanticErrors = analysis.diagnostics.filter((diag) => diag.severity === 'error');
    expect(semanticErrors).toHaveLength(0);

    const inferred = inferProgram(ast);
    const hmErrors = inferred.diagnostics.filter((diag) => diag.severity === 'error');
    expect(hmErrors).toHaveLength(0);

    const js = generateJSFromAst(ast, { target: 'esm', includeRuntime: true }).code;
    expect(js).toContain('createSignal');
    expect(js).toContain('mount_reactive');
    expect(js).toContain('createDomRenderer');
  });

  it('typechecks the component/context/headless render namespace surface', () => {
    const source = `
      import { render } from "@std";

      fn build(active: Signal<string>, open: Signal<bool>) -> VNode {
        let _context = render.create_required_context();
        let _children = render.children([render.text("child")]);
        let _slot = render.slot_or(0, 0, render.text("fallback"));
        let _checked = render.props_checked(true);
        let _type = render.props_type("checkbox");
        let _name = render.props_name("contact");
        let _toggle = render.props_on_checked_change(fn(next: bool) -> void {
          let _ = next;
        });
        let _submit = render.props_on_submit(fn() -> void {
          let _ = 0;
        });

        let tabs = render.tabsRoot(active, || [
          render.tabsList(render.props_class("tabs"), || [
            render.tabsTrigger("overview", render.props_class("tab"), [render.text("Overview")])
          ]),
          render.tabsPanel("overview", render.props_class("panel"), [render.text("Panel")])
        ]);

        let dialog = render.dialogRoot(open, || render.dialogPortal([
          render.dialogOverlay(render.props_class("overlay")),
          render.dialogContent(render.props_class("content"), [
            render.dialogTitle(render.props_class("title"), [render.text("Dialog")]),
            render.dialogDescription(render.props_class("description"), [render.text("Details")]),
            render.dialogClose(render.props_class("close"), [render.text("Close")])
          ])
        ]));

        let popover = render.popoverRoot(open, || [
          render.popoverTrigger(render.props_class("trigger"), [render.text("Open popover")]),
          render.popoverPortal([
            render.popoverContent(render.props_class("popover"), [render.text("Popover body")])
          ])
        ]);

        let tooltip = render.tooltipRoot(open, || [
          render.tooltipTrigger(render.props_class("tooltip-trigger"), [render.text("Hover me")]),
          render.tooltipPortal([
            render.tooltipContent(render.props_class("tooltip"), [render.text("Helpful copy")])
          ])
        ]);

        let toast = render.toastRoot(open, || render.toastPortal([
          render.toastContent(render.props_class("toast"), [
            render.toastTitle(render.props_class("toast-title"), [render.text("Saved")]),
            render.toastDescription(render.props_class("toast-description"), [render.text("Draft updated")]),
            render.toastClose(render.props_class("toast-close"), [render.text("Dismiss")])
          ])
        ]));

        let menu = render.menuRoot(open, || [
          render.menuTrigger(render.props_class("menu-trigger"), [render.text("Open menu")]),
          render.menuPortal([
            render.menuContent(render.props_class("menu"), [
              render.menuItem("rename", render.props_class("menu-item"), [render.text("Rename")])
            ])
          ])
        ]);

        let checked = render.signal(true);
        let choice = render.signal("email");
        let selectOpen = render.signal(false);
        let selectValue = render.signal("email");
        let comboboxOpen = render.signal(false);
        let comboboxValue = render.signal("email");
        let comboboxQuery = render.signal("em");
        let multiselectOpen = render.signal(false);
        let multiselectValues = render.signal(["email"]);

        let checkbox = render.checkboxRoot(checked, render.props_class("checkbox"), || [
          render.checkboxIndicator(render.props_class("checkbox-indicator"), [render.text("x")]),
          render.text("Accept terms")
        ]);

        let selectUi = render.selectRoot(selectOpen, selectValue, || [
          render.selectTrigger(render.props_class("select-trigger"), [render.text("Choose channel")]),
          render.selectPortal([
            render.selectContent(render.props_class("select-content"), [
              render.selectItem("email", render.props_class("select-item"), || [
                render.selectIndicator(render.props_class("select-indicator"), [render.text("o")]),
                render.text("Email")
              ])
            ])
          ])
        ]);

        let comboboxUi = render.comboboxRoot(comboboxOpen, comboboxValue, comboboxQuery, || [
          render.comboboxInput(render.props_placeholder("Search channels"), []),
          render.comboboxPortal([
            render.comboboxContent(render.props_class("combobox-content"), [
              render.comboboxItem("email", render.props_class("combobox-item"), || [
                render.comboboxIndicator(render.props_class("combobox-indicator"), [render.text("o")]),
                render.text("Email")
              ])
            ])
          ])
        ]);

        let multiselectUi = render.multiselectRoot(multiselectOpen, multiselectValues, || [
          render.multiselectTrigger(render.props_class("multiselect-trigger"), [render.text("Choose channels")]),
          render.multiselectPortal([
            render.multiselectContent(render.props_class("multiselect-content"), [
              render.multiselectItem("email", render.props_class("multiselect-item"), || [
                render.multiselectIndicator(render.props_class("multiselect-indicator"), [render.text("x")]),
                render.text("Email")
              ])
            ])
          ])
        ]);

        let radio = render.radioGroup(choice, render.props_class("radio-group"), || [
          render.radioItem("email", render.props_class("radio-item"), || [
            render.radioIndicator(render.props_class("radio-indicator"), [render.text("o")]),
            render.text("Email")
          ])
        ]);

        render.portalBody([tabs, dialog, popover, tooltip, toast, menu, selectUi, comboboxUi, multiselectUi, checkbox, radio])
      }
    `.trim() + '\n';

    const ast = parseLuminaProgram(source);
    const analysis = analyzeLumina(ast);
    const semanticErrors = analysis.diagnostics.filter((diag) => diag.severity === 'error');
    expect(semanticErrors).toHaveLength(0);
  });
});
