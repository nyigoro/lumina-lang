# Lumina

[![CI](https://github.com/nyigoro/lumina-lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nyigoro/lumina-lang/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/lumina-lang)](https://www.npmjs.com/package/lumina-lang)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](LICENSE)

Most languages make you choose: safety or the web. Lumina doesn't.

Lumina is a statically typed, web-native language with HM type inference, algebraic types, and trait-based polymorphism, compiled to JavaScript and WebAssembly. Build reactive UIs, WebGPU workloads, and WASM modules in the same language, with the same type system.

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

## What You Get

- `lumina` CLI for check, compile, run, grammar, bundle, and REPL workflows
- `lumina repl` with multiline input, history, and persistent declarations
- JS and WASM targets
- Reactive UI runtime and browser demo
- `lumina-lsp` plus a VS Code extension

## Docs

- `docs/GETTING_STARTED.md`
- `docs/CAPABILITIES.md`
- `docs/STDLIB.md`
- `docs/RENDER.md`
- `docs/WEB_NATIVE_ROADMAP.md`
- `vscode-extension/`

## Development

```bash
npm install
npm run build
npm run lint:check
npm test
```

## Project Files

- `CONTRIBUTING.md`
- `SECURITY.md`
- `SUPPORT.md`
- `CHANGELOG.md`

## License

Licensed under either of:

- MIT (`LICENSE`)
- Apache-2.0 (`LICENSE-APACHE`)

at your option.
