import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'scripts/**/*.test.ts', 'lib/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
