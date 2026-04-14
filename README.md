# Lumina

[![CI](https://github.com/nyigoro/lumina-lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nyigoro/lumina-lang/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/lumina-lang)](https://www.npmjs.com/package/lumina-lang)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](LICENSE)

Most languages make you choose: safety or the web. Lumina doesn't.

Lumina is a statically typed, web-native language with HM type inference, algebraic types, and trait-based polymorphism, compiled to JavaScript and WebAssembly. Build reactive UIs, WebGPU workloads, and WASM modules in the same language, with the same type system.

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
    match self {
      Idle => "Loading...",
      Ready(items) => "Ready",
      Failed(message) => message,
    }
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
lumina compile hello.lm --target esm --out hello.js
node hello.js
```

Start the REPL:

```bash
lumina repl
```

## Browser Demo

[Open the live browser demo](https://nyigoro.abrdns.com)

## Why Lumina?

- Lumina aims at the space between TypeScript ergonomics and Rust-style modeling.
- It keeps one language across browser UI, JS interop, and WASM workloads.
- It is a better fit than plain TypeScript when you want enums, pattern matching, traits, and stronger guarantees to survive all the way to the browser.

[Read: Why Lumina?](docs/WHY_LUMINA.md)

## Choosing a Target

- Use the JS target when you want the fastest edit-run-debug loop, deep browser/Node interop, or straightforward deployment.
- Use the WASM target when you want tighter runtime behavior, compute-heavy hot paths, or worker-isolated browser execution.

[Read: When to use JS vs WASM](docs/WHEN_TO_USE_JS_VS_WASM.md)

## What You Get

- `lumina` CLI for check, compile, run, grammar, bundle, and REPL workflows
- `lumina repl` with multiline input, history, and persistent declarations
- JS and WASM targets
- Reactive UI runtime and browser demo
- `lumina-lsp` plus a VS Code extension

## Docs

- [Getting Started](docs/GETTING_STARTED.md)
- [Why Lumina?](docs/WHY_LUMINA.md)
- [When to use JS vs WASM](docs/WHEN_TO_USE_JS_VS_WASM.md)
- [Capabilities](docs/CAPABILITIES.md)
- [Stdlib](docs/STDLIB.md)
- [Render / UI Runtime](docs/RENDER.md)
- [Web-Native Roadmap](docs/WEB_NATIVE_ROADMAP.md)
- [VS Code extension](vscode-extension/)

## Development

```bash
npm install
npm run build
npm run lint:check
npm test
```

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
