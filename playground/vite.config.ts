import path from 'node:path';
import { luminaPlugin } from '../demo/vite-plugin-lumina';

export default ({ command }) => ({
  plugins: [luminaPlugin()],
  root: '.',
  base: command === 'serve' ? '/playground/' : './',
  server: {
    open: false,
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    hmr: {
      path: '/playground/',
    },
  },
  resolve: {
    alias: {
      'node:fs/promises': path.resolve(__dirname, '../demo/shims/fs-promises.ts'),
      'fs/promises': path.resolve(__dirname, '../demo/shims/fs-promises.ts'),
      'node:crypto': path.resolve(__dirname, '../demo/shims/node-crypto.ts'),
      crypto: path.resolve(__dirname, '../demo/shims/node-crypto.ts'),
      'node:readline': path.resolve(__dirname, '../demo/shims/node-readline.ts'),
      readline: path.resolve(__dirname, '../demo/shims/node-readline.ts'),
      'node:worker_threads': path.resolve(__dirname, '../demo/shims/node-worker-threads.ts'),
      worker_threads: path.resolve(__dirname, '../demo/shims/node-worker-threads.ts'),
      tty: path.resolve(__dirname, '../demo/shims/tty.ts'),
      url: path.resolve(__dirname, '../demo/shims/url.ts'),
    },
  },
  build: {
    outDir: '../docs/playground',
    emptyOutDir: true,
    sourcemap: false,
  },
});
