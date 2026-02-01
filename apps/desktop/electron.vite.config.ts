import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@cat/core': resolve('../../packages/core/src'),
        '@cat/db': resolve('../../packages/db/src'),
      },
    },
    plugins: [externalizeDepsPlugin({ exclude: ['@cat/core', '@cat/db'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@cat/core'] })],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@cat/core': resolve('../../packages/core/src'),
      },
    },
    plugins: [react()],
  },
});
