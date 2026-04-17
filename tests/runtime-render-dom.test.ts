import { render } from '../src/lumina-runtime.js';

class FakeNode {
  textContent: string | null = '';
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;

  appendChild(node: FakeNode): FakeNode {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  removeChild(node: FakeNode): FakeNode {
    const idx = this.childNodes.indexOf(node);
    if (idx >= 0) {
      this.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
    return node;
  }

  replaceChild(newChild: FakeNode, oldChild: FakeNode): FakeNode {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx >= 0) {
      this.childNodes[idx] = newChild;
      oldChild.parentNode = null;
      newChild.parentNode = this;
    }
    return oldChild;
  }
}

class FakeElement extends FakeNode {
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, (event: unknown) => void>();
  style: Record<string, unknown> & { setProperty: (name: string, value: string) => void };
  readonly ownerDocument: FakeDocument;
  boundingRect: { left: number; top: number; right: number; bottom: number; width: number; height: number };

  constructor(tagName: string, ownerDocument: FakeDocument) {
    super();
    this.tagName = tagName.toLowerCase();
    this.ownerDocument = ownerDocument;
    this.boundingRect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    this.style = {
      setProperty: (name: string, value: string) => {
        this.style[name] = value;
      },
    };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(event: string, listener: (event: unknown) => void): void {
    this.listeners.set(event, listener);
  }

  removeEventListener(event: string): void {
    this.listeners.delete(event);
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  blur(): void {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
  }

  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
    return { ...this.boundingRect };
  }
}

class FakeTextNode extends FakeNode {
  constructor(value: string) {
    super();
    this.textContent = value;
  }
}

class FakeDocument {
  activeElement: FakeElement | null = null;
  readonly body: FakeElement;

  constructor() {
    this.body = new FakeElement('body', this);
  }

  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }

  createTextNode(value: string): FakeTextNode {
    return new FakeTextNode(value);
  }

  getElementById(id: string): FakeElement | null {
    const visit = (node: FakeNode): FakeElement | null => {
      for (const child of node.childNodes) {
        if (child instanceof FakeElement && child.getAttribute('id') === id) {
          return child;
        }
        const found = visit(child);
        if (found) return found;
      }
      return null;
    };

    return visit(this.body);
  }
}

describe('render DOM renderer', () => {
  test('mounts vnode tree into container', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const vnode = render.element('section', { id: 'root' }, [
      render.text('hello'),
      render.element('span', { className: 'value' }, [render.text('world')]),
    ]);

    render.mount(renderer, container, vnode);

    const section = container.childNodes[0] as FakeElement;
    expect(section.tagName).toBe('section');
    expect(section.attributes.get('id')).toBe('root');
    expect(section.childNodes[0].textContent).toBe('hello');
    const span = section.childNodes[1] as FakeElement;
    expect(span.tagName).toBe('span');
    expect(span.childNodes[0].textContent).toBe('world');
  });

  test('patches text in place without replacing host node', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const first = render.element('p', null, [render.text('one')]);
    const root = render.mount(renderer, container, first);
    const nodeBefore = container.childNodes[0];

    render.update(root, render.element('p', null, [render.text('two')]));
    const nodeAfter = container.childNodes[0];

    expect(nodeAfter).toBe(nodeBefore);
    expect((nodeAfter as FakeElement).childNodes[0].textContent).toBe('two');
  });

