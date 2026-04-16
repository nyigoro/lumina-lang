import './style.css';
import './main.lm';

type MountEditor = (options: { elementId: string; initialValue: string }) => void;
type GetEditorText = (elementId: string) => string;
type SetEditorText = (elementId: string, value: string) => void;
type OnEditorChange = (elementId: string, handler: (value: string) => void) => () => void;
type CompileLuminaSource = (source: string) => {
  ok: boolean;
  js: string;
  diagnostics: Array<{ severity: string; message: string; line?: number }>;
};

type PlaygroundPreset = {
  id: string;
  label: string;
  description: string;
  source: string;
};

const presets: PlaygroundPreset[] = [
  {
    id: 'math',
    label: 'Math',
    description: 'Plain functions and arithmetic.',
    source: `fn square(x: int) -> int {
  return x * x
}

fn main() -> int {
  return square(12)
}`,
  },
  {
    id: 'json',
    label: 'JSON Shape',
    description: 'Enums and match-driven data shaping.',
    source: `enum JsonValue {
  Null,
  Text(string),
  Count(int)
}

fn describe(value: JsonValue) -> string {
  return match value {
    Null => "null",
    Text(text) => text,
    Count(_) => "count"
  };
}`,
  },
  {
    id: 'subset',
    label: 'Lumina Subset',
    description: 'Traits, enums, Vec, and pattern matching.',
    source: `trait Summary {
  fn label(self: Self) -> string
}

enum LoadState {
  Idle,
  Ready(Vec<int>),
  Failed(string)
}

impl Summary for LoadState {
  fn label(self: Self) -> string {
    return match self {
      Idle => "idle",
      Ready(items) => "ready=" + count_vec(items),
      Failed(message) => message
    };
  }
}

fn main() -> void {
  print(LoadState.Ready([1, 2, 3]).label())
}`,
  },
];

const defaultPreset = presets[0];
const isDirectPlaygroundDev = import.meta.env.DEV && window.location.port === '5175';

const devAppUrl = (port: string, path: string): string =>
  `${window.location.protocol}//${window.location.hostname}:${port}${path}`;

const homeHref = (): string => (isDirectPlaygroundDev ? devAppUrl('5173', '/') : '../');
const docsHref = (): string => (isDirectPlaygroundDev ? devAppUrl('5174', '/docs/') : '../docs/');

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderDiagnostics = (
  element: HTMLElement,
  diagnostics: Array<{ severity: string; message: string; line?: number }>
): void => {
  if (diagnostics.length === 0) {
    element.innerHTML = '<p class="playground-empty-state">No diagnostics. This source is ready to compile.</p>';
    return;
  }

  element.innerHTML = diagnostics
    .map(diagnostic => {
      const line = diagnostic.line ? `<span class="playground-diagnostic-line">Line ${diagnostic.line}</span>` : '';
      return `
        <div class="playground-diagnostic ${escapeHtml(diagnostic.severity)}">
          <div class="playground-diagnostic-meta">
            <span class="playground-diagnostic-severity">${escapeHtml(diagnostic.severity)}</span>
            ${line}
          </div>
          <p class="playground-diagnostic-message">${escapeHtml(diagnostic.message)}</p>
        </div>
      `;
    })
    .join('');
};

const renderOutput = (element: HTMLElement, result: ReturnType<CompileLuminaSource>): void => {
  if (result.ok) {
    element.textContent = result.js;
    return;
  }

  element.textContent = result.diagnostics
    .map(diagnostic => {
      const prefix = diagnostic.line ? `line ${diagnostic.line}: ` : '';
      return `${prefix}${diagnostic.message}`;
    })
    .join('\n');
};

