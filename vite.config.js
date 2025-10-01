import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/main.js'),
      formats: ['es'],
      name: 'hhoUi',
      fileName: () => 'ui.bundle.js'
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'ui.css';
          return 'assets/[name][extname]';
        }
      }
    },
    sourcemap: false
  }
});
