# When to Use JS vs WASM

Lumina supports both JavaScript and WebAssembly because they solve different problems well.

## Use the JS Target When

- you want the fastest edit-run-debug loop
- you are doing heavy browser or Node interop
- you want the simplest deployment path
- your app is UI-heavy and not bottlenecked by compute
- you want the easiest stack traces and source-level debugging today

## Use the WASM Target When

- you have compute-heavy hot paths
- you want worker-isolated execution in the browser
- startup cost and binary size are acceptable tradeoffs for runtime behavior
- you are building browser-native systems code, simulations, parsers, or numeric workloads
- you want the web-native execution path Lumina is prioritizing most aggressively

## Use Both When

- your UI shell benefits from JS interop, but specific workloads benefit from WASM
- you want to prototype on JS first, then move critical paths to WASM
- you need one language across app code and browser compute modules

## Practical Guidance

Start with JS unless you already know the workload is compute-heavy or worker-heavy.

Move to WASM when:

- profiling points to CPU-bound work
- bundle size remains acceptable
- the target environment supports the browser features you need

Stay on JS when:

- most of the value is in UI iteration speed
- the app is mainly glue code around existing JS libraries
- debugging speed matters more than runtime isolation

## Rule of Thumb

- JS is the default delivery target.
- WASM is the performance and systems target.
- Lumina is strongest when you can choose between them without changing languages.

## Read Next

- [Why Lumina?](WHY_LUMINA.md)
- [Capabilities](CAPABILITIES.md)
- [Web-Native Roadmap](WEB_NATIVE_ROADMAP.md)
