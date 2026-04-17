# Tabs Example

This example shows the current Lumina UI authoring model with `@std/tabs`.
It aliases `list` on import to avoid colliding with the builtin `list` runtime binding in generated ESM.

## What it demonstrates

- shared reactive tab state with `Signal<string>`
- headless composition through `@std/tabs`
- ARIA wiring and keyboard navigation handled by the runtime
- app-local styling layered on top of an unstyled primitive

## Run

```bash
npm run build
node dist/bin/lumina.js compile examples/tabs/main.lm --out examples/tabs/main.generated.js --target esm --ast-js
cp dist/lumina-runtime.js examples/tabs/lumina-runtime.js
```

On Windows PowerShell, use:

```powershell
Copy-Item dist/lumina-runtime.js examples/tabs/lumina-runtime.js -Force
```

Then serve the folder:

```bash
npx serve examples/tabs
```

Open `http://localhost:3000` and switch tabs with both the mouse and keyboard.

## What to expect

- Clicking a trigger updates the selected tab reactively.
- `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Home`, and `End` move focus state through the tab set.
- Panels stay headless and styleable while the runtime keeps `role`, `aria-selected`, `aria-controls`, and `hidden` coherent.
