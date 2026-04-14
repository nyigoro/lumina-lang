import fs from 'node:fs';
import path from 'node:path';
import { compileGrammar } from '../src/grammar/index.js';
import { analyzeLumina } from '../src/lumina/semantic.js';
import { inferProgram } from '../src/lumina/hm-infer.js';
import { generateJSFromAst } from '../src/lumina/codegen-js.js';
import type { LuminaProgram } from '../src/lumina/ast.js';
import * as runtime from '../src/lumina-runtime.js';

const grammarPath = path.resolve(__dirname, '../examples/lumina.peg');
const luminaGrammar = fs.readFileSync(grammarPath, 'utf-8');
const parser = compileGrammar(luminaGrammar);
const routerStdPath = path.resolve(__dirname, '../std/router.lm');
const routerStdSource = fs.readFileSync(routerStdPath, 'utf-8');
let cachedRouterApi: RouterApi | null = null;

type RouterApi = {
  createRouter: (base: string) => unknown;
  navigate: (routerValue: unknown, path: string) => void;
  replace: (routerValue: unknown, path: string) => void;
  currentPath: (routerValue: unknown) => unknown;
  currentParams: (routerValue: unknown) => unknown;
  matchRoute: (pattern: string, path: string) => boolean;
  extractParams: (pattern: string, path: string) => unknown;
  onRouteChange: (routerValue: unknown, handler: (path: string) => void) => unknown;
  link: (routerValue: unknown, href: string, label: string) => runtime.VNode;
};

type BrowserEnvHandle = {
  window: {
    location: { pathname: string; search: string; hash: string };
    history: {
      pushes: string[];
      replacements: string[];
      state: unknown;
      pushState: (data: unknown, unused: string, url?: string | URL | null) => void;
      replaceState: (data: unknown, unused: string, url?: string | URL | null) => void;
    };
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
    dispatchEvent: (event: Event) => boolean;
  };
};

const parseProgram = (source: string): LuminaProgram => parser.parse(source) as LuminaProgram;

const getTag = (value: unknown): string => ((value as { $tag?: string })?.$tag ?? '');
const getPayload = <T = unknown>(value: unknown): T => (value as { $payload?: T }).$payload as T;

const bindRouterRuntime = (js: string): string =>
  js
    .replace(
      /const str = \{[\s\S]*?\};\n/,
      'const str = __runtimeStr;\n'
    )
    .replace(
      /const router = \{[\s\S]*?\};\n/,
      'const router = __runtimeRouter;\n'
    );

const compileRouterStdlib = (): RouterApi => {
  if (cachedRouterApi) {
    return cachedRouterApi;
  }

  const ast = parseProgram(routerStdSource);
  const analysis = analyzeLumina(ast);
  const semanticErrors = analysis.diagnostics.filter((diag) => diag.severity === 'error');
  expect(semanticErrors).toHaveLength(0);

  const inferred = inferProgram(ast);
  const hmErrors = inferred.diagnostics.filter((diag) => diag.severity === 'error');
  expect(hmErrors).toHaveLength(0);

  const js = bindRouterRuntime(generateJSFromAst(ast, { target: 'cjs', includeRuntime: false }).code);
  const factory = new Function(
    '__runtimeRouter',
    '__runtimeStr',
    'reactive',
    'render',
    'vec',
    'hashmap',
    'Option',
    'module',
    `${js}\nreturn { createRouter, navigate, replace, currentPath, currentParams, matchRoute, extractParams, onRouteChange, link };`
  ) as (
    routerModule: typeof runtime.router,
    strModule: typeof runtime.str,
    reactiveModule: typeof runtime.reactive,
    renderModule: typeof runtime.render,
    vecModule: typeof runtime.vec,
    hashmapModule: typeof runtime.hashmap,
    optionModule: typeof runtime.Option,
    moduleHandle: { exports: Record<string, unknown> }
  ) => RouterApi;

  cachedRouterApi = factory(
    runtime.router,
    runtime.str,
    runtime.reactive,
    runtime.render,
    runtime.vec,
    runtime.hashmap,
    runtime.Option,
    { exports: {} }
  );
  return cachedRouterApi;
};

const installBrowserEnv = (
  pathname = '/app',
  options: { search?: string; hash?: string; baseURI?: string } = {}
): BrowserEnvHandle => {
  const listeners = new Map<string, Set<EventListener>>();
  const location = {
    pathname,
    search: options.search ?? '',
    hash: options.hash ?? '',
  };
  const history = {
    pushes: [] as string[],
    replacements: [] as string[],
    state: null as unknown,
    pushState: (_data: unknown, _unused: string, url?: string | URL | null) => {
      const next = typeof url === 'string' ? url : String(url ?? location.pathname);
      history.pushes.push(next);
      location.pathname = next;
      location.search = '';
      location.hash = '';
    },
    replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => {
      const next = typeof url === 'string' ? url : String(url ?? location.pathname);
      history.replacements.push(next);
      location.pathname = next;
      location.search = '';
      location.hash = '';
    },
  };
  const fakeWindow = {
    location,
    history,
    addEventListener: (type: string, listener: EventListener) => {
      const bucket = listeners.get(type) ?? new Set<EventListener>();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }
      return true;
    },
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: {
      baseURI: options.baseURI ?? 'https://lumina.dev/app/',
    },
  });
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    writable: true,
    value: location,
  });
  Object.defineProperty(globalThis, 'history', {
    configurable: true,
    writable: true,
    value: history,
  });

  return { window: fakeWindow };
};

