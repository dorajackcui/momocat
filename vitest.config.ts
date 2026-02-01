import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/release/**',
      '**/build/**'
    ],
    include: ['**/*.{test,spec}.{ts,js}'],
    environment: 'node',
  },
});
