# Known Issues

## Critical: SSA Scope Bug (IR Codegen)

**Status:** ✅ FIXED (February 13, 2026)

**Symptoms (previously):** ReferenceError at runtime when using mutable variables in loops or branching.

**Example:**
```lumina
fn main() -> int {
  let mut count = 0;
  while (count < 5) {
    count = count + 1;
  }
  count
}
```

**Fix Details:**
- SSA temporaries are now declared at function scope.
- Loop bodies preserve mutations as assignments (no SSA in loops).
- Constant propagation respects loop‑mutated variables.

**Note:** The `--no-optimize` flag remains available for debugging.

## Syntax Highlighting

### Raw string edge case in VS Code
Raw strings containing escaped quotes (`r"hello \"world\""`) may
terminate highlighting early in the TextMate grammar layer.
This is a known TextMate regex limitation. When the Lumina LSP
is running, semantic token highlighting overrides this correctly.
Fix: migrate to Tree-sitter grammar (scheduled, not yet started).