describe('@std/router', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const originalHistory = Object.getOwnPropertyDescriptor(globalThis, 'history');

  const restoreGlobals = (): void => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as { document?: unknown }).document;
    if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
    else delete (globalThis as { location?: unknown }).location;
    if (originalHistory) Object.defineProperty(globalThis, 'history', originalHistory);
    else delete (globalThis as { history?: unknown }).history;
  };

  afterEach(() => {
    restoreGlobals();
  });

  test('matchRoute handles exact, parameter, wildcard, and nested routes', () => {
    const routerApi = compileRouterStdlib();

    expect(routerApi.matchRoute('/about', '/about')).toBe(true);
    expect(routerApi.matchRoute('/about', '/docs')).toBe(false);
    expect(routerApi.matchRoute('/users/:id', '/users/42')).toBe(true);
    expect(routerApi.matchRoute('/posts/:id/edit', '/posts/5/edit')).toBe(true);
    expect(routerApi.matchRoute('/posts/:id/edit', '/posts/5')).toBe(false);
    expect(routerApi.matchRoute('*', '/missing')).toBe(true);
  });

  test('extractParams returns path parameters for matched routes', () => {
    const routerApi = compileRouterStdlib();

    const userParams = routerApi.extractParams('/users/:id', '/users/42');
    const editParams = routerApi.extractParams('/posts/:id/edit', '/posts/5/edit');

    expect(getTag(runtime.hashmap.get(userParams as never, 'id'))).toBe('Some');
    expect(getPayload(runtime.hashmap.get(userParams as never, 'id'))).toBe('42');
    expect(getTag(runtime.hashmap.get(editParams as never, 'id'))).toBe('Some');
    expect(getPayload(runtime.hashmap.get(editParams as never, 'id'))).toBe('5');
  });

  test('createRouter reads initial path, respects base path, and exposes current search params', () => {
    installBrowserEnv('/app/lumina', {
      search: '?tab=demo&view=js',
      baseURI: 'https://lumina.dev/app/',
    });
    const routerApi = compileRouterStdlib();

    const routerValue = routerApi.createRouter('/app');
    const pathSignal = routerApi.currentPath(routerValue);
    const params = routerApi.currentParams(routerValue);

    expect(runtime.get(pathSignal as never)).toBe('/lumina');
    expect(getPayload(runtime.hashmap.get(params as never, 'tab'))).toBe('demo');
    expect(getPayload(runtime.hashmap.get(params as never, 'view'))).toBe('js');
  });

  test('createRouter upgrades legacy hash routes used by static fallback redirects', () => {
    const env = installBrowserEnv('/app', {
      hash: '#/lumina',
      baseURI: 'https://lumina.dev/app/',
    });
    const routerApi = compileRouterStdlib();

    const routerValue = routerApi.createRouter('/app');

    expect(runtime.get(routerApi.currentPath(routerValue) as never)).toBe('/lumina');
    expect(env.window.history.replacements.at(-1)).toBe('/app/lumina');
  });

  test('navigate and replace update history-backed path state', () => {
    const env = installBrowserEnv('/app', { baseURI: 'https://lumina.dev/app/' });
    const routerApi = compileRouterStdlib();

    const routerValue = routerApi.createRouter('/app');
    routerApi.navigate(routerValue, '/playground');
    expect(env.window.history.pushes.at(-1)).toBe('/app/playground');
    expect(runtime.get(routerApi.currentPath(routerValue) as never)).toBe('/playground');

    routerApi.replace(routerValue, '/lumina');
    expect(env.window.history.replacements.at(-1)).toBe('/app/lumina');
    expect(runtime.get(routerApi.currentPath(routerValue) as never)).toBe('/lumina');
  });

  test('back and forward style popstate dispatch updates the router signal', () => {
    const env = installBrowserEnv('/app/lumina', { baseURI: 'https://lumina.dev/app/' });
    const routerApi = compileRouterStdlib();

    const routerValue = routerApi.createRouter('/app');
    env.window.location.pathname = '/app/playground';
    env.window.dispatchEvent(new Event('popstate'));

    expect(runtime.get(routerApi.currentPath(routerValue) as never)).toBe('/playground');
  });

  test('onRouteChange runs when the route signal changes', async () => {
    installBrowserEnv('/app', { baseURI: 'https://lumina.dev/app/' });
    const routerApi = compileRouterStdlib();
    const seen: string[] = [];

    const routerValue = routerApi.createRouter('/app');
    const effect = routerApi.onRouteChange(routerValue, (path) => {
      seen.push(path);
    });

    routerApi.navigate(routerValue, '/lumina');
    await Promise.resolve();

    expect(seen).toContain('/');
    expect(seen).toContain('/lumina');
    runtime.reactive.disposeEffect(effect as never);
  });

  test('link renders an anchor, navigates on click, and prevents full page reload', () => {
    const env = installBrowserEnv('/app', { baseURI: 'https://lumina.dev/app/' });
    const routerApi = compileRouterStdlib();

    const routerValue = routerApi.createRouter('/app');
    const node = routerApi.link(routerValue, '/lumina', 'Playground');
    const props = node.props as { href?: string; onClick?: (event: Event) => void };
    const preventDefault = jest.fn();

    expect(node.kind).toBe('element');
    expect(node.tag).toBe('a');
    expect(props.href).toBe('/app/lumina');

    props.onClick?.({ preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalled();
    expect(env.window.location.pathname).toBe('/app/lumina');
    expect(runtime.get(routerApi.currentPath(routerValue) as never)).toBe('/lumina');
  });
});
