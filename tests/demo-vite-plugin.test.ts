import path from 'node:path';
import { luminaPlugin } from '../demo/vite-plugin-lumina.js';

describe('demo vite plugin', () => {
  test('resolves source-backed std modules beyond router', async () => {
    const plugin = luminaPlugin();
    const importer = path.resolve(__dirname, '../demo/main.lm');
    const routerPath = path.resolve(__dirname, '../std/router.lm');
    const testingPath = path.resolve(__dirname, '../std/testing.lm');
    const uiPath = path.resolve(__dirname, '../std/ui.lm');

    expect(plugin.resolveId?.('@std/router', importer)).toBe(routerPath);
    expect(plugin.resolveId?.('@std/testing', importer)).toBe(testingPath);
    expect(plugin.resolveId?.('@std/ui', importer)).toBe(uiPath);
    expect(plugin.resolveId?.('@std/render', importer)).toBeNull();

    const code = await plugin.load?.call(
      {
        error(message: string) {
          throw new Error(message);
        },
      },
      routerPath
    );

    expect(typeof code).toBe('string');
    expect(code).toContain('export {');
    expect(code).toContain('createRouter');
  });
});
