# Lumina

[![CI](https://github.com/nyigoro/lumina-lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nyigoro/lumina-lang/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/lumina-lang)](https://www.npmjs.com/package/lumina-lang)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](LICENSE)

Most languages make you choose: safety or the web. Lumina doesn't.

Lumina is a statically typed, web-native language with HM type inference, algebraic types, and trait-based polymorphism, compiled to JavaScript and WebAssembly. It ships first-class `js`, `wasm-web`, and `wasm-standalone` target profiles so you can keep browser and platform glue on JS while pushing shared systems code to WASM.

## At a Glance

```lumina
trait Summary {
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
      Idle => "Loading...",
      Ready(_) => "Ready",
      Failed(message) => message
    };
  }
}
```

## Install

```bash
npm install -g lumina-lang
```

## Quick Start

Create `hello.lm`:

```lumina
fn main() -> void {
  print("Hello, Lumina!")
}
```

Run the basic workflow:

```bash
lumina check hello.lm
lumina compile hello.lm --target js --module cjs --out hello.cjs
node hello.cjs
```

Start the REPL:

```bash
lumina repl
```

## Live Web Apps

- [Site](https://nyigoro.abrdns.com)
- [Docs](https://nyigoro.abrdns.com/docs/)
- [Playground](https://nyigoro.abrdns.com/playground/)

## Product Structure

- `demo/` currently serves as the Lumina-native marketing site that will be renamed to `site/` in the cleanup pass
- `docs-content/` is the markdown source tree for the docs portal while `docs/` stays free for static publishing output
- `docs-site/` is the on-site documentation portal shell backed by prerendered markdown data
- `playground/` is the focused interactive playground app where the editor and compiler experience will live
- `docs/` is the generated GitHub Pages output and should be rebuilt, not edited by hand
- `src/` contains the compiler, runtime, LSP, and stdlib implementation

## Why Lumina?

- Lumina aims at the space between TypeScript ergonomics and Rust-style modeling.
- It keeps one language across browser UI, JS interop, and WASM workloads.
- It is a better fit than plain TypeScript when you want enums, pattern matching, traits, and stronger guarantees to survive all the way to the browser.

[Read: Why Lumina?](https://nyigoro.abrdns.com/docs/#/why-lumina)

## Choosing a Target

- Use `js` when you want the fastest edit-run-debug loop, deep browser/Node interop, or an app shell that talks directly to browser and Node APIs.
- Use `wasm-web` when you want shared-core parity with JS, tighter runtime behavior, or worker-isolated browser execution for compute-heavy paths.
- Use `wasm-standalone` when you want the strict portable profile for import-light kernels, embedders, or WASI-style environments.

[Read: When to use JS vs WASM](https://nyigoro.abrdns.com/docs/#/js-vs-wasm)

## What You Get

- `lumina` CLI for check, compile, run, grammar, bundle, and REPL workflows
- `lumina repl` with multiline input, history, and persistent declarations
- `js`, `wasm-web`, and `wasm-standalone` targets
- Direct `.wasm` emission with optional `--emit-wat` debug output
- Reactive UI runtime and browser demo
- `lumina-lsp` plus a VS Code extension

## Docs

- [Docs home](https://nyigoro.abrdns.com/docs/)
- [Getting Started](https://nyigoro.abrdns.com/docs/#/getting-started)
- [Why Lumina?](https://nyigoro.abrdns.com/docs/#/why-lumina)
- [When to use JS vs WASM](https://nyigoro.abrdns.com/docs/#/js-vs-wasm)
- [Capabilities](https://nyigoro.abrdns.com/docs/#/capabilities)
- [Stdlib](https://nyigoro.abrdns.com/docs/#/stdlib)
- [Web-Native Roadmap](https://nyigoro.abrdns.com/docs/#/web-native-roadmap)
- [VS Code extension](vscode-extension/)

## Development

```bash
npm install
npm run build
npm run lint:check
npm test
```

## Web Development

Run the three web apps together:

```bash
npm run web:dev
```

Ports:

- `127.0.0.1:5173/` - main site
- `127.0.0.1:5173/docs/` - docs app through the main dev entrypoint
- `127.0.0.1:5173/playground/` - playground app through the main dev entrypoint
- `127.0.0.1:5174/docs/` - docs app directly
- `127.0.0.1:5175/playground/` - playground app directly

Build the full publish tree:

```bash
npm run web:build
```

Important notes:

- Edit markdown docs in `docs-content/`, not `docs/`
- Edit the docs shell in `docs-site/`
- `docs/` is the generated GitHub Pages output

## Project Files

- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Support](SUPPORT.md)
- [Changelog](CHANGELOG.md)

## License

Licensed under either of:

- MIT (`LICENSE`)
- Apache-2.0 (`LICENSE-APACHE`)

at your option.