window.addEventListener('load', async () => {
  const root = document.getElementById('playground-root');
  if (!root) return;

  const presetButtons = presets
    .map(
      preset => `
        <button class="playground-preset" data-preset="${preset.id}" type="button">
          <span class="playground-preset-label">${escapeHtml(preset.label)}</span>
          <span class="playground-preset-copy">${escapeHtml(preset.description)}</span>
        </button>
      `
    )
    .join('');

  root.innerHTML = `
    <div class="playground-shell">
      <div class="playground-body">
        <header class="playground-header">
          <div>
            <p class="playground-eyebrow">Lumina Playground</p>
            <h1 class="playground-title">Compile browser-first Lumina code.</h1>
            <p class="playground-copy">
              Phase 1 keeps the playground focused: presets, a direct CodeMirror editor, browser compilation,
              diagnostics, and emitted JavaScript in one place.
            </p>
          </div>
          <nav class="playground-actions">
            <a class="playground-link secondary" href="${homeHref()}">Home</a>
            <a class="playground-link secondary" href="${docsHref()}">Docs</a>
            <a class="playground-link primary" href="https://github.com/nyigoro/lumina-lang">GitHub</a>
          </nav>
        </header>

        <div class="playground-grid">
          <section class="playground-editor-shell">
            <div class="playground-panel-top">
              <div>
                <div class="playground-editor-header">Editor</div>
                <p class="playground-panel-copy">Switch between a few focused presets or type freely.</p>
              </div>
              <button class="playground-run-button" id="compile-button" type="button">Compile</button>
            </div>
            <div class="playground-presets">${presetButtons}</div>
            <div id="editor-root"></div>
          </section>

          <section class="playground-results">
            <div class="playground-card">
              <div class="playground-panel-top">
                <div>
                  <div class="playground-card-title">Diagnostics</div>
                  <p class="playground-panel-copy">Compiler feedback appears here as you edit.</p>
                </div>
                <div class="playground-status" id="compile-status">Waiting</div>
              </div>
              <div id="diagnostics-root"></div>
            </div>

            <div class="playground-card">
              <div class="playground-card-title">Generated JavaScript</div>
              <pre class="playground-output" id="output-root"></pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  await Promise.all([import('./codemirror-bridge'), import('./compiler-bridge')]);

  const bridge = globalThis as Record<string, unknown>;
  const mountEditor = bridge.mountEditor as MountEditor | undefined;
  const getEditorText = bridge.getEditorText as GetEditorText | undefined;
  const setEditorText = bridge.setEditorText as SetEditorText | undefined;
  const onEditorChange = bridge.onEditorChange as OnEditorChange | undefined;
  const compileLuminaSource = bridge.compileLuminaSource as CompileLuminaSource | undefined;
  if (!mountEditor || !getEditorText || !setEditorText || !onEditorChange || !compileLuminaSource) {
    return;
  }

  const diagnosticsRoot = document.getElementById('diagnostics-root');
  const outputRoot = document.getElementById('output-root');
  const compileStatus = document.getElementById('compile-status');
  const compileButton = document.getElementById('compile-button') as HTMLButtonElement | null;
  if (!diagnosticsRoot || !outputRoot || !compileStatus) return;

  const runCompile = (): void => {
    const source = getEditorText('editor-root');
    const result = compileLuminaSource(source);
    compileStatus.textContent = result.ok ? 'Compiled' : 'Needs attention';
    compileStatus.dataset.status = result.ok ? 'ok' : 'error';
    renderDiagnostics(diagnosticsRoot, result.diagnostics);
    renderOutput(outputRoot, result);
  };

  mountEditor({
    elementId: 'editor-root',
    initialValue: defaultPreset.source,
  });

  let compileTimer: number | undefined;
  onEditorChange('editor-root', () => {
    if (compileTimer) window.clearTimeout(compileTimer);
    compileTimer = window.setTimeout(() => {
      runCompile();
    }, 220);
  });

  compileButton?.addEventListener('click', () => {
    runCompile();
  });

  document.querySelectorAll<HTMLElement>('[data-preset]').forEach(button => {
    if (button.dataset.preset === defaultPreset.id) {
      button.dataset.active = 'true';
    }

    button.addEventListener('click', () => {
      const selectedPreset = presets.find(preset => preset.id === button.dataset.preset);
      if (!selectedPreset) return;

      setEditorText('editor-root', selectedPreset.source);
      document.querySelectorAll<HTMLElement>('[data-preset]').forEach(candidate => {
        if (candidate.dataset.preset === selectedPreset.id) candidate.dataset.active = 'true';
        else delete candidate.dataset.active;
      });
      runCompile();
    });
  });

  runCompile();
});