  test('updates event handlers and props', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const onClickA = jest.fn();
    const onClickB = jest.fn();

    const root = render.mount(
      renderer,
      container,
      render.element('button', { onClick: onClickA, title: 'a' }, [render.text('go')])
    );

    const button = container.childNodes[0] as FakeElement;
    expect(button.listeners.get('click')).toBe(onClickA);
    expect(button.attributes.get('title')).toBe('a');

    render.update(
      root,
      render.element('button', { onClick: onClickB, title: 'b' }, [render.text('go')])
    );

    expect(button.listeners.get('click')).toBe(onClickB);
    expect(button.attributes.get('title')).toBe('b');
  });

  test('mount_reactive updates on signal changes', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const value = render.signal('A');

    const mounted = render.mount_reactive(renderer, container, () =>
      render.element('div', null, [render.text(render.get(value))])
    );

    const host = container.childNodes[0] as FakeElement;
    const textNode = host.childNodes[0];
    expect(textNode.textContent).toBe('A');

    render.set(value, 'B');
    await Promise.resolve();
    expect(textNode.textContent).toBe('B');

    render.dispose_reactive(mounted);
    expect(container.childNodes).toHaveLength(0);
  });

  test('component-local state survives parent rerenders', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const label = render.signal('A');

    const Counter = (props: { label: string }) => {
      const count = render.state(0);
      return render.element('button', {
        onClick: () => {
          render.set(count, render.get(count) + 1);
        },
      }, [render.text(`${props.label}:${render.get(count)}`)]);
    };

    const mounted = render.mount_reactive(renderer, container, () =>
      render.element('section', null, [render.component(Counter, { label: render.get(label) })])
    );

    const host = container.childNodes[0] as FakeElement;
    const button = host.childNodes[0] as FakeElement;
    const textNode = button.childNodes[0];

    expect(textNode.textContent).toBe('A:0');

    button.listeners.get('click')?.({} as Event);
    await Promise.resolve();
    expect(textNode.textContent).toBe('A:1');

    render.set(label, 'B');
    await Promise.resolve();
    expect(textNode.textContent).toBe('B:1');

    render.dispose_reactive(mounted);
  });

  test('reorders keyed component children without losing local state', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const items = render.signal([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);

    const Counter = (props: { id: string; label: string }) => {
      const count = render.state(0);
      return render.element('button', {
        onClick: () => {
          render.set(count, render.get(count) + 1);
        },
        'data-id': props.id,
      }, [render.text(`${props.label}:${render.get(count)}`)]);
    };

    const mounted = render.mount_reactive(renderer, container, () =>
      render.element('section', null, render.get(items).map((item) => render.component(Counter, item, item.id)))
    );

    const host = container.childNodes[0] as FakeElement;
    const buttonA = host.childNodes[0] as FakeElement;
    const buttonB = host.childNodes[1] as FakeElement;

    buttonA.listeners.get('click')?.({} as Event);
    await Promise.resolve();
    expect(buttonA.childNodes[0].textContent).toBe('A:1');

    render.set(items, [
      { id: 'b', label: 'B' },
      { id: 'a', label: 'A' },
    ]);
    await Promise.resolve();

    expect(host.childNodes[0]).toBe(buttonB);
    expect(host.childNodes[1]).toBe(buttonA);
    expect((host.childNodes[0] as FakeElement).childNodes[0].textContent).toBe('B:0');
    expect((host.childNodes[1] as FakeElement).childNodes[0].textContent).toBe('A:1');

    render.dispose_reactive(mounted);
  });

  test('removing and re-adding a keyed component resets its local state', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const items = render.signal([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);

    const Counter = (props: { id: string; label: string }) => {
      const count = render.state(0);
      return render.element('button', {
        onClick: () => {
          render.set(count, render.get(count) + 1);
        },
        'data-id': props.id,
      }, [render.text(`${props.label}:${render.get(count)}`)]);
    };

    const mounted = render.mount_reactive(renderer, container, () =>
      render.element('section', null, render.get(items).map((item) => render.component(Counter, item, item.id)))
    );

    const host = container.childNodes[0] as FakeElement;
    const buttonA = host.childNodes[0] as FakeElement;
    const buttonB = host.childNodes[1] as FakeElement;

    buttonA.listeners.get('click')?.({} as Event);
    await Promise.resolve();
    expect(buttonA.childNodes[0].textContent).toBe('A:1');

    render.set(items, [{ id: 'b', label: 'B' }]);
    await Promise.resolve();
    expect(host.childNodes).toHaveLength(1);
    expect(host.childNodes[0]).toBe(buttonB);

    render.set(items, [
      { id: 'b', label: 'B' },
      { id: 'a', label: 'A' },
    ]);
    await Promise.resolve();

    const readdedA = host.childNodes[1] as FakeElement;
    expect(readdedA).not.toBe(buttonA);
    expect(readdedA.childNodes[0].textContent).toBe('A:0');

    render.dispose_reactive(mounted);
  });

  test('matches mixed keyed and unkeyed children with explicit rules', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const root = render.create_root(renderer, container);
    root.mount(
      render.element('section', null, [
        render.element('p', null, [render.text('lead')]),
        render.element('button', { key: 'a' }, [render.text('A')]),
        render.element('span', null, [render.text('middle')]),
        render.element('button', { key: 'b' }, [render.text('B')]),
      ])
    );

    const host = container.childNodes[0] as FakeElement;
    const lead = host.childNodes[0] as FakeElement;
    const buttonA = host.childNodes[1] as FakeElement;
    const middle = host.childNodes[2] as FakeElement;
    const buttonB = host.childNodes[3] as FakeElement;

    root.update(
      render.element('section', null, [
        render.element('p', null, [render.text('lead!')]),
        render.element('button', { key: 'b' }, [render.text('B')]),
        render.element('span', null, [render.text('middle!')]),
        render.element('button', { key: 'a' }, [render.text('A')]),
      ])
    );

    expect(host.childNodes[0]).toBe(lead);
    expect(host.childNodes[1]).toBe(buttonB);
    expect(host.childNodes[2]).toBe(middle);
    expect(host.childNodes[3]).toBe(buttonA);
    expect((lead.childNodes[0] as FakeNode).textContent).toBe('lead!');
    expect((middle.childNodes[0] as FakeNode).textContent).toBe('middle!');
  });

  test('throws on duplicate keyed siblings during patch', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const root = render.create_root(renderer, container);
    root.mount(
      render.element('section', null, [
        render.element('button', { key: 'a' }, [render.text('A')]),
        render.element('button', { key: 'b' }, [render.text('B')]),
      ])
    );

    expect(() =>
      root.update(
        render.element('section', null, [
          render.element('button', { key: 'a' }, [render.text('A')]),
          render.element('button', { key: 'a' }, [render.text('Again')]),
        ])
      )
    ).toThrow("Duplicate keyed child 'a'");
  });

  test('context, lazy children, and slot helpers compose without prop drilling', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const ThemeContext = render.create_context('light');

    const ThemeRoot = (props: {
      theme: string;
      header?: ((props: { theme: string }) => unknown) | null;
      children: () => unknown;
    }) =>
      render.with_context(ThemeContext, props.theme, () =>
        render.element('section', { 'data-theme': render.use_context(ThemeContext) }, [
          render.slot(props.header, { theme: render.use_context(ThemeContext) }, render.text('fallback')),
          ...render.children(props.children),
        ])
      );

    const ThemeLabel = (props: { prefix: string }) =>
      render.element('span', null, [render.text(`${props.prefix}:${render.use_context(ThemeContext)}`)]);

    const mounted = render.mount_reactive(renderer, container, () =>
      render.component(ThemeRoot, {
        theme: 'dark',
        header: ({ theme }: { theme: string }) => render.element('h1', null, [render.text(theme)]),
        children: () => render.component(ThemeLabel, { prefix: 'theme' }),
      })
    );

    expect((mounted as { $tag?: string }).$tag).toBeUndefined();

    const section = container.childNodes[0] as FakeElement;
    const header = section.childNodes[0] as FakeElement;
    const label = section.childNodes[1] as FakeElement;

    expect(section.attributes.get('data-theme')).toBe('dark');
    expect(header.childNodes[0].textContent).toBe('dark');
    expect(label.childNodes[0].textContent).toBe('theme:dark');

    render.dispose_reactive(mounted);
  });

  test('portal mounts into document body and cleans up on unmount', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const root = render.mount(
      renderer,
      container,
      render.element('section', null, [
        render.text('inline'),
        render.portal_body([
          render.element('aside', { id: 'portaled' }, [render.text('In body')]),
        ]),
      ])
    ) as { update: (node: unknown) => void; unmount: () => void };

    const section = container.childNodes[0] as FakeElement;
    const anchor = section.childNodes[1] as FakeElement;
    const host = fakeDocument.body.childNodes[0] as FakeElement;
    const portaled = host.childNodes[0] as FakeElement;

    expect(section.tagName).toBe('section');
    expect(anchor.tagName).toBe('lumina-portal-anchor');
    expect(anchor.attributes.get('data-lumina-portal-anchor')).toBe('true');
    expect(fakeDocument.body.childNodes).toHaveLength(1);
    expect(portaled.tagName).toBe('aside');
    expect(portaled.attributes.get('id')).toBe('portaled');
    expect(portaled.childNodes[0]?.textContent).toBe('In body');

    root.update(
      render.element('section', null, [
        render.text('inline'),
        render.portal_body([
          render.element('aside', { id: 'portaled' }, [render.text('Updated body')]),
        ]),
      ])
    );

    const updatedHost = fakeDocument.body.childNodes[0] as FakeElement;
    const updatedPortaled = updatedHost.childNodes[0] as FakeElement;
    expect(updatedPortaled.childNodes[0]?.textContent).toBe('Updated body');

    render.unmount(root);
    expect(fakeDocument.body.childNodes).toHaveLength(0);
  });

  test('headless tabs wire aria state and compose trigger handlers', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const active = render.signal('profile');
    const externalClick = jest.fn();
    const isHidden = (node: FakeElement): boolean =>
      node.attributes.get('hidden') === 'true' || (node as FakeElement & { hidden?: boolean }).hidden === true;

    const mounted = render.mount_reactive(renderer, container, () =>
      render.tabs_root(active, () =>
        render.element('section', null, [
          render.tabs_list({ 'aria-label': 'Sections' }, () => [
            render.tabs_trigger('profile', null, [render.text('Profile')]),
            render.tabs_trigger('settings', { onClick: externalClick }, [render.text('Settings')]),
            render.tabs_trigger('billing', null, [render.text('Billing')]),
          ]),
          render.tabs_panel('profile', null, [render.text('Profile panel')]),
          render.tabs_panel('settings', null, [render.text('Settings panel')]),
          render.tabs_panel('billing', null, [render.text('Billing panel')]),
        ])
      )
    );

    const section = container.childNodes[0] as FakeElement;
    const list = section.childNodes[0] as FakeElement;
    const triggerProfile = list.childNodes[0] as FakeElement;
    const triggerSettings = list.childNodes[1] as FakeElement;
    const triggerBilling = list.childNodes[2] as FakeElement;
    const panelProfile = section.childNodes[1] as FakeElement;
    const panelSettings = section.childNodes[2] as FakeElement;
    const panelBilling = section.childNodes[3] as FakeElement;

    expect(list.attributes.get('role')).toBe('tablist');
    expect(list.attributes.get('aria-label')).toBe('Sections');
    expect(triggerProfile.attributes.get('role')).toBe('tab');
    expect(triggerProfile.attributes.get('aria-selected')).toBe('true');
    expect(triggerSettings.attributes.get('aria-selected')).toBe('false');
    expect(triggerBilling.attributes.get('aria-selected')).toBe('false');
    expect(triggerProfile.attributes.get('aria-controls')).toBe(panelProfile.attributes.get('id'));
    expect(panelProfile.attributes.get('role')).toBe('tabpanel');
    expect(isHidden(panelProfile)).toBe(false);
    expect(isHidden(panelSettings)).toBe(true);
    expect(isHidden(panelBilling)).toBe(true);

    triggerSettings.listeners.get('click')?.({} as Event);
    await Promise.resolve();

    expect(externalClick).toHaveBeenCalledTimes(1);
    expect(render.get(active)).toBe('settings');
    expect(triggerProfile.attributes.get('aria-selected')).toBe('false');
    expect(triggerSettings.attributes.get('aria-selected')).toBe('true');
    expect(isHidden(panelProfile)).toBe(true);
    expect(isHidden(panelSettings)).toBe(false);
    expect(isHidden(panelBilling)).toBe(true);

    const preventDefault = jest.fn();
    triggerSettings.listeners.get('keydown')?.({ key: 'ArrowRight', preventDefault } as unknown as Event);
    await Promise.resolve();

    expect(render.get(active)).toBe('billing');
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(triggerBilling.attributes.get('aria-selected')).toBe('true');
    expect(isHidden(panelBilling)).toBe(false);

    triggerBilling.listeners.get('keydown')?.({ key: 'Home', preventDefault: jest.fn() } as unknown as Event);
    await Promise.resolve();

    expect(render.get(active)).toBe('profile');
    expect(triggerProfile.attributes.get('aria-selected')).toBe('true');
    expect(isHidden(panelProfile)).toBe(false);

    triggerProfile.listeners.get('keydown')?.({ key: 'End', preventDefault: jest.fn() } as unknown as Event);
    await Promise.resolve();

    expect(render.get(active)).toBe('billing');

    triggerBilling.listeners.get('keydown')?.({ key: 'ArrowLeft', preventDefault: jest.fn() } as unknown as Event);
    await Promise.resolve();

    expect(render.get(active)).toBe('settings');

    render.dispose_reactive(mounted);
  });

  test('headless dialog opens and closes through trigger, overlay, escape, and close button', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const open = render.signal(false);
    const externalTriggerClick = jest.fn();
    const externalCloseClick = jest.fn();
    const isHidden = (node: FakeElement): boolean =>
      node.attributes.get('hidden') === 'true' || (node as FakeElement & { hidden?: boolean }).hidden === true;

    const mounted = render.mount_reactive(renderer, container, () =>
      render.dialog_root(open, () =>
        render.element('section', null, [
          render.dialog_trigger({ onClick: externalTriggerClick }, [render.text('Open dialog')]),
          render.dialog_overlay({ className: 'overlay' }),
          render.dialog_content({ className: 'content' }, [
            render.dialog_title(null, [render.text('Dialog title')]),
            render.dialog_description(null, [render.text('Dialog description')]),
            render.element('button', { id: 'dialog-action' }, [render.text('Dialog action')]),
            render.dialog_close({ onClick: externalCloseClick }, [render.text('Close dialog')]),
          ]),
        ])
      )
    );

    const section = container.childNodes[0] as FakeElement;
    const trigger = section.childNodes[0] as FakeElement;
    const overlay = section.childNodes[1] as FakeElement;
    const content = section.childNodes[2] as FakeElement;
    const title = content.childNodes[0] as FakeElement;
    const description = content.childNodes[1] as FakeElement;
    const actionButton = content.childNodes[2] as FakeElement;
    const closeButton = content.childNodes[3] as FakeElement;

    expect(section.childNodes).toHaveLength(3);
    expect(trigger.attributes.get('aria-haspopup')).toBe('dialog');
    expect(trigger.attributes.get('aria-expanded')).toBe('false');
    expect(isHidden(overlay)).toBe(true);
    expect(isHidden(content)).toBe(true);
    expect(fakeDocument.activeElement).toBeNull();

    trigger.listeners.get('click')?.({ currentTarget: trigger } as unknown as Event);
    await Promise.resolve();

    expect(externalTriggerClick).toHaveBeenCalledTimes(1);
    expect(render.get(open)).toBe(true);
    expect(trigger.attributes.get('aria-expanded')).toBe('true');
    expect(trigger.attributes.get('aria-controls')).toBe(content.attributes.get('id'));
    expect(content.attributes.get('role')).toBe('dialog');
    expect(content.attributes.get('aria-modal')).toBe('true');
    expect(content.attributes.get('aria-labelledby')).toBe(title.attributes.get('id'));
    expect(content.attributes.get('aria-describedby')).toBe(description.attributes.get('id'));
    expect(overlay.attributes.get('data-lumina-dialog-overlay')).toBe('true');
    expect(title.tagName).toBe('h2');
    expect(description.tagName).toBe('p');
    expect(title.attributes.get('data-lumina-dialog-title')).toBe('true');
    expect(description.attributes.get('data-lumina-dialog-description')).toBe('true');
    expect(isHidden(overlay)).toBe(false);
    expect(isHidden(content)).toBe(false);
    expect(fakeDocument.activeElement).toBe(content);

    const preventForwardTab = jest.fn();
    content.listeners.get('keydown')?.({
      key: 'Tab',
      currentTarget: content,
      preventDefault: preventForwardTab,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventForwardTab).toHaveBeenCalledTimes(1);
    expect(fakeDocument.activeElement).toBe(actionButton);

    closeButton.focus();
    const preventWrappedTab = jest.fn();
    content.listeners.get('keydown')?.({
      key: 'Tab',
      currentTarget: content,
      preventDefault: preventWrappedTab,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventWrappedTab).toHaveBeenCalledTimes(1);
    expect(fakeDocument.activeElement).toBe(actionButton);

    actionButton.focus();
    const preventReverseTab = jest.fn();
    content.listeners.get('keydown')?.({
      key: 'Tab',
      shiftKey: true,
      currentTarget: content,
      preventDefault: preventReverseTab,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventReverseTab).toHaveBeenCalledTimes(1);
    expect(fakeDocument.activeElement).toBe(closeButton);

    const preventEscape = jest.fn();
    content.listeners.get('keydown')?.({
      key: 'Escape',
      currentTarget: content,
      preventDefault: preventEscape,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventEscape).toHaveBeenCalledTimes(1);
    expect(render.get(open)).toBe(false);
    expect(isHidden(overlay)).toBe(true);
    expect(isHidden(content)).toBe(true);
    expect(fakeDocument.activeElement).toBe(trigger);

    trigger.listeners.get('click')?.({ currentTarget: trigger } as unknown as Event);
    await Promise.resolve();
    overlay.listeners.get('click')?.({} as Event);
    await Promise.resolve();

    expect(render.get(open)).toBe(false);
    expect(isHidden(overlay)).toBe(true);
    expect(isHidden(content)).toBe(true);
    expect(fakeDocument.activeElement).toBe(trigger);

    trigger.listeners.get('click')?.({ currentTarget: trigger } as unknown as Event);
    await Promise.resolve();
    closeButton.listeners.get('click')?.({} as Event);
    await Promise.resolve();

    expect(externalCloseClick).toHaveBeenCalledTimes(1);
    expect(render.get(open)).toBe(false);
    expect(isHidden(overlay)).toBe(true);
    expect(isHidden(content)).toBe(true);
    expect(fakeDocument.activeElement).toBe(trigger);

    render.dispose_reactive(mounted);
  });

  test('dialog portal renders overlay and content into document body', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const open = render.signal(true);

    const mounted = render.mount_reactive(renderer, container, () =>
      render.dialog_root(open, () =>
        render.element('section', null, [
          render.dialog_trigger(null, [render.text('Open dialog')]),
          render.dialog_portal([
            render.dialog_overlay({ className: 'overlay' }),
            render.dialog_content({ className: 'content' }, [
              render.dialog_title(null, [render.text('Dialog title')]),
              render.dialog_close(null, [render.text('Close dialog')]),
            ]),
          ]),
        ])
      )
    );

    const section = container.childNodes[0] as FakeElement;
    const trigger = section.childNodes[0] as FakeElement;
    const anchor = section.childNodes[1] as FakeElement;
    const host = fakeDocument.body.childNodes[0] as FakeElement;
    const overlay = host.childNodes[0] as FakeElement;
    const content = host.childNodes[1] as FakeElement;

    expect(section.childNodes).toHaveLength(2);
    expect(trigger.tagName).toBe('button');
    expect(anchor.tagName).toBe('lumina-portal-anchor');
    expect(fakeDocument.body.childNodes).toHaveLength(1);
    expect(overlay.attributes.get('data-lumina-dialog-overlay')).toBe('true');
    expect(content.attributes.get('role')).toBe('dialog');
    expect(content.attributes.get('hidden')).toBeUndefined();

    render.dispose_reactive(mounted);
    expect(fakeDocument.body.childNodes).toHaveLength(0);
  });

  test('headless popover opens in a portal, positions from the trigger, and dismisses cleanly', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const open = render.signal(false);
    const externalTriggerClick = jest.fn();
    const isHidden = (node: FakeElement): boolean =>
      node.attributes.get('hidden') === 'true' || (node as FakeElement & { hidden?: boolean }).hidden === true;

    const mounted = render.mount_reactive(renderer, container, () =>
      render.popover_root(open, () =>
        render.element('section', null, [
          render.popover_trigger({ onClick: externalTriggerClick }, [render.text('Open popover')]),
          render.popover_portal([
            render.popover_content({ className: 'content', side: 'bottom', align: 'start', offset: 12 }, [
              render.element('button', { id: 'popover-action' }, [render.text('Popover action')]),
            ]),
          ]),
        ])
      )
    );

    const section = container.childNodes[0] as FakeElement;
    const trigger = section.childNodes[0] as FakeElement;
    trigger.boundingRect = { left: 120, top: 48, right: 200, bottom: 80, width: 80, height: 32 };

    expect(section.childNodes).toHaveLength(2);
    expect(trigger.attributes.get('aria-expanded')).toBe('false');

    trigger.listeners.get('click')?.({ currentTarget: trigger } as unknown as Event);
    await Promise.resolve();

    const host = fakeDocument.body.childNodes[0] as FakeElement;
    const dismiss = host.childNodes[0] as FakeElement;
    const content = host.childNodes[1] as FakeElement;
    const actionButton = content.childNodes[0] as FakeElement;

    expect(externalTriggerClick).toHaveBeenCalledTimes(1);
    expect(render.get(open)).toBe(true);
    expect(trigger.attributes.get('aria-expanded')).toBe('true');
    expect(dismiss.attributes.get('data-lumina-popover-dismiss')).toBe('true');
    expect(content.attributes.get('data-lumina-popover-content')).toBe('true');
    expect(content.attributes.get('data-side')).toBe('bottom');
    expect(content.attributes.get('aria-labelledby')).toBe(trigger.attributes.get('id'));
    expect(content.style.position).toBe('fixed');
    expect(content.style.top).toBe('92px');
    expect(content.style.left).toBe('120px');
    expect(fakeDocument.activeElement).toBe(content);

    const preventEscape = jest.fn();
    content.listeners.get('keydown')?.({
      key: 'Escape',
      currentTarget: content,
      preventDefault: preventEscape,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventEscape).toHaveBeenCalledTimes(1);
    expect(render.get(open)).toBe(false);
    expect(isHidden(dismiss)).toBe(true);
    expect(isHidden(content)).toBe(true);
    expect(fakeDocument.activeElement).toBe(trigger);

    trigger.listeners.get('click')?.({ currentTarget: trigger } as unknown as Event);
    await Promise.resolve();
    dismiss.listeners.get('click')?.({} as Event);
    await Promise.resolve();

    expect(render.get(open)).toBe(false);
    expect(isHidden(dismiss)).toBe(true);
    expect(isHidden(content)).toBe(true);
    expect(fakeDocument.activeElement).toBe(trigger);
    expect(actionButton.childNodes[0]?.textContent).toBe('Popover action');

    render.dispose_reactive(mounted);
    expect(fakeDocument.body.childNodes).toHaveLength(0);
  });

  test('headless menu opens in a portal, supports keyboard navigation, and selects items', async () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');
    const open = render.signal(false);
    const selected: string[] = [];
    const externalTriggerClick = jest.fn();
    const isHidden = (node: FakeElement): boolean =>
      node.attributes.get('hidden') === 'true' || (node as FakeElement & { hidden?: boolean }).hidden === true;

    const mounted = render.mount_reactive(renderer, container, () =>
      render.menu_root(open, () =>
        render.element('section', null, [
          render.menu_trigger({ onClick: externalTriggerClick }, [render.text('Open menu')]),
          render.menu_portal([
            render.menu_content({ className: 'menu', side: 'bottom', align: 'start' }, [
              render.menu_item('open', { onClick: () => selected.push('open') }, [render.text('Open file')]),
              render.menu_item('rename', { onClick: () => selected.push('rename') }, [render.text('Rename')]),
              render.menu_item('delete', { onClick: () => selected.push('delete') }, [render.text('Delete')]),
            ]),
          ]),
        ])
      )
    );

    const section = container.childNodes[0] as FakeElement;
    const trigger = section.childNodes[0] as FakeElement;
    trigger.boundingRect = { left: 40, top: 20, right: 100, bottom: 50, width: 60, height: 30 };

    trigger.listeners.get('click')?.({ currentTarget: trigger } as unknown as Event);
    await Promise.resolve();

    const host = fakeDocument.body.childNodes[0] as FakeElement;
    const dismiss = host.childNodes[0] as FakeElement;
    const content = host.childNodes[1] as FakeElement;
    const itemOpen = content.childNodes[0] as FakeElement;
    const itemRename = content.childNodes[1] as FakeElement;
    const itemDelete = content.childNodes[2] as FakeElement;

    expect(externalTriggerClick).toHaveBeenCalledTimes(1);
    expect(render.get(open)).toBe(true);
    expect(trigger.attributes.get('aria-haspopup')).toBe('menu');
    expect(content.attributes.get('role')).toBe('menu');
    expect(content.style.left).toBe('40px');
    expect(content.style.top).toBe('58px');
    expect(fakeDocument.activeElement).toBe(itemOpen);

    const preventDown = jest.fn();
    itemOpen.listeners.get('keydown')?.({
      key: 'ArrowDown',
      currentTarget: itemOpen,
      preventDefault: preventDown,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventDown).toHaveBeenCalledTimes(1);
    expect(fakeDocument.activeElement).toBe(itemRename);

    const preventEnd = jest.fn();
    itemRename.listeners.get('keydown')?.({
      key: 'End',
      currentTarget: itemRename,
      preventDefault: preventEnd,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventEnd).toHaveBeenCalledTimes(1);
    expect(fakeDocument.activeElement).toBe(itemDelete);

    const preventUp = jest.fn();
    itemDelete.listeners.get('keydown')?.({
      key: 'ArrowUp',
      currentTarget: itemDelete,
      preventDefault: preventUp,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventUp).toHaveBeenCalledTimes(1);
    expect(fakeDocument.activeElement).toBe(itemRename);

    const preventEnter = jest.fn();
    itemRename.listeners.get('keydown')?.({
      key: 'Enter',
      currentTarget: itemRename,
      preventDefault: preventEnter,
    } as unknown as Event);
    await Promise.resolve();

    expect(preventEnter).toHaveBeenCalledTimes(1);
    expect(selected).toEqual(['rename']);
    expect(render.get(open)).toBe(false);
    expect(isHidden(dismiss)).toBe(true);
    expect(isHidden(content)).toBe(true);
    expect(fakeDocument.activeElement).toBe(trigger);

    trigger.listeners.get('click')?.({ currentTarget: trigger } as unknown as Event);
    await Promise.resolve();
    dismiss.listeners.get('click')?.({} as Event);
    await Promise.resolve();

    expect(render.get(open)).toBe(false);
    expect(isHidden(dismiss)).toBe(true);
    expect(isHidden(content)).toBe(true);
    expect(fakeDocument.activeElement).toBe(trigger);

    render.dispose_reactive(mounted);
    expect(fakeDocument.body.childNodes).toHaveLength(0);
  });

  test('tabs helpers throw when used outside a tabs root provider', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const mounted = render.mount_reactive(renderer, container, () =>
      render.tabs_trigger('profile', null, [render.text('Profile')])
    );

    expect((mounted as { $tag?: string; $payload?: unknown }).$tag).toBe('Err');
    expect(String((mounted as { $payload?: unknown }).$payload)).toContain('No provider found for context');
  });

  test('dialog helpers throw when used outside a dialog root provider', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const mounted = render.mount_reactive(renderer, container, () =>
      render.dialog_trigger(null, [render.text('Open dialog')])
    );

    expect((mounted as { $tag?: string; $payload?: unknown }).$tag).toBe('Err');
    expect(String((mounted as { $payload?: unknown }).$payload)).toContain('No provider found for context');
  });

  test('popover helpers throw when used outside a popover root provider', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const mounted = render.mount_reactive(renderer, container, () =>
      render.popover_trigger(null, [render.text('Open popover')])
    );

    expect((mounted as { $tag?: string; $payload?: unknown }).$tag).toBe('Err');
    expect(String((mounted as { $payload?: unknown }).$payload)).toContain('No provider found for context');
  });

  test('menu helpers throw when used outside a menu root provider', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const mounted = render.mount_reactive(renderer, container, () =>
      render.menu_trigger(null, [render.text('Open menu')])
    );

    expect((mounted as { $tag?: string; $payload?: unknown }).$tag).toBe('Err');
    expect(String((mounted as { $payload?: unknown }).$payload)).toContain('No provider found for context');
  });

  test('render.state throws outside a component frame', () => {
    const fakeDocument = new FakeDocument();
    const renderer = render.create_dom_renderer({ document: fakeDocument as never });
    const container = fakeDocument.createElement('div');

    const mounted = render.mount_reactive(renderer, container, () => {
      render.state(0);
      return render.text('bad');
    });

    expect((mounted as { $tag?: string }).$tag).toBe('Err');
  });
});
